"use server";

import { kgdLookup } from "@/lib/kgd";
import { egovLookupUl } from "@/lib/egov";

export type BinLookupResult =
  | {
      found: true;
      name: string;
      liquidated: boolean;
      /** Первый руководитель из ГБД ЮЛ; null, если реестр молчит. */
      director: string | null;
      /** Юридический адрес из ГБД ЮЛ; null, если реестр молчит. */
      address: string | null;
    }
  | { found: false; error: string };

/**
 * Поиск контрагента по ИИН/БИН. Доступен без сессии - нужен на странице
 * регистрации. Имя и статус (действует/ликвидирован) берём из КГД; руководителя
 * и адрес - из ГБД ЮЛ (eGov), т.к. КГД этих полей не отдаёт. Оба реестра
 * опрашиваем параллельно; отсутствие данных eGov форму не ломает.
 */
export async function lookupBin(code: string): Promise<BinLookupResult> {
  if (!/^\d{12}$/.test(code)) {
    return { found: false, error: "БИН/ИИН - ровно 12 цифр" };
  }
  const [hit, egov] = await Promise.all([kgdLookup(code), egovLookupUl(code)]);
  if (!hit) {
    return { found: false, error: "Компания не найдена в реестре КГД" };
  }
  return {
    found: true,
    name: hit.name,
    liquidated: hit.endDate !== null,
    director: egov?.director ?? null,
    address: egov?.address ?? null,
  };
}
