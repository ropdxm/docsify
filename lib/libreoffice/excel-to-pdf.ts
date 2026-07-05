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

// Primary engine: the always-warm converter service on Railway (converter/).
// A persistent container converts in ~150 ms; a Vercel cold start could never
// reliably boot the engine inside the function's time budget.
//
// The timeout is deliberately tight: a healthy service answers in ~1 s, and
// every second spent waiting here is a second the local-fallback boot no
// longer has before the route's maxDuration kills the request.
const REMOTE_TIMEOUT_MS = 20_000;

let warnedUnconfigured = false;

async function convertRemotely(xlsx: Buffer): Promise<Buffer | null> {
  const base = process.env.PDF_CONVERTER_URL;
  const token = process.env.PDF_CONVERTER_TOKEN;
  if (!base || !token) {
    if (process.env.VERCEL && !warnedUnconfigured) {
      warnedUnconfigured = true;
      console.warn(
        JSON.stringify({
          level: "warn",
          message:
            "PDF_CONVERTER_URL/PDF_CONVERTER_TOKEN not set - every conversion uses the slow in-function engine",
        })
      );
    }
    return null;
  }

  const started = Date.now();
  const res = await fetch(new URL("/convert?from=xlsx", base), {
    method: "POST",
    headers: {
      "x-convert-token": token,
      "content-type": "application/octet-stream",
    },
    body: new Uint8Array(xlsx),
    signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    throw Object.assign(new Error(`converter service responded ${res.status}`), {
      status: res.status,
    });
  }

  const pdf = Buffer.from(await res.arrayBuffer());
  if (pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("converter service returned an invalid PDF");
  }
  console.log(
    JSON.stringify({
      level: "info",
      message: "excel-to-pdf converted",
      engine: "remote",
      remoteMs: Date.now() - started,
      pdfBytes: pdf.length,
    })
  );
  return pdf;
}

// Fallback engine: LibreOffice WASM inside this function. Booting it
// (compiling the 140 MB WASM + loading 95 MB of data) takes tens of seconds
// to minutes on a serverless vCPU while the conversion itself is ~35 ms, so
// the engine must be booted once per process and reused. The package's
// one-shot convertDocument() boots AND destroys it per call - that is what
// made every download pay the full boot and time out on Vercel.
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
 * Converts an XLSX to PDF with LibreOffice. Tries the warm converter service
 * first (PDF_CONVERTER_URL - our own Railway container, no third-party API);
 * when it is not configured or unreachable, falls back to the in-function
 * WASM engine, which is kept alive between requests.
 */
export async function convertExcelToPdf(xlsx: Buffer): Promise<Buffer> {
  try {
    const remote = await convertRemotely(xlsx);
    if (remote) return remote;
  } catch (error) {
    // 401/403/404 are deterministic misconfiguration (token drift, wrong
    // URL), not a blip: every future conversion will silently pay the slow
    // local path until someone fixes the env vars AND redeploys. Escalate.
    const status = (error as { status?: number }).status;
    const misconfigured = status === 401 || status === 403 || status === 404;
    console.error(
      JSON.stringify({
        level: misconfigured ? "error" : "warn",
        message: misconfigured
          ? "converter service rejected the request - PDF_CONVERTER_URL/PDF_CONVERTER_TOKEN are misconfigured (env changes need a redeploy)"
          : "remote converter failed - falling back to local engine",
        status: status ?? null,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
  return convertLocally(xlsx);
}

// The engine package's memory-error recovery kills + respawns its subprocess
// and clears other in-flight requests without rejecting them (they would hang
// until maxDuration). Conversions are serialized per instance to close that
// window; Vercel Fluid Compute can run several requests on one instance.
let conversionQueue: Promise<unknown> = Promise.resolve();

function enqueueConversion<T>(task: () => Promise<T>): Promise<T> {
  const run = conversionQueue.then(task);
  conversionQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function convertLocally(xlsx: Buffer): Promise<Buffer> {
  const started = Date.now();
  const result = await enqueueConversion(async () => {
    const converter = await getConverter();
    // No-op while the subprocess is alive; respawns it after a crash (the
    // converter marks itself uninitialized when the child exits).
    await converter.initialize();
    return converter.convert(xlsx, { outputFormat: "pdf" }, "document.xlsx");
  });
  const pdf = Buffer.from(result.data);

  if (pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("LibreOffice returned an invalid PDF file");
  }

  console.log(
    JSON.stringify({
      level: "info",
      message: "excel-to-pdf converted",
      engine: "local",
      totalMs: Date.now() - started,
      pdfBytes: pdf.length,
    })
  );
  return pdf;
}
