"use server";

import { kgdLookup } from "@/lib/kgd";

export type BinLookupResult =
  | { found: true; name: string; liquidated: boolean }
  | { found: false; error: string };

/**
 * Поиск контрагента в реестре КГД по ИИН/БИН. Доступен без сессии — нужен
 * на странице регистрации.
 */
export async function lookupBin(code: string): Promise<BinLookupResult> {
  if (!/^\d{12}$/.test(code)) {
    return { found: false, error: "БИН/ИИН — ровно 12 цифр" };
  }
  const hit = await kgdLookup(code);
  if (!hit) {
    return { found: false, error: "Компания не найдена в реестре КГД" };
  }
  return { found: true, name: hit.name, liquidated: hit.endDate !== null };
}
