import { createRequire } from "node:module";
import path from "node:path";

const nodeRequire = createRequire(import.meta.url);
type SubprocessConverter = {
  initialize(): Promise<void>;
  convert(
    input: Buffer,
    options: { outputFormat: "pdf" },
    filename?: string
  ): Promise<{ data: Uint8Array }>;
};
type CreateSubprocessConverter = (options: {
  wasmPath: string;
  maxInitRetries?: number;
}) => Promise<SubprocessConverter>;
const packageRoot = path.join(
  process.cwd(),
  "node_modules",
  "@matbee",
  "libreoffice-converter"
);
const converterModulePath = path.join(packageRoot, "dist", "server.cjs");
const { createSubprocessConverter } = Reflect.apply(nodeRequire, undefined, [
  converterModulePath,
]) as { createSubprocessConverter: CreateSubprocessConverter };
const wasmPath = path.join(packageRoot, "wasm");

// Booting LibreOffice (compiling the 140 MB WASM + loading 95 MB of data)
// takes tens of seconds on a serverless vCPU while the conversion itself is
// ~35 ms, so the engine must be booted once per process and reused. The
// package's one-shot convertDocument() boots AND destroys it per call - that
// is what made every download pay the full boot and time out on Vercel.
let converterPromise: Promise<SubprocessConverter> | null = null;

function getConverter(): Promise<SubprocessConverter> {
  if (!converterPromise) {
    converterPromise = createSubprocessConverter({
      wasmPath,
      maxInitRetries: 2,
    }).catch((error: unknown) => {
      converterPromise = null; // a failed boot must not poison later requests
      throw error;
    });
  }
  return converterPromise;
}

/**
 * Converts an XLSX with LibreOffice compiled to WebAssembly. The conversion is
 * fully local to the serverless function: no document is uploaded externally.
 * The LibreOffice subprocess is kept alive between requests; on Vercel Fluid
 * Compute a warm instance converts in well under a second.
 */
export async function convertExcelToPdf(xlsx: Buffer): Promise<Buffer> {
  const started = Date.now();
  const converter = await getConverter();
  // No-op while the subprocess is alive; respawns it after a crash (the
  // converter marks itself uninitialized when the child exits).
  await converter.initialize();
  const bootMs = Date.now() - started;

  const result = await converter.convert(
    xlsx,
    { outputFormat: "pdf" },
    "document.xlsx"
  );
  const pdf = Buffer.from(result.data);

  if (pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("LibreOffice returned an invalid PDF file");
  }

  console.log(
    JSON.stringify({
      level: "info",
      message: "excel-to-pdf converted",
      bootMs,
      convertMs: Date.now() - started - bootMs,
      pdfBytes: pdf.length,
    })
  );
  return pdf;
}
