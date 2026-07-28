# vLLM Serve Commands for Speculative Decoding Algorithms

Research for [issue #3](https://github.com/rahul-tuli/speculators-dashboard/issues/3).

## Key finding: speculators models are self-describing

vLLM (>= 0.12) has first-class integration with the
[speculators](https://github.com/vllm-project/speculators) library.
When you pass a RedHatAI speculator model directly to `vllm serve`,
vLLM reads its `config.json`, auto-detects the algorithm, target model,
and `num_speculative_tokens`, then starts the correct speculative
decoding pipeline with **zero extra flags**.

```
vllm serve RedHatAI/Qwen3-8B-speculator.eagle3   # just works
```

This means the serve command is algorithm-agnostic from the user's
perspective -- all algorithm-specific logic is resolved at init time
from the model's `speculators_config` block.

---

## 1. CLI flags (`vllm serve`)

### Shorthand flags (aliases for `--speculative-config` sub-keys)

| Flag | Maps to | Purpose |
|------|---------|---------|
| `--spec-method` | `speculative_config.method` | Algorithm: `eagle3`, `dflash`, `dspark`, `ngram`, `medusa`, `mlp_speculator`, `draft_model`, etc. |
| `--spec-model` | `speculative_config.model` | Draft/speculator model path or HF id |
| `--spec-tokens` | `speculative_config.num_speculative_tokens` | Number of tokens to speculate per step |

### Full `--speculative-config` JSON (superset)

Pass as `--speculative-config '{"key": "value"}'` or via individual
`--spec-*` flags (mutually exclusive per key).

| Key | Type | Notes |
|-----|------|-------|
| `method` | string | One of: `eagle`, `eagle3`, `dflash`, `dspark`, `peagle`, `ngram`, `ngram_gpu`, `medusa`, `mlp_speculator`, `draft_model`, `suffix`, `custom_class`, or any `MTPModelTypes` variant |
| `model` | string | HF model id or local path |
| `num_speculative_tokens` | int | Defaults to model's `n_predict` if present |
| `draft_tensor_parallel_size` | int | TP for the draft model (1 or same as target) |
| `quantization` | string | Quantization of draft model weights |
| `enforce_eager` | bool | Override eager mode for draft |
| `moe_backend` | string | MoE backend override for draft |
| `attention_backend` | string | Attention backend override for draft |

### Other relevant flags (on the main `vllm serve` command)

| Flag | Relevant to |
|------|-------------|
| `-tp N` / `--tensor-parallel-size N` | Target model parallelism; always needed for large targets |
| `--no-enable-chunked-prefill` | Required for native MTP models (DeepSeek-V3, etc.) |
| `--trust-remote-code` | Often needed for custom architectures |

---

## 2. Algorithm differences in flags

### eagle3

The speculator model IS the draft. vLLM method = `eagle3`.

```bash
# Auto-detected (recommended):
vllm serve RedHatAI/Qwen3-8B-speculator.eagle3

# Explicit equivalent:
vllm serve Qwen/Qwen3-8B \
  --spec-model RedHatAI/Qwen3-8B-speculator.eagle3 \
  --spec-method eagle3 \
  --spec-tokens 3
```

Config metadata example (`speculators_config`):
- `algorithm`: `"eagle3"`
- `speculative_tokens`: typically 3
- Architecture: `Eagle3Speculator` -> mapped to `Eagle3Qwen3ForCausalLM` or `Eagle3LlamaForCausalLM`

### dflash

DFlash is a parallel-drafting architecture. vLLM method = `dflash`.
vLLM automatically sets `parallel_drafting = True`.

```bash
# Auto-detected (recommended):
vllm serve RedHatAI/Qwen3-8B-speculator.dflash

# Explicit equivalent:
vllm serve Qwen/Qwen3-8B \
  --spec-model RedHatAI/Qwen3-8B-speculator.dflash \
  --spec-method dflash \
  --spec-tokens 7
```

Config metadata example:
- `algorithm`: `"dflash"`
- `speculative_tokens`: typically 7
- Extra config fields: `aux_hidden_state_layer_ids`, `block_size`, `mask_token_id`
- Architecture: `DFlashDraftModel`

### peagle (Parallel Eagle)

PEagle is mapped to method `eagle3` with `parallel_drafting = True` internally.

```bash
# Auto-detected (recommended):
vllm serve RedHatAI/Qwen3-8B-speculator.peagle

# Explicit equivalent:
vllm serve Qwen/Qwen3-8B \
  --spec-model RedHatAI/Qwen3-8B-speculator.peagle \
  --spec-method eagle3 \
  --spec-tokens 7
# (parallel_drafting is set automatically from the peagle config)
```

Config metadata example:
- `algorithm`: `"peagle"`
- `speculative_tokens`: typically 7
- Extra fields: `mask_token_id`, `eagle_aux_hidden_state_layer_ids`, `num_depths`
- Architecture: `PEagleDraftModel` -> `PeagleQwen3ForCausalLM`

### mtp (Multi-Token Prediction)

MTP is fundamentally different: the MTP heads are **part of the target
model itself** (e.g., DeepSeek-V3 ships with built-in MTP layers).
There is **no separate speculator model**. vLLM auto-detects MTP from
the target model's `config.json` (field: `num_nextn_predict_layers`).

```bash
# Native MTP (e.g., DeepSeek-V3):
vllm serve deepseek-ai/DeepSeek-V3 \
  --no-enable-chunked-prefill \
  -tp 8

# There is no separate --spec-model for native MTP.
# vLLM reads num_nextn_predict_layers from the model config
# and enables MTP decoding automatically.
```

Key difference: MTP does NOT use a speculator model from the RedHatAI
collection. The MTP weights live inside the target model checkpoint.
`--no-enable-chunked-prefill` is required for MTP to work.

---

## 3. The local pipeline (`in_pod_eval.sh`)

The current pipeline at `pipeline/in_pod_eval.sh` uses a surprisingly
simple serve command:

```bash
SERVE_ARGS=(--port "$PORT")
if [ "$GPUS" -gt 1 ]; then
    SERVE_ARGS+=(-tp "$GPUS")
fi
if [ "$ALGO" = "mtp" ]; then
    SERVE_ARGS+=(--no-enable-chunked-prefill)
fi

vllm serve "$MODEL" "${SERVE_ARGS[@]}"
```

This works because **vLLM auto-detects everything from the speculator
model's `config.json`**. The only algorithm-specific flag is
`--no-enable-chunked-prefill` for MTP.

---

## 4. HuggingFace model metadata (`speculators_config`)

Every RedHatAI speculator model has a `config.json` with a
`speculators_config` block containing everything needed:

```json
{
  "speculators_model_type": "eagle3",
  "speculators_config": {
    "algorithm": "eagle3",
    "default_proposal_method": "greedy",
    "proposal_methods": [
      {
        "proposal_type": "greedy",
        "speculative_tokens": 3,
        "verifier_accept_k": 1
      }
    ],
    "verifier": {
      "name_or_path": "Qwen/Qwen3-8B"
    }
  }
}
```

Available metadata fields per algorithm:

| Field | eagle3 | dflash | peagle |
|-------|--------|--------|--------|
| `algorithm` | `"eagle3"` | `"dflash"` | `"peagle"` |
| `verifier.name_or_path` | target model | target model | target model |
| `speculative_tokens` | ~3 | ~7 | ~7 |
| `aux_hidden_state_layer_ids` | optional | required | optional |
| `mask_token_id` | -- | required | required |
| `block_size` | -- | present | -- |
| `num_depths` | -- | -- | present |

### Current RedHatAI speculator inventory (31 models)

**eagle3** (19 models): Llama-3.1-8B, Llama-3.3-70B, Llama-4-Maverick,
Qwen3-8B, Qwen3-14B, Qwen3-32B, Qwen3-235B-A22B, Qwen3-30B-A3B,
Qwen3-VL-235B-A22B, Qwen3-8B-Thinking, Qwen3-32B-Thinking,
Qwen3-235B-A22B-Thinking-2507, Qwen3-235B-A22B-Instruct-2507,
Qwen3-30B-A3B-Instruct-2507, Qwen3-30B-A3B-Thinking-2507,
gemma-4-31B-it, gemma-4-26B-A4B-it, gpt-oss-20b, gpt-oss-120b.

**dflash** (9 models): Qwen3-8B, Qwen3-30B-A3B, Qwen3-30B-A3B-Instruct-2507,
Qwen3.5-397B-A17B, gemma-4-31B-it, Mellum2-12B-A2.5B-Thinking,
NVIDIA-Nemotron-3-Super-120B-A12B, NVIDIA-Nemotron-3-Ultra-550B-A55B,
DeepSeek-V4-Flash, Mistral-Small-4-119B-2603.

**peagle** (1 model): Qwen3-8B.

**dspark** (2 models): GLM-5.2, GLM-5.2-preview.

---

## 5. Auto-generation feasibility

**Yes, fully deterministic.** Given a speculator model ID, the serve
command can be constructed from its `config.json` alone:

```python
import json, urllib.request

def generate_serve_command(speculator_model: str, gpus: int = 1) -> str:
    """Generate a copy-pasteable vllm serve command from a speculator model ID."""
    url = f"https://huggingface.co/{speculator_model}/raw/main/config.json"
    with urllib.request.urlopen(url) as resp:
        config = json.loads(resp.read())

    algo = config.get("speculators_model_type")
    spec_config = config.get("speculators_config", {})
    target = spec_config.get("verifier", {}).get("name_or_path")

    parts = ["vllm", "serve", speculator_model]

    if gpus > 1:
        parts += ["-tp", str(gpus)]

    # MTP is native (no speculator model), but this function handles
    # speculators-format models only. MTP needs special treatment.

    return " \\\n  ".join(parts)
```

That is literally all that is needed for eagle3, dflash, and peagle,
because vLLM reads the `speculators_config` and auto-configures:
- The speculative method (`eagle3`/`dflash`/`eagle3+parallel_drafting`)
- The target model (swaps model to `verifier.name_or_path`)
- The number of speculative tokens
- All architecture-specific parameters

### MTP caveat

MTP models require knowing whether the target itself has MTP heads.
This is encoded in the target model's own `config.json`
(`num_nextn_predict_layers` field), not in a speculator model. For MTP,
the command is:

```bash
vllm serve <target-model> --no-enable-chunked-prefill -tp <gpus>
```

### Template for the dashboard

For each model in `results.json`, the dashboard can generate:

```bash
# For speculator models (eagle3, dflash, peagle):
vllm serve {model_id} -tp {gpus}

# For MTP:
vllm serve {target} --no-enable-chunked-prefill -tp {gpus}
```

The `discover.py` pipeline already extracts `algorithm`, `target`,
`num_speculative_tokens`, and `gpus` -- all the fields needed.

### recipes.vllm.ai integration

The recipes site at https://recipes.vllm.ai exposes `/models.json` with
an index of 151+ models. Each entry points to a per-model JSON file
(e.g., `/deepseek-ai/DeepSeek-V3.json`) containing a
`recommended_command` with `argv` arrays and `env` vars. Currently no
speculator-specific recipes exist there, but the format is well-suited
for programmatic extraction if they are added in the future.

---

## 6. Summary

| Algorithm | Separate model? | Extra flags needed | Auto-detected? |
|-----------|-----------------|-------------------|----------------|
| eagle3 | Yes (speculator) | None | Yes |
| dflash | Yes (speculator) | None | Yes |
| peagle | Yes (speculator) | None | Yes |
| dspark | Yes (speculator) | None | Yes |
| mtp | No (native) | `--no-enable-chunked-prefill` | Yes (from target config) |

The dashboard can auto-generate a one-line deploy command for every
model using only the metadata already captured by `discover.py`.
