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
    name: "ИП «Максим»",
    bin: "951116555298",
    director: "Утемуратов М. М.",
    address: "г. Шымкент, Каратауский район, мкр. Нурсат, д. 1",
  },
  counterparty: {
    name: "ТОО «SeverStroy Kurylys»",
    bin: "110040010813",
    director: "Аймуратов Г. И.",
    address: "г. Алматы, ул. Бауыржан М., зд. 5",
  },
  bank: null,
});

await writeFile("tmp-avr-test.xlsx", buffer);

const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buffer as unknown as ArrayBuffer);
const ws = wb.getWorksheet("Акт выполненных работ")!;
const show = (addr: string) =>
  console.log(addr.padEnd(6), JSON.stringify(ws.getCell(addr).value));

console.log("--- parties / header ---");
for (const a of ["E9", "AQ9", "E11", "AQ11", "F13", "AP15", "AT15"]) show(a);
console.log("--- items (2 → totals shift +1) ---");
for (const a of ["A20", "C20", "N20", "AC20", "AF20", "AK20", "AQ20"]) show(a);
for (const a of ["A21", "C21", "AC21", "AF21", "AK21", "AQ21"]) show(a);
console.log("--- totals + signatures (shifted by 1) ---");
for (const a of ["AE22", "AK22", "AQ22", "R29", "AR29", "AT31"]) show(a);
