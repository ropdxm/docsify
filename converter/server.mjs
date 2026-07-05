// Standalone PDF conversion service (deployed on Railway).
//
// Runs LibreOffice (the same @matbee WASM build the app uses) as a warm,
// long-lived engine inside a persistent container, so a conversion costs
// ~150 ms instead of the multi-minute engine boot that made the Vercel
// serverless route time out.
//
// API:
//   GET  /healthz            → 200 {"ok":true,"warm":true} once the engine is
//                              warm, 503 while booting. Railway's deploy
//                              healthcheck gates traffic cutover on the 200,
//                              so redeploys never route clicks to a cold engine.
//   POST /convert?from=xlsx  → application/pdf                (X-Convert-Token)
//
// The service is stateless and sees only raw spreadsheet bytes - no database
// access, no customer identifiers, no storage.
import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
// Resolves to converter/node_modules in the container, and falls back to the
// repo root node_modules when run locally next to the main app.
const packageRoot = path.dirname(
  require.resolve("@matbee/libreoffice-converter/package.json")
);
const { createSubprocessConverter } = require(
  path.join(packageRoot, "dist", "server.cjs")
);
const wasmPath = path.join(packageRoot, "wasm");

const PORT = Number(process.env.PORT ?? 8080);
const TOKEN = process.env.CONVERT_TOKEN ?? "";
const MAX_BODY_BYTES = 25 * 1024 * 1024;
// Bounds one conversion so a wedged engine can't clog the queue below; the
// engine's own per-conversion timeout (300 s) doesn't fire in every path.
const CONVERT_DEADLINE_MS = 120_000;
const INPUT_FORMATS = new Set(["xlsx", "xls", "ods", "docx", "doc", "odt"]);

if (!TOKEN) {
  console.error("CONVERT_TOKEN env var is required");
  process.exit(1);
}

let converterPromise = null;
let warm = false;

function getConverter() {
  if (!converterPromise) {
    converterPromise = createSubprocessConverter({
      wasmPath,
      maxInitRetries: 2,
      // Surfaces the engine subprocess's own stdout/stderr in Railway logs.
      verbose: process.env.CONVERT_VERBOSE === "1",
    }).then(
      (converter) => {
        warm = true;
        return converter;
      },
      (error) => {
        converterPromise = null; // a failed boot must not poison later requests
        throw error;
      }
    );
  }
  return converterPromise;
}

// The engine package's memory-error recovery kills + respawns its subprocess
// and clears OTHER in-flight requests without rejecting them - they would
// hang forever. LibreOffice conversions aren't meant to overlap anyway, so
// they are serialized here.
let conversionQueue = Promise.resolve();

function enqueueConversion(task) {
  const run = conversionQueue.then(task);
  conversionQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function withDeadline(promise, ms, label) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} exceeded ${ms} ms`)),
      ms
    );
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

// Node's HTTP parser accepts request targets the WHATWG URL parser rejects
// (e.g. "//["); an unguarded `new URL(req.url, ...)` would throw synchronously
// in the request handler and crash the process - pre-auth.
function requestUrl(req) {
  try {
    return new URL(req.url, "http://localhost");
  } catch {
    return null;
  }
}

function authorized(req) {
  const got = req.headers["x-convert-token"];
  if (typeof got !== "string" || got.length === 0) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("body too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", () =>
      reject(Object.assign(new Error("request aborted"), { status: 400 }))
    );
  });
}

function sendJson(res, status, body) {
  if (res.destroyed || res.writableEnded) return;
  try {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  } catch {
    /* client already gone */
  }
}

async function handleConvert(req, res, url) {
  if (!authorized(req)) return sendJson(res, 401, { error: "unauthorized" });

  const from = url.searchParams.get("from") ?? "xlsx";
  if (!INPUT_FORMATS.has(from)) {
    return sendJson(res, 400, { error: `unsupported input format: ${from}` });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    return sendJson(res, error.status ?? 400, { error: error.message });
  }
  if (body.length === 0) return sendJson(res, 400, { error: "empty body" });

  const started = Date.now();
  try {
    const result = await enqueueConversion(async () => {
      const converter = await getConverter();
      // No-op while the engine subprocess is alive; respawns after a crash.
      await converter.initialize();
      return withDeadline(
        converter.convert(body, { outputFormat: "pdf" }, `document.${from}`),
        CONVERT_DEADLINE_MS,
        "conversion"
      );
    });
    const pdf = Buffer.from(result.data);
    if (pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new Error("engine returned an invalid PDF");
    }

    console.log(
      JSON.stringify({
        level: "info",
        message: "converted",
        from,
        inBytes: body.length,
        outBytes: pdf.length,
        totalMs: Date.now() - started,
      })
    );
    if (res.destroyed || res.writableEnded) return;
    res.writeHead(200, {
      "content-type": "application/pdf",
      "content-length": pdf.length,
    });
    res.end(pdf);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "conversion failed",
        error: error instanceof Error ? error.message : String(error),
      })
    );
    sendJson(res, 500, { error: "conversion failed" });
  }
}

const server = http.createServer((req, res) => {
  const url = requestUrl(req);
  if (!url) return sendJson(res, 400, { error: "bad request target" });
  if (req.method === "GET" && url.pathname === "/healthz") {
    // 200 only once warm: Railway's deploy healthcheck keeps probing (and
    // keeps traffic on the previous container) until the engine is ready.
    return sendJson(res, warm ? 200 : 503, { ok: true, warm });
  }
  if (req.method === "POST" && url.pathname === "/convert") {
    return void handleConvert(req, res, url);
  }
  sendJson(res, 404, { error: "not found" });
});

server.on("clientError", (_error, socket) => {
  try {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  } catch {
    /* socket already gone */
  }
});

server.listen(PORT, () => {
  console.log(
    JSON.stringify({ level: "info", message: "listening", port: PORT })
  );
  // Boot the engine right away: /healthz flips to 200 (and Railway cuts
  // traffic over) only when this finishes.
  const started = Date.now();
  getConverter()
    .then(() =>
      console.log(
        JSON.stringify({
          level: "info",
          message: "engine warm",
          bootMs: Date.now() - started,
        })
      )
    )
    .catch((error) =>
      console.error(
        JSON.stringify({
          level: "error",
          message: "engine warm-up failed (will retry on first request)",
          error: error instanceof Error ? error.message : String(error),
        })
      )
    );
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    // Railway's drainingSeconds (railway.json) gives in-flight conversions
    // this window before SIGKILL; don't hang redeploys longer than that.
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
