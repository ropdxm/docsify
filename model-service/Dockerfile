# Self-hosted contract-extraction model for Docsify.
# Ollama (CPU inference on Railway) behind a small token-auth proxy, so uploaded
# договоры are parsed on your own infrastructure and never leave it.
FROM ollama/ollama:latest

# Node runtime + curl for the auth proxy and health probe (Ollama has no auth).
RUN apt-get update \
  && apt-get install -y --no-install-recommends nodejs curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server.mjs start.sh ./
RUN chmod +x start.sh

ENV MODEL_NAME=qwen2.5:3b-instruct \
    OLLAMA_ORIGIN=http://127.0.0.1:11434 \
    PORT=8080
EXPOSE 8080

# Replace the base image's ollama entrypoint - we run our own start script.
ENTRYPOINT []
CMD ["./start.sh"]
