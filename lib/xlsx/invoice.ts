import path from "node:path";
import ExcelJS from "exceljs";
import { formatTenge, formatDateRu } from "@/lib/format";

const TEMPLATE = path.join(
  process.cwd(),
  "public",
  "schet_na_oplatu_AkshatyrPHYTO.xlsx"
);

export type XlsxBank = {
  iik: string;
  bank_name: string;
  bik: string;
  kbe: string;
  knp?: string | null;
};

export type XlsxDoc = {
  type: "invoice" | "avr" | "nakladnaja";
  number: string;
  date: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    /** АВР only: единица измерения (шт, услуга, час…). */
    unit?: string | null;
  }>;
  total_amount: number;
  /** АВР only: «Договор (контракт)» reference. */
  contract?: string | null;
  company: {
    name: string;
    bin: string;
    director?: string | null;
    address?: string | null;
  };
  counterparty: {
    name: string;
    bin: string;
    director?: string | null;
    address?: string | null;
  } | null;
  /** Реквизиты блока «Платежное поручение»; null — блок остаётся пустым. */
  bank: XlsxBank | null;
};

const ITEM_ROW = 27; // first item row in the template

// Name / БИН / address each on their own line, per the official form layout.
function partyLines(
  name: string,
  bin: string,
  address?: string | null
): string[] {
  return [name, `БИН/ИИН ${bin}`, address ? `Юр. адрес: ${address}` : null].filter(
    (s): s is string => Boolean(s)
  );
}

function currentMergeRanges(ws: ExcelJS.Worksheet): string[] {
  const merges = (ws as unknown as { _merges?: Record<string, unknown> })._merges ?? {};
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
 * Fills the official «Счёт на оплату» template with a document's content.
 * Structure, styling, merges and the logo are preserved; rows are added for
 * extra positions.
 */
export async function renderInvoiceXlsx(doc: XlsxDoc): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE);
  const ws = wb.getWorksheet("TDSheet");
  if (!ws) throw new Error("Лист TDSheet не найден в шаблоне");

  const items = doc.items.length ? doc.items : [{ description: "", quantity: 0, unitPrice: 0 }];
  const n = items.length;
  const extra = n - 1;
  const delta = extra; // rows below the item row shift down by this much
  const sh = (row: number) => row + delta;

  // 1) Add styled item rows (shifts the totals/signature block down).
  if (extra > 0) ws.duplicateRow(ITEM_ROW, extra, true);

  // 2) Rebuild merges deterministically: clear all, then re-add the known set.
  for (const range of currentMergeRanges(ws)) {
    try {
      ws.unMergeCells(range);
    } catch {
      /* not merged — ignore */
    }
  }
  const merges: string[] = [
    "G1:AM6", "B9:U9", "V9:AE9", "AF9:AM9", "B10:U10", "V10:AE11", "AF10:AM11",
    "B11:U11", "B12:U12", "V12:AC12", "AD12:AM12", "B13:U13", "V13:AC13",
    "AD13:AM13", "B16:AM17", "B18:AM18", "B20:E20", "F20:AM20", "B22:E22",
    "F22:AM22", "B24:J24", "L24:V24",
    "B26:C26", "D26:S26", "T26:W26", "X26:AL26", // items header
  ];
  for (let i = 0; i < n; i++) {
    const r = ITEM_ROW + i;
    merges.push(`B${r}:C${r}`, `D${r}:S${r}`, `T${r}:W${r}`, `X${r}:AL${r}`);
  }
  merges.push(
    `AG${sh(30)}:AL${sh(30)}`,
    `B${sh(33)}:AK${sh(33)}`,
    `G${sh(36)}:V${sh(36)}`,
    `W${sh(36)}:AH${sh(36)}`
  );
  for (const range of merges) {
    try {
      ws.mergeCells(range);
    } catch {
      /* already merged / overlap — ignore */
    }
  }

  // 3) Content — only values change.
  const isInvoice = doc.type === "invoice";
  const heading = isInvoice ? "Счёт на оплату" : "Акт выполненных работ";
  const c = doc.company;

  ws.getCell("B16").value = `${heading} № ${doc.number} от ${formatDateRu(new Date(doc.date))}`;

  // Beneficiary / bank block (supplier): ИИК, Кбе, банк, БИК, КНП.
  ws.getCell("B10").value = c.name;
  ws.getCell("V10").value = doc.bank?.iik ?? "";
  ws.getCell("AF10").value = doc.bank?.kbe ?? "";
  ws.getCell("B13").value = doc.bank?.bank_name ?? "";
  ws.getCell("V13").value = doc.bank?.bik ?? "";
  ws.getCell("AD13").value = doc.bank?.knp ?? "";

  // Parties — multiline cells (name / БИН / address), so the rows grow.
  const setParty = (row: number, lines: string[]) => {
    const cell = ws.getCell(`F${row}`);
    cell.value = lines.join("\n");
    cell.alignment = { ...cell.alignment, wrapText: true, vertical: "top" };
    ws.getRow(row).height = Math.max(15, 15 * lines.length);
    // The label ("Поставщик:") stays glued to the first line.
    const labelCell = ws.getCell(`B${row}`);
    labelCell.alignment = { ...labelCell.alignment, vertical: "top" };
  };
  setParty(20, partyLines(c.name, c.bin, c.address));
  setParty(
    22,
    doc.counterparty
      ? partyLines(
          doc.counterparty.name,
          doc.counterparty.bin,
          doc.counterparty.address
        )
      : [""]
  );

  // Items.
  for (let i = 0; i < n; i++) {
    const r = ITEM_ROW + i;
    const it = items[i];
    ws.getCell(`B${r}`).value = i + 1;
    ws.getCell(`D${r}`).value = it.description || "";
    ws.getCell(`T${r}`).value = it.quantity;
    ws.getCell(`X${r}`).value = it.quantity * it.unitPrice;
  }

  // Totals & signature (shifted positions).
  ws.getCell(`AG${sh(30)}`).value = doc.total_amount;
  ws.getCell(`B${sh(33)}`).value = `Всего к оплате: ${formatTenge(doc.total_amount)}`;
  ws.getCell(`G${sh(36)}`).value = c.director ?? "";

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
