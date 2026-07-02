import { renderAvrXlsx } from "@/lib/xlsx/avr";
import { renderInvoiceXlsx, type XlsxDoc } from "@/lib/xlsx/invoice";
import { renderNakladnajaXlsx } from "@/lib/xlsx/nakladnaja";

export async function renderDocumentXlsx(doc: XlsxDoc): Promise<Buffer> {
  switch (doc.type) {
    case "avr":
      return renderAvrXlsx(doc);
    case "nakladnaja":
      return renderNakladnajaXlsx(doc);
    case "invoice":
      return renderInvoiceXlsx(doc);
  }
}
