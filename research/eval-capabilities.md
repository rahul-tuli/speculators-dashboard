# Eval Capabilities Research

> Research for wayfinder map issue #2.
> Investigated 2026-07-28.

## 1. What the speculators eval harness produces today

The eval harness lives at `scripts/evaluate/evaluate.py` in [vllm-project/speculators](https://github.com/vllm-project/speculators).

### CLI modes

| Mode | Purpose |
|------|---------|
| `throughput` | Max-rate run to collect **acceptance rate** metrics only |
| `sweep` | Full benchmarking pipeline: estimate generation length, multi-rate sweep, output latency + throughput CSVs |

### Output files

| File | Produced by | Contents |
|------|------------|----------|
| `acceptance.csv` | Both modes | Per-subset rows with: `subset`, `num_drafts`, `num_draft_tokens`, `num_accepted_tokens`, `acceptance_length`, `acceptance_at_pos_0`, `acceptance_at_pos_1`, ... |
| `perf_results.csv` | `sweep` mode only | Per-rate-point rows with: `subset`, `strategy`, `target_rate`, `rps_median`, `latency_median_s`, `itl_median_ms`, `ttft_median_ms`, `output_tps_median`, `total_output_tokens`, plus the acceptance columns |
| `max_tokens.json` | `sweep` mode only | Estimated generation length per subset |

### Metrics breakdown

**Acceptance metrics** (from vLLM Prometheus `/metrics` endpoint, via `extract_spec_decode_metrics` in `perf_utils.py`):

- `num_drafts` -- total speculative draft attempts
- `num_draft_tokens` -- total draft tokens proposed
- `num_accepted_tokens` -- total tokens accepted
- `acceptance_length` -- computed as `1 + accepted / drafts`
- `acceptance_at_pos_N` -- per-position acceptance rate (count / drafts), variable N based on `num_speculative_tokens`

**Performance metrics** (sweep mode only, from guidellm output):

- `rps_median` -- requests per second (median)
- `latency_median_s` -- end-to-end request latency (median, seconds)
- `itl_median_ms` -- inter-token latency (median, milliseconds)
- `ttft_median_ms` -- time to first token (median, milliseconds)
- `output_tps_median` -- output tokens per second (median)
- `total_output_tokens` -- total output tokens generated

### Available benchmark datasets

**Default dataset**: `RedHatAI/speculator_benchmarks` on HuggingFace.

**Default subsets** (9):
`HumanEval`, `math_reasoning`, `qa`, `question`, `rag`, `summarization`, `tool_call`, `translation`, `writing`

**SPEED-Bench**: Also supported via `--dataset speedbench/<config>` (requires `prepare_speedbench.py` preprocessing). Includes qualitative and throughput configurations at multiple entropy levels.

Custom datasets can be specified via `--dataset` and `--subsets` flags.

## 2. What the local pipeline captures

### Current invocation (`in_pod_eval.sh`, line 70-79)

```bash
python /workspace/speculators/scripts/evaluate/evaluate.py \
    --target "http://localhost:${PORT}/v1" \
    --output-dir "$OUT/eval" \
    throughput \
    --subsets "HumanEval,qa" \
    --max-requests 80
```

The pipeline uses the `throughput` mode. This produces **only `acceptance.csv`**. No `perf_results.csv` is generated because `sweep` mode is not invoked.

### What normalize.py extracts

`parse_acceptance()` reads `acceptance.csv` and produces:

- Per-subset: `acceptance_length`, `acceptance_at_pos` (list), `num_drafts`, `num_draft_tokens`, `num_accepted_tokens`
- Top-level: weighted-average `acceptance_length` and `acceptance_at_pos`, total `num_drafts`

**No throughput metrics** are parsed or stored.

### Schema (`schema/results.json`)

The schema defines `metrics` as:
```
acceptance_length, acceptance_at_pos[], num_drafts, subsets{}
```
Each subset has: `acceptance_length, acceptance_at_pos[], num_drafts, num_draft_tokens, num_accepted_tokens`.

There are **no fields for throughput, latency, TTFT, or ITL**.

## 3. Acceptance_at_pos aggregation issue

The top-level `acceptance_at_pos` values in `results.json` are all exactly `0.95` for every model, while per-subset values vary (e.g., 0.9219 and 0.965 for position 0 across two subsets). Verification shows the weighted average should be ~0.9434, not 0.95.

**Root cause**: The current `results.json` contains hand-crafted dummy data (git log: "Add dummy eval results for dashboard preview"). The top-level `acceptance_at_pos` values were set to a flat 0.95 instead of being computed from subset data.

**The normalize.py aggregation logic is correct.** It computes weighted averages properly:
```python
weighted_pos[k] += f(row, k) * drafts
# ...
round(weighted_pos[k] / total_drafts, 4)
```

Once real eval runs produce data, the top-level values will correctly reflect weighted averages of per-subset rates.

## 4. What guidellm provides

[guidellm](https://github.com/neuralmagic/guidellm) (part of the vLLM project, `~=0.7.1` required) is an SLO-aware benchmarking platform. It:

- Sends requests to OpenAI-compatible servers with configurable traffic patterns (synchronous, concurrent, throughput, constant-rate, Poisson, sweep)
- Measures: TTFT, ITL, end-to-end latency, requests/sec, output tokens/sec
- Outputs: JSON, CSV, HTML reports
- Supports HuggingFace datasets, local files, synthetic data, trace replay

The speculators eval harness uses guidellm as its workload driver. In `throughput` mode, guidellm generates max-rate traffic but only acceptance metrics are captured. In `sweep` mode, guidellm's full performance metrics are parsed and written to `perf_results.csv`.

## 5. What it would take to add throughput measurement

### Option A: Switch to `sweep` mode (lowest effort)

Change `in_pod_eval.sh` from `throughput` to `sweep`:

```bash
python evaluate.py \
    --target "http://localhost:${PORT}/v1" \
    --output-dir "$OUT/eval" \
    sweep \                          # <-- change from throughput
    --subsets "HumanEval,qa" \
    --max-requests 80
```

This produces `perf_results.csv` alongside `acceptance.csv`. Then:

1. **Extend `normalize.py`** to also parse `perf_results.csv` and extract `output_tps_median`, `latency_median_s`, `itl_median_ms`, `ttft_median_ms`.
2. **Extend the schema** to add optional throughput fields to `metrics` and `subset`.
3. **Extend the dashboard** to display the new metrics.

Trade-off: `sweep` runs a multi-rate ramp, which takes significantly longer than a single max-rate burst. Eval pod time (and GPU cost) increases substantially.

### Option B: Add a separate throughput-only run (moderate effort)

Keep the current `throughput` mode for acceptance rates, then add a second guidellm run targeting just throughput:

```bash
guidellm \
    --backend "kind=openai_http,target=http://localhost:${PORT}/v1,max_tokens=256" \
    --data "hf://RedHatAI/speculator_benchmarks" \
    --profile throughput \
    --max-requests 80 \
    --output "$OUT/throughput.json"
```

Then parse the output JSON for `output_tokens_per_second`. This gives throughput numbers without a full sweep. But it requires a second benchmarking pass per model.

### Option C: Use vLLM's built-in benchmarks (alternative)

vLLM's `benchmark_serving.py` has been deprecated in favor of `vllm bench serve`. This CLI provides similar metrics to guidellm but is tightly integrated with vLLM. However, since the speculators eval harness already wraps guidellm and extracts spec-decode metrics from Prometheus, using the existing `sweep` mode (Option A) is the natural path.

### Recommendation

**Option A is the path of least resistance.** The infrastructure already exists in the eval harness -- `sweep` mode produces all throughput metrics via guidellm + spec-decode metrics via Prometheus. The work is entirely on the dashboard side: parse an additional CSV, extend the schema, and render the new data.

If wall-clock eval time is a concern, Option B adds a lightweight throughput measurement without the full sweep overhead, but requires more custom parsing code.

## 6. Summary of changes needed

| Layer | Change | Effort |
|-------|--------|--------|
| `in_pod_eval.sh` | Switch `throughput` to `sweep` (or add second guidellm call) | Small |
| `normalize.py` | Parse `perf_results.csv`, extract throughput/latency fields | Medium |
| `schema/results.json` | Add optional `throughput` object to metrics/subset definitions | Small |
| Dashboard JS | Add throughput chart/table components | Medium |
| `results.json` | Will grow with new fields once real evals run | Automatic |
