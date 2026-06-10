import "server-only";

// КГД МФ РК «Поиск налогоплательщика» — официальный API портала:
//   GET https://portal.kgd.gov.kz/services/isnaportalsync/public/taxpayer-data
//   Headers: X-Portal-Token (выдаётся администратором КГД)
//   Params:  taxpayerCode (12 цифр), taxpayerType (UL | IP | LZCHP), print=false
// Ответ при совпадении: { taxpayerPortalSearchResponses: [{ messageResult:
// "SUCCESS", name | fullName, beginDate, endDate?, endReason? }] }.
// При неверном taxpayerType — HTTP 200 c { errorResponse: { messageResult:
// "FAILED" } }, поэтому перебираем типы по очереди.

const KGD_HOST = "https://portal.kgd.gov.kz";

export type KgdTaxpayer = {
  name: string;
  taxpayerType: "UL" | "IP" | "LZCHP";
  /** Дата снятия с учёта (ликвидации); null — действующий. */
  endDate: string | null;
};

type KgdSearchHit = {
  messageResult?: string;
  taxpayerType?: string;
  name?: string;
  fullName?: { lastName?: string; firstName?: string; middleName?: string };
  beginDate?: string;
  endDate?: string | null;
};

type KgdSearchResponse = {
  taxpayerPortalSearchResponses?: KgdSearchHit[];
  errorResponse?: { messageResult?: string; errorMessage?: string };
};

// В БИН пятая цифра — тип юр. лица (4 — резидент, 5 — нерезидент, 6 — ИП(С));
// в ИИН на этой позиции стоит цифра месяца рождения. Эвристика выбирает,
// какой taxpayerType пробовать первым, чтобы не делать лишних запросов
// (ответ для UL включает многосотенкилобайтную историю платежей).
function looksLikeBin(code: string): boolean {
  return code[4] === "4" || code[4] === "5" || code[4] === "6";
}

function hitName(hit: KgdSearchHit): string {
  if (hit.name) return hit.name;
  const f = hit.fullName;
  return [f?.lastName, f?.firstName, f?.middleName].filter(Boolean).join(" ");
}

/**
 * Looks a taxpayer up in the KGD registry by ИИН/БИН. Returns null when the
 * code is unknown, the token is missing, or KGD is unreachable.
 */
export async function kgdLookup(code: string): Promise<KgdTaxpayer | null> {
  const token = process.env.KGD_API_X_TOKEN;
  if (!token || !/^\d{12}$/.test(code)) return null;

  const order: Array<KgdTaxpayer["taxpayerType"]> = looksLikeBin(code)
    ? ["UL", "IP", "LZCHP"]
    : ["IP", "LZCHP", "UL"];

  for (const taxpayerType of order) {
    const url =
      `${KGD_HOST}/services/isnaportalsync/public/taxpayer-data` +
      `?taxpayerCode=${code}&taxpayerType=${taxpayerType}&print=false`;
    try {
      const res = await fetch(url, {
        headers: { "X-Portal-Token": token },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = (await res.json()) as KgdSearchResponse;
      const hit = data.taxpayerPortalSearchResponses?.find(
        (r) => r.messageResult === "SUCCESS"
      );
      if (!hit) continue;
      const name = hitName(hit);
      if (!name) continue;
      return { name, taxpayerType, endDate: hit.endDate ?? null };
    } catch {
      // Таймаут или сеть — пробуем следующий тип; в худшем случае вернём null.
    }
  }
  return null;
}
