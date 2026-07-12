import "server-only";

import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import type { GoszakupkiImportedDocument } from "@/lib/goszakupki";

// Извлечение реквизитов из загруженного договора (PDF или Word) с помощью
// самостоятельно размещённой открытой модели (Ollama, OpenAI-совместимый API).
// Договоры - чувствительные документы, поэтому модель разворачивается на своём
// сервере (см. model-service/), а не в стороннем облаке. Текст извлекается здесь
// (unpdf / mammoth), к модели уходит только текст - файл никуда не загружается.

export const PDF_MIME = "application/pdf";
export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Модель на Railway работает на CPU (без GPU), поэтому: небольшая модель,
// ограниченный вход и щедрый таймаут.
const MODEL_URL = process.env.MODEL_SERVICE_URL;
const MODEL_TOKEN = process.env.MODEL_SERVICE_TOKEN;
const MODEL_NAME = process.env.MODEL_NAME || "qwen2.5:7b-instruct";
const MAX_INPUT_CHARS = 9_000; // ~2.5-3k токенов - потолок для CPU-модели
const MODEL_TIMEOUT_MS = 240_000; // CPU-инференс медленный; под maxDuration=300
const MAX_OUTPUT_TOKENS = 1_200; // ограничивает разгон модели на длинных договорах

export function extractionConfigured(): boolean {
  return Boolean(MODEL_URL && MODEL_TOKEN);
}

/** Определяет тип файла по MIME и расширению (MIME от браузера бывает пустым). */
export function detectMime(name: string, type: string): string | null {
  const t = (type || "").toLowerCase();
  if (t === PDF_MIME) return PDF_MIME;
  if (t === DOCX_MIME) return DOCX_MIME;
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return PDF_MIME;
  if (lower.endsWith(".docx")) return DOCX_MIME;
  return null;
}

/** Достаёт обычный текст из PDF или .docx. Кидает ошибку на нечитаемый файл. */
export async function extractContractText(
  bytes: Uint8Array,
  mime: string
): Promise<string> {
  if (mime === PDF_MIME) {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return (Array.isArray(text) ? text.join("\n") : text).trim();
  }
  if (mime === DOCX_MIME) {
    const { value } = await mammoth.extractRawText({
      buffer: Buffer.from(bytes),
    });
    return value.trim();
  }
  throw new Error(`Unsupported mime: ${mime}`);
}

type ModelItem = {
  description?: unknown;
  quantity?: unknown;
  unit_price?: unknown;
  unit?: unknown;
};
type ModelOutput = {
  client_bin?: unknown;
  client_name?: unknown;
  client_director?: unknown;
  client_address?: unknown;
  contract_number?: unknown;
  contract_date?: unknown;
  items?: unknown;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function numOr0(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

// Модель просят вернуть ГГГГ-ММ-ДД, но подстрахуемся и от ДД.ММ.ГГГГ.
function normalizeDate(v: unknown): string | null {
  const s = str(v);
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})[.\/](\d{2})[.\/](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

/** Снимает возможные ```json ...``` и вытаскивает первый JSON-объект. */
function parseJsonObject(raw: string): ModelOutput | null {
  const fenced = raw.replace(/```(?:json)?/gi, "").trim();
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(fenced.slice(start, end + 1)) as ModelOutput;
  } catch {
    return null;
  }
}

function buildPrompt(text: string, company: { bin: string; name: string }) {
  const system =
    "Ты извлекаешь реквизиты из договора между двумя сторонами в Казахстане. " +
    `НАША компания: БИН ${company.bin}, «${company.name}». Её НЕ считай клиентом. ` +
    "Клиент - ДРУГАЯ сторона (заказчик/покупатель/контрагент). " +
    "Верни СТРОГО один JSON без пояснений:\n" +
    "{\n" +
    '  "client_bin": "12 цифр БИН контрагента или пусто",\n' +
    '  "client_name": "точное название контрагента",\n' +
    '  "client_director": "ФИО директора контрагента (обычно после слов «в лице директора»)",\n' +
    '  "client_address": "юридический адрес контрагента",\n' +
    '  "contract_number": "ТОЛЬКО номер, напр. 78/2026 - без слова ДОГОВОР и без №",\n' +
    '  "contract_date": "ГГГГ-ММ-ДД",\n' +
    '  "items": [{"description":"краткое наименование","quantity":число,"unit_price":цена за единицу,"unit":"ед."}]\n' +
    "}\n" +
    "Извлекай точно как в тексте. Если данных нет - пустая строка или []. Только JSON.";
  const user = `Текст договора:\n"""\n${text}\n"""`;
  return { system, user };
}

async function callModel(system: string, user: string): Promise<string> {
  const res = await fetch(`${MODEL_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${MODEL_TOKEN}`,
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.1,
      stream: false,
      max_tokens: MAX_OUTPUT_TOKENS,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`model ${res.status}`);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Прогоняет текст договора через модель и возвращает черновик в том же виде,
 * что и импорт из Госзакупок (GoszakupkiImportedDocument), чтобы переиспользовать
 * ту же логику подстановки в форму. Возвращает null, если модель не настроена
 * или ответ нечитаем - вызывающий покажет понятную ошибку.
 */
export async function extractContractDraft(
  text: string,
  company: { bin: string; name: string },
  filename: string
): Promise<GoszakupkiImportedDocument | null> {
  if (!extractionConfigured()) return null;

  const clipped = text.slice(0, MAX_INPUT_CHARS);
  const { system, user } = buildPrompt(clipped, company);

  let content: string;
  try {
    content = await callModel(system, user);
  } catch {
    return null; // таймаут / сеть / 5xx - форма покажет "не удалось распознать"
  }

  const parsed = parseJsonObject(content);
  if (!parsed) return null;

  const warnings: string[] = [];
  if (text.length > MAX_INPUT_CHARS) {
    warnings.push("Договор длинный - проверьте позиции, часть текста не читалась.");
  }

  const rawBin = str(parsed.client_bin).replace(/\D/g, "");
  const validBin = /^\d{12}$/.test(rawBin);
  if (!validBin) warnings.push("БИН клиента не распознан - впишите вручную.");

  const items = (Array.isArray(parsed.items) ? parsed.items : [])
    .map((it: ModelItem) => ({
      description: str(it.description),
      quantity: numOr0(it.quantity) || 1,
      unitPrice: numOr0(it.unit_price),
      unit: str(it.unit),
    }))
    .filter((it) => it.description.length > 0);
  if (items.length === 0) {
    warnings.push("Позиции не распознаны - добавьте их вручную.");
  }

  return {
    contractId: 0,
    contractNumber: str(parsed.contract_number),
    contractNumberSys: "",
    contractDate: normalizeDate(parsed.contract_date),
    sourceLabel: filename,
    client: {
      bin: validBin ? rawBin : "",
      name: str(parsed.client_name),
      director: str(parsed.client_director),
      address: str(parsed.client_address),
    },
    items,
    warnings,
  };
}
