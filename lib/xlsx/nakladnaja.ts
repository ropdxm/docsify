import path from "node:path";
import ExcelJS from "exceljs";
import { formatDateRu, formatTengeWords } from "@/lib/format";
import type { XlsxDoc } from "@/lib/xlsx/invoice";

// Official «Накладная на отпуск запасов на сторону» - Форма З-2
// (Приложение 26 к приказу Министра финансов РК от 20.12.2012 № 562).
const TEMPLATE = path.join(process.cwd(), "public", "nakladnaja.xlsx");
const SHEET = "Накладная по форме 3-2";

const ITEM_ROW = 24; // first item row in the template («Итого» sits at row 25)

function partyName(name: string): string {
  return name;
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
 * Fills the official «Накладная на отпуск запасов на сторону» (Форма З-2)
 * template with a document's content. Structure, styling and merges are
 * preserved; extra rows are inserted for additional positions, mirroring the
 * invoice and АВР renderers.
 */
export async function renderNakladnajaXlsx(doc: XlsxDoc): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE);
  const ws = wb.getWorksheet(SHEET) ?? wb.worksheets[0];
  if (!ws) throw new Error(`Лист «${SHEET}» не найден в шаблоне`);

  // Defensive: drop the print metadata and normalise the DPI, same as the АВР
  // renderer - otherwise ExcelJS emits a bogus DPI that Excel rejects as corrupt.
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

  // 1) Add styled item rows (shifts the «Итого» / signature block down).
  if (delta > 0) ws.duplicateRow(ITEM_ROW, delta, true);

  // 2) Rebuild merges deterministically: clear all, then re-add the known set.
  for (const range of currentMergeRanges(ws)) {
    try {
      ws.unMergeCells(range);
    } catch {
      /* not merged - ignore */
    }
  }

  // Fixed header merges (rows 1–23, unaffected by the shift).
  const merges: string[] = [
    "AN1:AW1", "AN2:AW2", "AN3:AW3", "AN4:AW4",
    "A7:AJ7",
    "A9:M9", "N9:AK9", "AQ9:AW9",
    "AP12:AS12", "AT12:AW12",
    "AP13:AS13", "AT13:AW13",
    "A15:AW15",
    "A18:K18", "L18:V18", "W18:AE18", "AF18:AN18", "AO18:AW18",
    "A19:K19", "L19:V19", "W19:AE19", "AF19:AN19", "AO19:AW19",
    "A21:B22", "C21:N22", "O21:S22", "T21:V22", "W21:AE21",
    "AF21:AK22", "AL21:AQ22", "AR21:AW22", "W22:AA22", "AB22:AE22",
    "A23:B23", "C23:N23", "O23:S23", "T23:V23", "W23:AA23",
    "AB23:AE23", "AF23:AK23", "AL23:AQ23", "AR23:AW23",
  ];
  // Per-item merges (one set per position).
  for (let i = 0; i < n; i++) {
    const r = ITEM_ROW + i;
    merges.push(
      `A${r}:B${r}`, `C${r}:N${r}`, `O${r}:S${r}`, `T${r}:V${r}`,
      `W${r}:AA${r}`, `AB${r}:AE${r}`, `AF${r}:AK${r}`,
      `AL${r}:AQ${r}`, `AR${r}:AW${r}`
    );
  }
  // Footer merges (rows ≥ 25, shifted down by the extra item rows).
  const s25 = sh(25), s27 = sh(27), s29 = sh(29), s30 = sh(30);
  const s31 = sh(31), s33 = sh(33), s34 = sh(34), s37 = sh(37), s38 = sh(38);
  merges.push(
    `W${s25}:AA${s25}`, `AB${s25}:AE${s25}`, `AF${s25}:AK${s25}`,
    `AL${s25}:AQ${s25}`, `AR${s25}:AW${s25}`,
    `N${s27}:V${s27}`, `W${s27}:AD${s27}`, `AE${s27}:AW${s27}`,
    `F${s29}:J${s29}`, `R${s29}:X${s29}`, `AF${s29}:AV${s29}`,
    `F${s30}:J${s30}`, `L${s30}:P${s30}`, `R${s30}:X${s30}`,
    `AD${s31}:AV${s31}`,
    `F${s33}:J${s33}`, `L${s33}:V${s33}`,
    `F${s34}:J${s34}`, `L${s34}:V${s34}`,
    `F${s37}:J${s37}`, `L${s37}:V${s37}`,
    `F${s38}:J${s38}`, `L${s38}:V${s38}`, `AF${s38}:AK${s38}`, `AM${s38}:AV${s38}`
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

  // Header: organization (sender) + БИН, document number and date.
  ws.getCell("N9").value = c.name;
  ws.getCell("AQ9").value = c.bin;
  ws.getCell("AP13").value = doc.number;
  ws.getCell("AT13").value = dateRu;

  // Parties: отправитель (our company), получатель (client), responsible person.
  const setParty = (addr: string, value: string) => {
    const cell = ws.getCell(addr);
    cell.value = value;
    cell.alignment = { ...cell.alignment, wrapText: true, vertical: "top" };
  };
  setParty("A19", partyName(c.name));
  setParty("L19", partyName(cp?.name ?? ""));
  ws.getCell("W19").value = c.director ?? ""; // ответственный за поставку

  // Items.
  let qtyTotal = 0;
  for (let i = 0; i < n; i++) {
    const r = ITEM_ROW + i;
    const it = items[i];
    qtyTotal += it.quantity;
    ws.getCell(`A${r}`).value = i + 1; // номер по порядку
    ws.getCell(`C${r}`).value = it.description || ""; // наименование
    ws.getCell(`T${r}`).value = it.unit || "шт"; // единица измерения
    ws.getCell(`W${r}`).value = it.quantity; // количество - подлежит отпуску
    ws.getCell(`AB${r}`).value = it.quantity; // количество - отпущено
    ws.getCell(`AF${r}`).value = it.unitPrice; // цена за единицу
    ws.getCell(`AL${r}`).value = it.quantity * it.unitPrice; // сумма с НДС
  }

  // «Итого» row (shifted positions).
  ws.getCell(`W${s25}`).value = qtyTotal;
  ws.getCell(`AB${s25}`).value = qtyTotal;
  ws.getCell(`AL${s25}`).value = doc.total_amount;
  const totalWordsCell = ws.getCell(`AE${s27}`);
  totalWordsCell.value = formatTengeWords(doc.total_amount);
  totalWordsCell.alignment = {
    ...totalWordsCell.alignment,
    wrapText: true,
    vertical: "top",
  };

  // «Отпуск разрешил»: руководитель отправителя.
  ws.getCell(`F${s29}`).value = "Руководитель";
  ws.getCell(`R${s29}`).value = c.director ?? "";

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
