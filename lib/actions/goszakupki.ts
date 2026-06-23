"use server";

import { requireCompany } from "@/lib/dal";
import {
  importGoszakupkiContract,
  type GoszakupkiImportedDocument,
} from "@/lib/goszakupki";

export type GoszakupkiImportResult =
  | { found: true; draft: GoszakupkiImportedDocument }
  | { found: false; error: string };

export async function importGoszakupkiContractDraft(
  query: string
): Promise<GoszakupkiImportResult> {
  const company = await requireCompany();
  const value = query.trim();

  if (!value) {
    return { found: false, error: "Укажите ID или системный номер договора." };
  }

  try {
    const draft = await importGoszakupkiContract(value, company.bin);
    if (!draft) {
      return { found: false, error: "Договор в госзакупках не найден." };
    }
    if (!/^\d{12}$/.test(draft.client.bin)) {
      return {
        found: false,
        error: "В договоре нет корректного БИН/ИИН контрагента.",
      };
    }
    return { found: true, draft };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось загрузить договор из госзакупок.";
    return { found: false, error: message };
  }
}
