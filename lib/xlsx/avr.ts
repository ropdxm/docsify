import path from "node:path";
import ExcelJS from "exceljs";
import { formatDateRu } from "@/lib/format";
import type { XlsxDoc } from "@/lib/xlsx/invoice";

// Official «Акт выполненных работ (оказанных услуг)» - Форма Р-1
// (Приложение 50 к приказу Министра финансов РК от 20.12.2012 № 562).
const TEMPLATE = path.join(process.cwd(), "public", "aktofworks.xlsx");
const SHEET = "Акт выполненных работ";

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

  // Defensive: a print area / print titles (defined names) plus a printer-driven
  // page setup make ExcelJS emit a mangled print-area reference and a bogus DPI
  // (4294967295), which Excel rejects as corrupt ("Replaced Part: sheet1.xml").
  // None of this affects content - drop the print metadata, normalise the DPI.
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
      /* not merged - ignore */
    }
  }

  // Fixed header merges (rows 1–19, unaffected by the shift).
  const merges: string[] = [
    "A7:AJ7",
    "AN1:AW1", "AN2:AW2", "AN3:AW3", "AN4:AW4",
    "A9:D9", "E9:AJ9", "AQ9:AW9",
    "E10:AJ10",
    "A11:D11", "E11:AJ11", "AQ11:AW11",
    "E12:AJ12",
    "A13:E13", "F13:AC13", "AP13:AS14", "AT13:AW14",
    "A15:AG15", "AP15:AS15", "AT15:AW15",
    "A17:B18", "C17:M18", "N17:T18", "U17:AB18", "AC17:AE18",
    "AF17:AW17", "AF18:AJ18", "AK18:AP18", "AQ18:AW18",
    "A19:B19", "C19:M19", "N19:T19", "U19:AB19", "AC19:AE19",
    "AF19:AJ19", "AK19:AP19", "AQ19:AW19",
  ];
  // Per-item merges (one set per position).
  for (let i = 0; i < n; i++) {
    const r = ITEM_ROW + i;
    merges.push(
      `A${r}:B${r}`, `C${r}:M${r}`, `N${r}:T${r}`, `U${r}:AB${r}`,
      `AC${r}:AE${r}`, `AF${r}:AJ${r}`, `AK${r}:AP${r}`, `AQ${r}:AW${r}`
    );
  }
  // Footer merges (rows ≥ 21, shifted down by the extra item rows).
  const s21 = sh(21), s23 = sh(23), s24 = sh(24), s25 = sh(25);
  const s28 = sh(28), s29 = sh(29), s30 = sh(30);
  merges.push(
    `AF${s21}:AJ${s21}`, `AK${s21}:AP${s21}`, `AQ${s21}:AW${s21}`,
    `Q${s23}:AW${s23}`,
    `Q${s24}:AW${s24}`,
    `A${s25}:BC${s25}`,
    `F${s28}:J${s28}`, `R${s28}:X${s28}`,
    `F${s29}:J${s29}`, `L${s29}:P${s29}`, `R${s29}:X${s29}`,
    `AF${s29}:AJ${s29}`, `AL${s29}:AP${s29}`, `AR${s29}:AW${s29}`,
    `AT${s30}:AW${s30}`
  );
  for (const range of merges) {
    try {
      ws.mergeCells(range);
    } catch {
      /* already merged / overlap - ignore */
    }
  }

  // 3) Content - only values change.
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
  ws.getCell("AP15").value = doc.number;
  ws.getCell("AT15").value = dateRu;

  // Items.
  for (let i = 0; i < n; i++) {
    const r = ITEM_ROW + i;
    const it = items[i];
    ws.getCell(`A${r}`).value = i + 1;
    ws.getCell(`C${r}`).value = it.description || "";
    ws.getCell(`N${r}`).value = dateRu; // дата выполнения работ
    ws.getCell(`AC${r}`).value = it.unit || "услуга";
    ws.getCell(`AF${r}`).value = it.quantity;
    ws.getCell(`AK${r}`).value = it.unitPrice;
    ws.getCell(`AQ${r}`).value = it.quantity * it.unitPrice;
  }

  // Totals & signatures (shifted positions).
  ws.getCell(`AQ${s21}`).value = doc.total_amount;
  ws.getCell(`F${s28}`).value = "Руководитель"; // Сдал - должность
  ws.getCell(`R${s28}`).value = c.director ?? ""; // Сдал (Исполнитель)
  ws.getCell(`AF${s28}`).value = "Руководитель"; // Принял - должность
  ws.getCell(`AR${s28}`).value = cp?.director ?? ""; // Принял (Заказчик)
  ws.getCell(`AT${s30}`).value = dateRu; // дата подписания

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
