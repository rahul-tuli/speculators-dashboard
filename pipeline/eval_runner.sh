#!/usr/bin/env bash
# Runner script for manual evals: serves vLLM, polls /health, runs evaluate.py, copies results, cleans up.
# Usage:
#   pipeline/eval_runner.sh <slug> <port> <cuda_devices> <raw_dir> <deploy_cmd...>

set -eo pipefail

SLUG="$1"
PORT="$2"
CUDA_DEVICES="$3"
RAW_DIR="$4"
shift 4
DEPLOY_CMD=("$@")

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$REPO_ROOT/local/eval-manual.env"
export PATH="$VLLM_VENV/bin:$PATH"
export HF_HOME="${HF_HOME:-/data/fast/huggingface}"

LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR" "$RAW_DIR"
LOG_FILE="$LOG_DIR/eval-manual-$SLUG.log"
TMP_OUT=$(mktemp -d "/tmp/eval-$SLUG-XXXXXX")

echo "=== Eval Runner for $SLUG ===" | tee -a "$LOG_FILE"
echo "Port: $PORT" | tee -a "$LOG_FILE"
echo "CUDA_VISIBLE_DEVICES: $CUDA_DEVICES" | tee -a "$LOG_FILE"
echo "Deploy Command: ${DEPLOY_CMD[*]}" | tee -a "$LOG_FILE"
echo "Raw Dir: $RAW_DIR" | tee -a "$LOG_FILE"
echo "TMP_OUT: $TMP_OUT" | tee -a "$LOG_FILE"

# Start vllm serve
export CUDA_VISIBLE_DEVICES="$CUDA_DEVICES"
echo "Starting vLLM server..." | tee -a "$LOG_FILE"

"${DEPLOY_CMD[@]}" >> "$LOG_FILE" 2>&1 &
VLLM_PID=$!
echo "vLLM PID: $VLLM_PID" | tee -a "$LOG_FILE"

cleanup() {
    echo "Cleaning up vLLM process $VLLM_PID..." | tee -a "$LOG_FILE"
    kill -TERM "$VLLM_PID" 2>/dev/null || true
    sleep 5
    kill -9 "$VLLM_PID" 2>/dev/null || true
    wait "$VLLM_PID" 2>/dev/null || true
    rm -rf "$TMP_OUT"
}
trap cleanup EXIT

# Poll health
echo "Waiting for vLLM server on port $PORT to become ready (up to 40 min)..." | tee -a "$LOG_FILE"
READY=0
for i in $(seq 1 480); do
    if curl -sf "http://localhost:${PORT}/health" > /dev/null 2>&1; then
        READY=1
        break
    fi
    if ! kill -0 "$VLLM_PID" 2>/dev/null; then
        echo "ERROR: vLLM server died unexpectedly!" | tee -a "$LOG_FILE"
        tail -n 40 "$LOG_FILE"
        exit 1
    fi
    sleep 5
done

if [ "$READY" -ne 1 ]; then
    echo "ERROR: vLLM server timed out waiting for health check" | tee -a "$LOG_FILE"
    tail -n 40 "$LOG_FILE"
    exit 1
fi

echo "vLLM server is healthy and ready!" | tee -a "$LOG_FILE"

# Run evaluate.py
echo "Running evaluation sweep..." | tee -a "$LOG_FILE"
cd "$SPECULATORS_DIR/scripts/evaluate"
PATH="$GUIDELLM_VENV/bin:$PATH" "$GUIDELLM_VENV/bin/python" evaluate.py \
    --target "http://localhost:${PORT}/v1" \
    --output-dir "$TMP_OUT" \
    --max-requests 80 \
    sweep >> "$LOG_FILE" 2>&1 || {
        echo "ERROR: evaluate.py sweep failed!" | tee -a "$LOG_FILE"
        tail -n 40 "$LOG_FILE"
        exit 1
    }

echo "Evaluation sweep finished successfully. Copying results to $RAW_DIR..." | tee -a "$LOG_FILE"
rm -rf "$RAW_DIR"/*
cp -r "$TMP_OUT"/* "$RAW_DIR"/
echo "Files copied to $RAW_DIR:" | tee -a "$LOG_FILE"
ls -la "$RAW_DIR" | tee -a "$LOG_FILE"

echo "=== SUCCESS: Eval for $SLUG completed ===" | tee -a "$LOG_FILE"
