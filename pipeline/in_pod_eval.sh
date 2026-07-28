#!/bin/bash
# Runs INSIDE the devenv eval pod (piped via `oc exec -i ... -- bash -s`).
# Serves a speculator model with vLLM and runs the speculators eval harness.
#
# Usage: bash in_pod_eval.sh <model_id> <gpus> <algorithm>
set -euo pipefail

MODEL="$1"
GPUS="$2"
ALGO="$3"
OUT=/tmp/eval-out
PORT=8000

rm -rf "$OUT"
mkdir -p "$OUT"

# Prefer the pre-built vllm workspace venv; fall back to whatever is on PATH.
for V in /workspace/vllm/.venv /workspace/speculators/.venv; do
    if [ -f "$V/bin/activate" ]; then
        echo "Using venv: $V"
        # shellcheck disable=SC1090
        source "$V/bin/activate"
        break
    fi
done

python -c "import speculators" 2>/dev/null || pip install -q -e /workspace/speculators
command -v guidellm >/dev/null 2>&1 || pip install -q guidellm

SERVE_ARGS=(--port "$PORT")
if [ "$GPUS" -gt 1 ]; then
    SERVE_ARGS+=(-tp "$GPUS")
fi
if [ "$ALGO" = "mtp" ]; then
    SERVE_ARGS+=(--no-enable-chunked-prefill)
fi

echo "=== Launching: vllm serve $MODEL ${SERVE_ARGS[*]} ==="
vllm serve "$MODEL" "${SERVE_ARGS[@]}" > "$OUT/vllm.log" 2>&1 &
VLLM_PID=$!

cleanup() {
    kill "$VLLM_PID" 2>/dev/null || true
    wait "$VLLM_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "Waiting for vLLM server (up to 40 min for large models)..."
READY=0
for _ in $(seq 1 480); do
    if curl -sf "http://localhost:${PORT}/health" > /dev/null 2>&1; then
        READY=1
        break
    fi
    if ! kill -0 "$VLLM_PID" 2>/dev/null; then
        echo "ERROR: vLLM server died. Last log lines:"
        tail -50 "$OUT/vllm.log"
        exit 1
    fi
    sleep 5
done
if [ "$READY" != "1" ]; then
    echo "ERROR: vLLM server did not become ready in time"
    tail -50 "$OUT/vllm.log"
    exit 1
fi
echo "vLLM server ready."

echo "=== Running sweep eval (all subsets) ==="
python /workspace/speculators/scripts/evaluate/evaluate.py \
    --target "http://localhost:${PORT}/v1" \
    --output-dir "$OUT/eval" \
    sweep \
    --max-requests 80 > "$OUT/evaluate.log" 2>&1 || {
        echo "ERROR: evaluate.py failed. Last log lines:"
        tail -30 "$OUT/evaluate.log"
        exit 1
    }

echo "=== Eval complete ==="
ls -lR "$OUT/eval"
