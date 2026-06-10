import path from "node:path";
import ExcelJS from "exceljs";
import { formatTenge, formatDateRu } from "@/lib/format";

const TEMPLATE = path.join(
  process.cwd(),
  "public",
  "schet_na_oplatu_AkshatyrPHYTO.xlsx"
);

export type XlsxDoc = {
  type: "invoice" | "avr";
  number: string;
  date: string;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  total_amount: number;
  company: {
    name: string;
    bin: string;
    director?: string | null;
    address?: string | null;
    bank_account?: string | null;
    bank_name?: string | null;
  };
  counterparty: {
    name: string;
    bin: string;
    director?: string | null;
    address?: string | null;
  } | null;
};

const ITEM_ROW = 27; // first item row in the template

function partyLine(
  name: string,
  bin: string,
  address?: string | null
): string {
  return [name, `БИН/ИИН ${bin}`, address ? `Юр. адрес: ${address}` : null]
    .filter(Boolean)
    .join("  ");
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

  // Beneficiary / bank block (supplier).
  ws.getCell("B10").value = c.name;
  ws.getCell("V10").value = c.bank_account ?? "";
  ws.getCell("AF10").value = "";
  ws.getCell("B13").value = c.bank_name ?? "";
  ws.getCell("V13").value = "";
  ws.getCell("AD13").value = "";

  // Parties.
  ws.getCell("F20").value = partyLine(c.name, c.bin, c.address);
  ws.getCell("F22").value = doc.counterparty
    ? partyLine(doc.counterparty.name, doc.counterparty.bin, doc.counterparty.address)
    : "";

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
