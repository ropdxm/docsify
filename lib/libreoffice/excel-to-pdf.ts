import { createRequire } from "node:module";
import path from "node:path";

const nodeRequire = createRequire(import.meta.url);
type ConvertDocument = (
  input: Buffer,
  options: { outputFormat: "pdf" },
  converterOptions: { wasmPath: string }
) => Promise<{ data: Uint8Array }>;
const packageJsonPath = Reflect.apply(nodeRequire.resolve, nodeRequire, [
  "@matbee/libreoffice-converter/package.json",
]) as string;
const packageRoot = path.dirname(packageJsonPath);
const converterModulePath = path.join(packageRoot, "dist", "server.cjs");
const { convertDocument } = Reflect.apply(nodeRequire, undefined, [
  converterModulePath,
]) as { convertDocument: ConvertDocument };
const wasmPath = path.join(packageRoot, "wasm");

/**
 * Converts an XLSX with LibreOffice compiled to WebAssembly. The conversion is
 * fully local to the serverless function: no document is uploaded externally.
 */
export async function convertExcelToPdf(xlsx: Buffer): Promise<Buffer> {
  const result = await convertDocument(
    xlsx,
    { outputFormat: "pdf" },
    { wasmPath }
  );
  const pdf = Buffer.from(result.data);

  if (pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("LibreOffice returned an invalid PDF file");
  }

  return pdf;
}
