// Smoke test: render the АВР (Форма Р-1) template, then re-read key cells.
//   bun run scripts/avr-test-render.ts
import { writeFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { renderAvrXlsx } from "../lib/xlsx/avr";

const buffer = await renderAvrXlsx({
  type: "avr",
  number: "АВР-2026-007",
  date: "2026-06-10",
  contract: "№ 12 от 01.06.2026",
  items: [
    { description: "Разработка сайта", quantity: 1, unitPrice: 450000, unit: "услуга" },
    { description: "Поддержка, июнь", quantity: 2, unitPrice: 75000, unit: "мес" },
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
    director: "Жаскалиева Г. И.",
    address: "г. Шымкент, мкр. Катын Копр, ул. Капал батыра, зд. 1/4",
  },
  bank: null,
});

await writeFile("tmp-avr-test.xlsx", buffer);

const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buffer as unknown as ArrayBuffer);
const ws = wb.getWorksheet("Акт вып.работ (оказ.услуг)")!;
const show = (addr: string) =>
  console.log(addr.padEnd(6), JSON.stringify(ws.getCell(addr).value));

console.log("--- parties / header ---");
for (const a of ["E9", "AQ9", "E11", "AQ11", "F13", "AH15", "AM15"]) show(a);
console.log("--- items (2 → totals shift +1) ---");
for (const a of ["A20", "C20", "P20", "AD20", "AG20", "AL20", "AR20"]) show(a);
for (const a of ["A21", "C21", "AD21", "AG21", "AL21", "AR21"]) show(a);
console.log("--- totals + signatures (shifted by 1) ---");
for (const a of ["AF22", "AL22", "AR22", "R32", "AR32", "AL35"]) show(a);
