# Speculators Dashboard

A SpecBundle-style dashboard for speculative-decoding draft models ("speculators")
from the HuggingFace collection
[RedHatAI/speculator-models](https://huggingface.co/collections/RedHatAI/speculator-models).

An automated pipeline watches the collection, evaluates new/updated speculators on
our OpenShift cluster (GPU pods provisioned with
[devenv](https://github.com/neuralmagic/devenv), models served with
[vLLM](https://github.com/vllm-project/vllm), acceptance metrics measured with the
[speculators](https://github.com/vllm-project/speculators) eval harness), stores
results in `results.json`, and tears the GPU pod down. The site in `site/` renders
`results.json` as a static page.

## Layout

```
results.json            the "database" — one entry per evaluated model
pipeline/
  discover.py           list collection, diff vs results.json -> results/pending/*.json
  orchestrate.py        full eval cycle: discover -> eval -> normalize (replaces run_eval.sh)
  in_pod_eval.sh        runs inside the pod: vllm serve + evaluate.py
  normalize.py          eval output -> results.json entry (idempotent upsert)
  refresh.sh            cron entrypoint: delegates to orchestrate.py
site/                   static dashboard (no build step)
logs/                   refresh logs + flock
```

## Quick start

See **CHEATSHEET.md** for copy-paste commands to run this on the
cluster-connected machine.

## How evaluation works

For each pending model, `orchestrate.py`:

1. Brings up pod `devenv-$USER-eval` via devenv (`--gpus N --gpu-type ...` chosen
   from a sizing table in `discover.py`).
2. Streams `in_pod_eval.sh` into the pod: `vllm serve <model>`, then
   `speculators/scripts/evaluate/evaluate.py ... throughput --subsets HumanEval,qa`
   (acceptance length + per-position acceptance from vLLM Prometheus counters).
3. Copies `/tmp/eval-out` back and upserts the metrics into `results.json`.
4. Deletes the pod — guaranteed teardown even on failure/timeout.

Failures are recorded in `results.json` with `status: "failed"` and shown on the
dashboard; a model is re-evaluated when its HF `lastModified` changes.

## Follow-ups (not yet done)

- Full SPEED-Bench `sweep` mode, more subsets
- Parallel evals, historical trend charts
- GitHub Pages publishing (needs repo public, or Pro for private)
