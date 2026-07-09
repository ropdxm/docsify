import "server-only";

// Открытые данные eGov - ГБД ЮЛ (реестр юридических лиц Минюста):
//   GET https://data.egov.kz/api/v4/gbd_ul/v1?apiKey=...&source={ES-запрос}
// Ответ - массив записей; берём первую по точному совпадению БИН. Нужные поля:
//   director  - первый руководитель (ФИО),
//   addressru - юридический адрес (рус.),
//   nameru    - наименование, statusru - статус ("Зарегистрирован" / …).
// КГД этих полей не отдаёт (только имя + НДС + история платежей), поэтому
// руководителя и адрес автозаполняем отсюда. Датасет - периодический снимок и
// может отставать от живого реестра, поэтому на форме поля оставляем
// редактируемыми, без пометки «проверено».

const EGOV_HOST = "https://data.egov.kz";

export type EgovCompany = {
  /** Первый руководитель (ФИО); null - в реестре пусто. */
  director: string | null;
  /** Юридический адрес (рус.), без служебного хвоста «тел./факс». */
  address: string | null;
};

type GbdUlRecord = {
  bin?: string;
  nameru?: string;
  director?: string;
  addressru?: string;
  statusru?: string;
};

/**
 * Ищет юрлицо в ГБД ЮЛ по БИН и возвращает руководителя + адрес. Возвращает
 * null, когда ключ не задан, БИН не из 12 цифр, запись не найдена или сервис
 * недоступен - вызывающий тогда просто оставляет поля пустыми (заполнит вручную).
 */
export async function egovLookupUl(bin: string): Promise<EgovCompany | null> {
  const key = process.env.EGOV_API_KEY;
  if (!key || !/^\d{12}$/.test(bin)) return null;

  const source = JSON.stringify({ size: 1, query: { match: { bin } } });
  const url =
    `${EGOV_HOST}/api/v4/gbd_ul/v1` +
    `?apiKey=${encodeURIComponent(key)}&source=${encodeURIComponent(source)}`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as unknown;
    const row = Array.isArray(rows)
      ? (rows[0] as GbdUlRecord | undefined)
      : undefined;
    if (!row) return null;
    const director = row.director?.trim() || null;
    const address = cleanAddress(row.addressru);
    if (!director && !address) return null;
    return { director, address };
  } catch {
    // Таймаут / сеть / битый JSON - молча возвращаем null.
    return null;
  }
}

// Адрес в реестре часто заканчивается служебным «…, тел. 8727…, факс 8727…» -
// для поля «Адрес» это мусор. Обрезаем от первого «тел»/«факс», за которым идёт
// разделитель и цифра (чтобы не задеть улицы вроде «Тельмана»).
function cleanAddress(raw: string | undefined): string | null {
  if (!raw) return null;
  const cut = raw.search(/,?\s*(тел|факс)[.:]?\s*\d/i);
  const s = (cut >= 0 ? raw.slice(0, cut) : raw).replace(/[\s,;]+$/, "").trim();
  return s || null;
}
