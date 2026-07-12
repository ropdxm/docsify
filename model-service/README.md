# Contract-extraction model service

A self-hosted open-source LLM that reads an uploaded договор (PDF/Word, already
turned into text by the app) and returns the client + line items used to prefill
an **АВР** or **накладная** draft. It runs **[Ollama](https://ollama.com)** behind
a tiny token-auth proxy so contracts are parsed on **your own infrastructure and
never leave it**.

```
Docsify app  ──POST /v1/chat/completions (Bearer MODEL_TOKEN)──►  server.mjs  ──►  Ollama (localhost)
 lib/contract-extract.ts                                          (this service)
```

## Why this shape

- **Ollama has no auth.** `server.mjs` is the only public surface: it checks the
  Bearer token, then forwards the OpenAI-compatible chat request to Ollama on
  localhost. Nothing else is exposed.
- **Railway has no GPU** — inference is CPU-only, which is fine for a small model
  doing extraction. Default model: `qwen2.5:3b-instruct` - fast enough on CPU
  (~15s per contract). `qwen2.5:7b-instruct` is more accurate but only ~4 tok/s on
  CPU (times out on real contracts), so reserve it for a GPU host.

## Deploy to Railway

1. **New service** → Deploy from repo, root directory `model-service/` (Dockerfile
   build is auto-detected via `railway.json`).
2. **Variables:**
   - `MODEL_TOKEN` — a long random secret. The app must send the same value as
     `MODEL_SERVICE_TOKEN`.
   - `MODEL_NAME` - optional, defaults to `qwen2.5:3b-instruct` (fast on CPU).
     `qwen2.5:7b-instruct` is more accurate but needs a GPU to be usable.
3. **Volume:** add a volume mounted at **`/root/.ollama`** so the pulled model
   (~4-5 GB) persists across restarts instead of re-downloading.
4. **Resources:** give it **~4 GB RAM** for `qwen2.5:3b-instruct` (~8 GB for 7b).
   First deploy pulls the model - it can take a few minutes; `/healthz` stays
   `503` until the model is ready, then flips to `200`.
5. **Networking:** enable a public domain. Copy that URL.

## Wire it into the app

In the Docsify app's `.env` (server-only — never `NEXT_PUBLIC_`):

```
MODEL_SERVICE_URL=https://<your-service>.up.railway.app
MODEL_SERVICE_TOKEN=<the same value as MODEL_TOKEN>
MODEL_NAME=qwen2.5:3b-instruct
```

Restart the app (Next reads `.env` at boot). When these are unset the
"Загрузить договор" button reports that extraction is not connected.

## Smoke test

```sh
# Health (200 once the model is pulled)
curl -i https://<your-service>.up.railway.app/healthz

# Extraction call
curl -sS https://<your-service>.up.railway.app/v1/chat/completions \
  -H "authorization: Bearer $MODEL_TOKEN" \
  -H "content-type: application/json" \
  -d '{"model":"qwen2.5:3b-instruct","messages":[{"role":"user","content":"Верни JSON {\"ok\":true}"}],"response_format":{"type":"json_object"}}'
```

## Local run (optional)

```sh
# Requires Ollama installed locally.
ollama pull qwen2.5:3b-instruct
MODEL_TOKEN=dev-secret PORT=8080 node server.mjs
# then point the app at http://localhost:8080
```
