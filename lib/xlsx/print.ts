import type ExcelJS from "exceljs";

/**
 * Print layout shared by the structured-document renderers (АВР, накладная).
 *
 * Why hiding the columns right of the form matters: the official Минфин
 * templates carry leftover helper cells with styles (and even stray strings)
 * far to the right of the form - e.g. the АВР form ends at column AW, but
 * styled cells run out to BE. Those phantom cells extend the sheet's used
 * range, and with fitToWidth=1 LibreOffice scales that WHOLE range to one
 * page across, so the form itself printed at ~70% and the page looked
 * shrunken. Hidden columns are excluded from printing, so fit-to-width then
 * only has to fit the real form, which prints at (near) full size.
 *
 * An explicit print area would achieve the same, but ExcelJS emits mangled
 * print-area defined names for these templates (Excel then reports the file
 * as corrupt), so the print metadata is dropped instead - see the callers.
 */
export function configurePrintLayout(
  ws: ExcelJS.Worksheet,
  lastFormColumn: number
): void {
  // Defensive: a print area / print titles (defined names) plus a
  // printer-driven page setup make ExcelJS emit a mangled print-area
  // reference and a bogus DPI (4294967295), which Excel rejects as corrupt
  // ("Replaced Part: sheet1.xml"). Drop the print metadata, normalise the DPI.
  ws.pageSetup.printArea = undefined;
  ws.pageSetup.printTitlesRow = undefined;
  ws.pageSetup.horizontalDpi = 300;
  ws.pageSetup.verticalDpi = 300;

  ws.pageSetup.paperSize = 9; // A4
  ws.pageSetup.orientation = "landscape";
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 0;
  // The form grids are a touch wider than a landscape A4 at 100%, and the
  // templates' wide 0.7" margins forced an extra shrink on top. Narrow
  // margins keep the fitted form at (near) full size; top-anchor it so a
  // short act reads as a normal document rather than a block floating in
  // the middle of the page.
  ws.pageSetup.margins = {
    left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0.2, footer: 0.2,
  };
  ws.pageSetup.horizontalCentered = true;
  ws.pageSetup.verticalCentered = false;

  // Hide the phantom columns (see above). The bound is generous on purpose:
  // ws.columnCount only counts explicitly defined columns, while stray styled
  // cells may sit further right (АВР: BE, накладная: BF).
  const lastUsedColumn = Math.max(ws.columnCount, lastFormColumn + 15);
  for (let col = lastFormColumn + 1; col <= lastUsedColumn; col++) {
    ws.getColumn(col).hidden = true;
  }
}
