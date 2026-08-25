#!/bin/bash
# Run a baseline (autoregressive) eval for a target model on this machine.
# Usage: bash run_baseline.sh <target_model> <num_gpus>
# Output: prints throughput value on the last line as "BASELINE_TPS=<value>"
set -euo pipefail

MODEL="$1"
GPUS="$2"
PORT=8000
OUT=/tmp/baseline-out
VLLM_PYTHON=/workspace/vllm/.venv/bin/python

rm -rf "$OUT"
mkdir -p "$OUT"

# Kill any existing vllm server on the port
pkill -f "vllm.entrypoints" 2>/dev/null || true
sleep 2

SERVE_ARGS=(--port "$PORT")
if [ "$GPUS" -gt 1 ]; then
    SERVE_ARGS+=(-tp "$GPUS")
fi

echo "=== Launching baseline: vllm serve $MODEL ${SERVE_ARGS[*]} ==="
$VLLM_PYTHON -m vllm.entrypoints.openai.api_server --model "$MODEL" "${SERVE_ARGS[@]}" > "$OUT/vllm.log" 2>&1 &
VLLM_PID=$!

cleanup() {
    kill "$VLLM_PID" 2>/dev/null || true
    wait "$VLLM_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "Waiting for vLLM server (PID $VLLM_PID)..."
READY=0
for i in $(seq 1 480); do
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
    echo "ERROR: vLLM server did not become ready in 40 min"
    tail -50 "$OUT/vllm.log"
    exit 1
fi
echo "vLLM server ready."

echo "=== Running baseline throughput measurement ==="
guidellm run \
    --backend "kind=openai_http,target=http://localhost:${PORT}/v1,max_tokens=4096" \
    --data "kind=huggingface,source=RedHatAI/speculator_benchmarks,load_kwargs.data_files=HumanEval.jsonl,load_kwargs.split=train" \
    --data-column-mapper "kind=generative_column_mapper,column_mappings.text_column=prompt" \
    --profile "kind=throughput,max_concurrency=128" \
    --constraint "kind=max_requests,count=80" \
    --output "kind=json,path=$OUT/baseline.json" > "$OUT/guidellm.log" 2>&1 || {
        echo "ERROR: guidellm failed. Last log lines:"
        tail -30 "$OUT/guidellm.log"
        exit 1
    }

echo "=== Extracting throughput ==="
TPS=$($VLLM_PYTHON -c "
import json
with open('$OUT/baseline.json') as f:
    data = json.load(f)
benchmarks = data.get('benchmarks', [])
# Find throughput strategy benchmark
for bm in benchmarks:
    strategy = bm.get('config', {}).get('strategy', {})
    if strategy.get('type_', '') == 'throughput':
        tps = bm.get('metrics', {}).get('output_tokens_per_second', {}).get('successful', {}).get('median', 0)
        print(f'{tps:.2f}')
        break
else:
    # fallback: just take the first benchmark
    if benchmarks:
        tps = benchmarks[0].get('metrics', {}).get('output_tokens_per_second', {}).get('successful', {}).get('median', 0)
        print(f'{tps:.2f}')
    else:
        print('0.00')
")

echo "=== Baseline eval complete ==="
echo "BASELINE_TPS=$TPS"
