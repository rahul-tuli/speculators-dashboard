#!/bin/bash
# Run the speculators eval harness against an already-running vLLM server.
# Usage: bash run_speculator_eval.sh <port>
# Output: raw eval results in /tmp/eval-out/eval/
set -euo pipefail

PORT="${1:-8000}"
OUT=/tmp/eval-out
VLLM_PYTHON=/workspace/vllm/.venv/bin/python

rm -rf "$OUT"
mkdir -p "$OUT"

# Verify server is healthy
if ! curl -sf "http://localhost:${PORT}/health" > /dev/null 2>&1; then
    echo "ERROR: No vLLM server running on port $PORT"
    exit 1
fi
echo "vLLM server on port $PORT is healthy."

echo "=== Running sweep eval (all subsets) ==="
cd /workspace/speculators/scripts/evaluate
$VLLM_PYTHON evaluate.py \
    --target "http://localhost:${PORT}/v1" \
    --output-dir "$OUT/eval" \
    sweep \
    --max-requests 80 2>&1 | tee "$OUT/evaluate.log" || {
        echo "ERROR: evaluate.py failed. Last log lines:"
        tail -30 "$OUT/evaluate.log"
        exit 1
    }

echo "=== Eval complete ==="
find "$OUT/eval" -name "*.csv" -exec echo "--- {} ---" \; -exec head -3 {} \; 2>/dev/null || true
