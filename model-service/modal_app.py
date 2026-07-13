# Serverless GPU model for Docsify contract extraction (replaces the Railway
# Ollama setup — Railway CPU was ~10x too slow for a 3B model).
#
# Runs Qwen2.5-3B-Instruct via vLLM in OpenAI-compatible mode on a Modal GPU,
# scale-to-zero: you pay only per request (~sub-cent per contract), $0 when idle.
# The Docsify app calls  POST {MODEL_SERVICE_URL}/v1/chat/completions  with
# Authorization: Bearer <token>; vLLM enforces the token via --api-key. Contracts
# are processed on GPUs you rent per-request and never touch a third-party AI vendor.
#
# One-time setup:
#   pip install modal
#   modal setup                                   # links your (free) Modal account
#   modal secret create docsify-model-key MODEL_API_KEY=<the token>
#   modal deploy model-service/modal_app.py       # prints your https URL
#
# Then hand the URL back to wire into Vercel.

import os

import modal

# HuggingFace repo id. Swap to "Qwen/Qwen2.5-7B-Instruct" for higher accuracy
# (fits the L4 fine; slightly slower + a longer cold start).
MODEL_NAME = "Qwen/Qwen2.5-3B-Instruct"
VLLM_PORT = 8000
MINUTES = 60

# CUDA base + vLLM. Pinned to a known-good vLLM release.
vllm_image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.9.0-devel-ubuntu22.04", add_python="3.12"
    )
    .entrypoint([])
    .uv_pip_install("vllm==0.21.0")
    .env({"HF_XET_HIGH_PERFORMANCE": "1"})
)

# Cache model weights + vLLM compile artifacts so cold starts don't re-download.
hf_cache_vol = modal.Volume.from_name("huggingface-cache", create_if_missing=True)
vllm_cache_vol = modal.Volume.from_name("vllm-cache", create_if_missing=True)

app = modal.App("docsify-vllm")


@app.server(
    image=vllm_image,
    gpu="L4",  # 24GB Ada — cheap ($0.80/hr) and plenty for 3B (or 7B). "T4" is cheaper.
    scaledown_window=10 * MINUTES,  # stay warm 10 min after the last request, then scale to zero
    startup_timeout=10 * MINUTES,  # first boot downloads the model (~6GB) into the volume
    volumes={
        "/root/.cache/huggingface": hf_cache_vol,
        "/root/.cache/vllm": vllm_cache_vol,
    },
    secrets=[modal.Secret.from_name("docsify-model-key")],
    port=VLLM_PORT,
    routing_region="us-east",  # near Vercel prod (iad1)
    target_concurrency=8,
    unauthenticated=True,  # Modal layer is open; vLLM's --api-key is the real auth
)
class Server:
    @modal.enter()
    def start(self):
        import subprocess

        api_key = os.environ["MODEL_API_KEY"]
        cmd = [
            "vllm", "serve", MODEL_NAME,
            "--served-model-name", MODEL_NAME,
            "--host", "0.0.0.0",
            "--port", str(VLLM_PORT),
            "--api-key", api_key,
            "--max-model-len", "16384",  # room for a full contract (Cyrillic tokenizes dense) + output
            "--enforce-eager",  # faster cold starts; we scale to zero so boot latency matters more than peak throughput
        ]
        # log the command without leaking the key
        print("launching:", " ".join(c for c in cmd if c != api_key))
        self.process = subprocess.Popen(cmd)

    @modal.exit()
    def stop(self):
        self.process.terminate()
