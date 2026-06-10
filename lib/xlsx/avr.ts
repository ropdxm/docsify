import path from "node:path";
import ExcelJS from "exceljs";
import { formatDateRu } from "@/lib/format";
import type { XlsxDoc } from "@/lib/xlsx/invoice";

// Official «Акт выполненных работ (оказанных услуг)» — Форма Р-1
// (Приложение 50 к приказу Министра финансов РК от 20.12.2012 № 562).
const TEMPLATE = path.join(process.cwd(), "public", "akt_vyp_rabot_nfac.xlsx");
const SHEET = "Акт вып.работ (оказ.услуг)";

const ITEM_ROW = 20; // first item row in the template

function partyLine(name: string, address?: string | null): string {
  return [name, address].filter(Boolean).join(", ");
}

function currentMergeRanges(ws: ExcelJS.Worksheet): string[] {
  const merges =
    (ws as unknown as { _merges?: Record<string, unknown> })._merges ?? {};
  const out = new Set<string>();
  for (const v of Object.values(merges)) {
    const range =
      (v as { range?: string })?.range ??
      (v as { model?: { range?: string } })?.model?.range ??
      (typeof v === "string" ? (v as string) : undefined);
    if (range) out.add(range);
  }
  return [...out];
}

/**
 * Fills the official «Акт выполненных работ» (Форма Р-1) template with a
 * document's content. Structure, styling and merges are preserved; extra rows
 * are inserted for additional positions, mirroring the invoice renderer.
 */
export async function renderAvrXlsx(doc: XlsxDoc): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE);
  const ws = wb.getWorksheet(SHEET) ?? wb.worksheets[0];
  if (!ws) throw new Error(`Лист «${SHEET}» не найден в шаблоне`);

  // This template ships with a print area / print titles (defined names) and a
  // printer-driven page setup. On write, ExcelJS mangles the print-area
  // reference ($A$1:$AW$36 → relative $A1:$AW36) and emits a bogus DPI of
  // 4294967295, which Excel rejects as corrupt ("Replaced Part: sheet1.xml").
  // The invoice template has neither and renders fine — so normalise both.
  ws.pageSetup.printArea = undefined;
  ws.pageSetup.printTitlesRow = undefined;
  ws.pageSetup.horizontalDpi = 300;
  ws.pageSetup.verticalDpi = 300;

  const items = doc.items.length
    ? doc.items
    : [{ description: "", quantity: 0, unitPrice: 0, unit: "" }];
  const n = items.length;
  const delta = n - 1; // rows below the item row shift down by this much
  const sh = (row: number) => row + delta;

  // 1) Add styled item rows (shifts the totals/signature block down).
  if (delta > 0) ws.duplicateRow(ITEM_ROW, delta, true);

  // 2) Rebuild merges deterministically: clear all, then re-add the known set.
  for (const range of currentMergeRanges(ws)) {
    try {
      ws.unMergeCells(range);
    } catch {
      /* not merged — ignore */
    }
  }

  // Fixed header merges (rows 1–19, unaffected by the shift).
  const merges: string[] = [
    "AN1:AW1", "AN2:AW2", "AN3:AW3", "AN4:AW4",
    "A9:D9", "E9:AJ9", "AQ9:AW9",
    "E10:AJ10",
    "A11:D11", "E11:AJ11", "AQ11:AW11",
    "E12:AJ12",
    "A13:E13", "F13:AC13", "AH13:AL14", "AM13:AP14",
    "A15:AG15", "AH15:AL15", "AM15:AP15",
    "A17:B18", "C17:O18", "P17:T18", "U17:AC18", "AD17:AF18",
    "AG17:AW17", "AG18:AK18", "AL18:AQ18", "AR18:AW18",
    "A19:B19", "C19:O19", "P19:T19", "U19:AC19", "AD19:AF19",
    "AG19:AK19", "AL19:AQ19", "AR19:AW19",
  ];
  // Per-item merges (one set per position).
  for (let i = 0; i < n; i++) {
    const r = ITEM_ROW + i;
    merges.push(
      `A${r}:B${r}`, `C${r}:O${r}`, `P${r}:T${r}`, `U${r}:AC${r}`,
      `AD${r}:AF${r}`, `AG${r}:AK${r}`, `AL${r}:AQ${r}`, `AR${r}:AW${r}`
    );
  }
  // Footer merges (rows ≥ 21, shifted down by the extra item rows).
  const s21 = sh(21), s24 = sh(24), s25 = sh(25), s28 = sh(28);
  const s31 = sh(31), s32 = sh(32), s34 = sh(34);
  merges.push(
    `AG${s21}:AK${s21}`, `AL${s21}:AQ${s21}`, `AR${s21}:AW${s21}`,
    `Q${s24}:AW${s24}`,
    `Q${s25}:AW${s25}`,
    `O${s28}:AW${s28}`,
    `F${s31}:J${s31}`, `R${s31}:X${s31}`, `AF${s31}:AJ${s31}`, `AR${s31}:AW${s31}`,
    `F${s32}:J${s32}`, `L${s32}:P${s32}`, `R${s32}:X${s32}`,
    `AF${s32}:AJ${s32}`, `AL${s32}:AP${s32}`, `AR${s32}:AW${s32}`,
    `AL${s34}:AQ${s34}`
  );
  for (const range of merges) {
    try {
      ws.mergeCells(range);
    } catch {
      /* already merged / overlap — ignore */
    }
  }

  // 3) Content — only values change.
  const c = doc.company;
  const cp = doc.counterparty;
  const dateRu = formatDateRu(new Date(doc.date));

  // Parties: Заказчик (client) and Исполнитель (our company).
  const setParty = (row: number, name: string, address?: string | null) => {
    const cell = ws.getCell(`E${row}`);
    cell.value = partyLine(name, address);
    cell.alignment = { ...cell.alignment, wrapText: true, vertical: "top" };
  };
  setParty(9, cp?.name ?? "", cp?.address);
  ws.getCell("AQ9").value = cp?.bin ?? "";
  setParty(11, c.name, c.address);
  ws.getCell("AQ11").value = c.bin;

  // Contract reference, document number and date.
  ws.getCell("F13").value = doc.contract ?? "";
  ws.getCell("AH15").value = doc.number;
  ws.getCell("AM15").value = dateRu;

  // Items.
  for (let i = 0; i < n; i++) {
    const r = ITEM_ROW + i;
    const it = items[i];
    ws.getCell(`A${r}`).value = i + 1;
    ws.getCell(`C${r}`).value = it.description || "";
    ws.getCell(`P${r}`).value = dateRu; // дата выполнения работ
    ws.getCell(`AD${r}`).value = it.unit || "услуга";
    ws.getCell(`AG${r}`).value = it.quantity;
    ws.getCell(`AL${r}`).value = it.unitPrice;
    ws.getCell(`AR${r}`).value = it.quantity * it.unitPrice;
  }

  // Totals & signatures (shifted positions).
  ws.getCell(`AR${s21}`).value = doc.total_amount;
  ws.getCell(`R${s31}`).value = c.director ?? ""; // Сдал (Исполнитель)
  ws.getCell(`AR${s31}`).value = cp?.director ?? ""; // Принял (Заказчик)
  ws.getCell(`AL${s34}`).value = dateRu; // дата подписания

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
