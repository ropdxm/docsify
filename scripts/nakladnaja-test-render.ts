// Smoke test: render the Накладная (Форма З-2) template, then re-read key cells.
//   bun run scripts/nakladnaja-test-render.ts
import { writeFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { renderNakladnajaXlsx } from "../lib/xlsx/nakladnaja";

const buffer = await renderNakladnajaXlsx({
  type: "nakladnaja",
  number: "Накл-2026-003",
  date: "2026-06-12",
  items: [
    { description: "Бумага А4, 80 г/м²", quantity: 10, unitPrice: 1800, unit: "пачка" },
    { description: "Картридж HP 12A", quantity: 2, unitPrice: 22000, unit: "шт" },
  ],
  total_amount: 10 * 1800 + 2 * 22000,
  company: {
    name: "ИП «ЖДМ»",
    bin: "050916501298",
    director: "Жанбыршын Д. М.",
    address: "г. Шымкент, мкр. Нурсат, д. 1",
  },
  counterparty: {
    name: "ТОО «PHYTO-APIPHARM»",
    bin: "110240013813",
    director: "Жаскалиева Г. И.",
    address: "г. Шымкент, ул. Капал батыра, зд. 1/4",
  },
  bank: null,
});

await writeFile("tmp-nakladnaja-test.xlsx", buffer);

const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buffer as unknown as ArrayBuffer);
const ws = wb.getWorksheet("Накладная по форме 3-2")!;
const show = (addr: string) =>
  console.log(addr.padEnd(6), JSON.stringify(ws.getCell(addr).value));

console.log("--- header / parties ---");
for (const a of ["N9", "AQ9", "AP13", "AT13", "A19", "L19", "W19"]) show(a);
console.log("--- items (2 → Итого shifts +1) ---");
for (const a of ["A24", "C24", "T24", "W24", "AB24", "AF24", "AL24"]) show(a);
for (const a of ["A25", "C25", "T25", "AF25", "AL25"]) show(a);
console.log("--- Итого + Отпуск разрешил (shifted by 1) ---");
for (const a of ["W26", "AB26", "AL26", "AE28", "F30", "R30"]) show(a);
