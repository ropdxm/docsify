#!/bin/sh
# Boot Ollama, pull the model in the background, and run the auth proxy up front.
set -eu

MODEL="${MODEL_NAME:-qwen2.5:7b-instruct}"

# Ollama daemon in the background.
ollama serve &

# Wait for the daemon, then pull the model. The pull runs in the background so
# the proxy (and /healthz) come up immediately; /healthz stays 503 until the
# model is present. With a volume mounted at /root/.ollama the pull is a no-op
# on restarts.
(
  until curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; do
    sleep 1
  done
  echo "ollama up; pulling ${MODEL} ..."
  ollama pull "${MODEL}"
  echo "model ${MODEL} ready"
) &

# Auth proxy in the foreground.
exec node server.mjs
