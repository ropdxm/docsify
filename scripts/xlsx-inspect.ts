import ExcelJS from "exceljs";

const file = process.argv[2] ?? "public/schet_na_oplatu_AkshatyrPHYTO.xlsx";
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);

wb.eachSheet((ws) => {
  console.log(`\n=== SHEET "${ws.name}" — rows:${ws.rowCount} cols:${ws.columnCount} ===`);
  // merged ranges
  const merges = (ws as unknown as { _merges: Record<string, { range?: string }> })._merges;
  console.log("MERGES:", Object.values(merges ?? {}).map((m) => m.range).filter(Boolean).join(", ") || "(none)");
  // images
  const imgs = ws.getImages?.() ?? [];
  console.log("IMAGES:", imgs.length);

  // non-empty cells
  ws.eachRow({ includeEmpty: false }, (row, rn) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell) => {
      // Skip merged slave-cells (they echo the master value).
      const c = cell as unknown as { isMerged: boolean; master: unknown };
      if (c.isMerged && c.master !== cell) return;
      let v = cell.value;
      if (v && typeof v === "object" && "richText" in v) {
        v = (v.richText as Array<{ text: string }>).map((t) => t.text).join("");
      } else if (v && typeof v === "object" && "formula" in v) {
        v = `=${(v as { formula: string }).formula}`;
      }
      let text = String(v ?? "").replace(/\s+/g, " ").trim();
      if (text.length > 70) text = text.slice(0, 70) + "…";
      if (text) cells.push(`${cell.address}="${text}"`);
    });
    if (cells.length) console.log(`R${rn}| ${cells.join("  ")}`);
  });
});
