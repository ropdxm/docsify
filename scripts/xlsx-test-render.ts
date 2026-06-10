// Smoke test: render the счёт template with bank requisites and multiline
// parties, then re-read the result and print the key cells.
//   bun run scripts/xlsx-test-render.ts
import { writeFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { renderInvoiceXlsx } from "../lib/xlsx/invoice";

const buffer = await renderInvoiceXlsx({
  type: "invoice",
  number: "СФ-2026-007",
  date: "2026-06-10",
  items: [
    { description: "Разработка сайта", quantity: 1, unitPrice: 450000 },
    { description: "Поддержка, июнь", quantity: 2, unitPrice: 75000 },
  ],
  total_amount: 600000,
  company: {
    name: "ИП «ЖДМ»",
    bin: "050916501298",
    director: "Жанбыршын Д. М.",
    address: "г. Шымкент, Каратауский район, мкр. Нурсат, д. 1",
  },
  counterparty: {
    name: "ТОО «PHYTO-APIPHARM»",
    bin: "110240013813",
    director: null,
    address: "г. Шымкент, мкр. Катын Копр, ул. Капал батыра, зд. 1/4",
  },
  bank: {
    iik: "KZ52551X329318245KZT",
    bank_name: "АО «Фридом Банк Казахстан»",
    bik: "KSNVKZKA",
    kbe: "19",
    knp: "859",
  },
});

await writeFile("tmp-invoice-test.xlsx", buffer);

const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buffer as unknown as ArrayBuffer);
const ws = wb.getWorksheet("TDSheet")!;
const show = (addr: string) =>
  console.log(addr.padEnd(5), JSON.stringify(ws.getCell(addr).value));
for (const a of ["B10", "V10", "AF10", "B13", "V13", "AD13", "B16", "F20", "F22"]) show(a);
console.log("row20 height:", ws.getRow(20).height, "| row22 height:", ws.getRow(22).height);
console.log("F20 wrap:", ws.getCell("F20").alignment?.wrapText, "| F22 wrap:", ws.getCell("F22").alignment?.wrapText);
for (const a of ["D27", "X27", "D28", "X28"]) show(a);
console.log("total AG31:", JSON.stringify(ws.getCell("AG31").value));
console.log("B34:", JSON.stringify(ws.getCell("B34").value));
console.log("G37:", JSON.stringify(ws.getCell("G37").value));
