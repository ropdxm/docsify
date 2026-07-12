import {
  detectMime,
  extractContractDraft,
  extractContractText,
  extractionConfigured,
} from "@/lib/contract-extract";
import { getCompany } from "@/lib/dal";

// Загрузка договора + извлечение реквизитов ИИ. Обычный Route Handler, а не
// server action: у server actions лимит тела 3 МБ (next.config.ts), а договоры
// бывают крупнее. maxDuration поднят - CPU-модель отвечает не мгновенно.
export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 15 * 1024 * 1024; // 15 МБ

function fail(status: number, error: string) {
  return Response.json({ found: false, error }, { status });
}

export async function POST(req: Request) {
  const company = await getCompany();
  if (!company) return fail(401, "Требуется вход и заполненный профиль.");
  if (!extractionConfigured()) {
    return fail(503, "Распознавание договоров ещё не подключено.");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "Некорректный запрос.");
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail(400, "Прикрепите файл договора.");
  }
  const mime = detectMime(file.name, file.type);
  if (!mime) return fail(415, "Поддерживаются только PDF и Word (.docx).");
  if (file.size > MAX_BYTES) {
    return fail(413, "Файл слишком большой (макс. 15 МБ).");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  let text: string;
  try {
    text = await extractContractText(bytes, mime);
  } catch {
    return fail(422, "Не удалось прочитать файл. Попробуйте другой PDF или Word.");
  }
  if (text.replace(/\s/g, "").length < 40) {
    return fail(
      422,
      "В файле почти нет текста - похоже, это скан. Пока нужен текстовый PDF или Word."
    );
  }

  const draft = await extractContractDraft(
    text,
    { bin: company.bin, name: company.name },
    file.name
  );
  if (!draft) {
    return fail(
      502,
      "Не удалось распознать договор. Попробуйте ещё раз или заполните вручную."
    );
  }

  return Response.json({ found: true, draft });
}
