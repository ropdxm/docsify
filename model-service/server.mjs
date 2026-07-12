// Tiny token-auth proxy in front of a local Ollama.
//
// Ollama itself has no authentication, so we never expose it directly. This
// process is the only public surface: it accepts the OpenAI-compatible
// POST /v1/chat/completions (with a Bearer token) and forwards it to Ollama on
// localhost. /healthz reports ready only once the target model is pulled, so
// Railway keeps traffic off the service until it can actually answer.
//
// Env:
//   MODEL_TOKEN   shared secret the Docsify app must send (Authorization: Bearer)
//   MODEL_NAME    model to require for readiness (default qwen2.5:7b-instruct)
//   PORT          listen port (Railway injects this)
//   OLLAMA_ORIGIN local Ollama origin (default http://127.0.0.1:11434)

import http from "node:http";
import { timingSafeEqual } from "node:crypto";

const PORT = Number(process.env.PORT || 8080);
const TOKEN = process.env.MODEL_TOKEN || "";
const MODEL_NAME = process.env.MODEL_NAME || "qwen2.5:7b-instruct";
const OLLAMA = process.env.OLLAMA_ORIGIN || "http://127.0.0.1:11434";
const MAX_BODY = 2 * 1024 * 1024; // 2 MB of contract text is plenty

function tokenOk(header) {
  const provided = String(header || "").replace(/^Bearer\s+/i, "");
  if (!TOKEN || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

// Ready only when Ollama is up AND the required model has been pulled.
function checkReady(res) {
  const req = http.get(`${OLLAMA}/api/tags`, (r) => {
    let body = "";
    r.on("data", (c) => (body += c));
    r.on("end", () => {
      let ready = false;
      try {
        const tags = JSON.parse(body);
        ready =
          Array.isArray(tags.models) &&
          tags.models.some((m) => (m.name || m.model || "") === MODEL_NAME);
      } catch {
        /* not ready */
      }
      send(res, ready ? 200 : 503, ready ? "ok" : "warming");
    });
  });
  req.on("error", () => send(res, 503, "warming"));
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/healthz") {
    return checkReady(res);
  }

  // Only the OpenAI-compatible chat endpoint is exposed, token-gated.
  if (req.method === "POST" && req.url && req.url.startsWith("/v1/")) {
    if (!tokenOk(req.headers["authorization"])) {
      return send(res, 401, { error: "unauthorized" });
    }
    let size = 0;
    let aborted = false;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY && !aborted) {
        aborted = true;
        send(res, 413, { error: "payload too large" });
        req.destroy();
      }
    });

    const target = new URL(req.url, OLLAMA);
    const upstream = http.request(
      target,
      { method: "POST", headers: { "content-type": "application/json" } },
      (up) => {
        res.writeHead(up.statusCode || 502, {
          "content-type": up.headers["content-type"] || "application/json",
        });
        up.pipe(res);
      }
    );
    upstream.on("error", () => {
      if (!res.headersSent) send(res, 502, { error: "upstream unavailable" });
      else res.end();
    });
    req.pipe(upstream);
    return;
  }

  send(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`model proxy listening on :${PORT} -> ${OLLAMA} (model ${MODEL_NAME})`);
});
