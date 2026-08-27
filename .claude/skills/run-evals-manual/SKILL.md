---
name: run-evals-manual
description: Run speculator evals manually on the local GPU server, bypassing devenv and the cluster — pack multiple models across the GPUs (one deployment per GPU group, its own port, evals in parallel), publish results to the dashboard, close the issues. Use when already on a machine with GPU resources and asked to run evals by hand.
---

Work the eval-issue queue on the machine you are sitting on, keeping **every GPU busy**: each model is deployed on its own GPU group and port — e.g. on a 2-GPU box, model-1 on GPU 0 / port 8000 and model-2 on GPU 1 / port 8001, evals running in parallel. You are the **orchestrator**: you schedule, publish, and close. Each deploy+eval runs in a **background runner subagent** so multi-thousand-line vLLM/guidellm logs stay out of this context; you see only compact summaries.

## Steps

1. **Load machine config.** Read `local/eval-manual.env` (repo root; `local/` is gitignored, so this is per-machine). It holds:
   - `VLLM_VENV` — venv that provides `vllm serve`
   - `GUIDELLM_VENV` — venv whose python runs the guidellm-based eval harness
   - `SPECULATORS_DIR` — speculators checkout containing `scripts/evaluate/evaluate.py`

   For any missing key, ask the user for the path, verify it exists on disk, and append it to the file — recorded once, reused on every future eval. Never guess paths. **Done when**: all three paths are verified to exist.

2. **Inventory the hardware.**
   ```bash
   nvidia-smi --query-gpu=index,name --format=csv,noheader
   nvidia-smi --query-compute-apps=gpu_uuid,pid --format=csv,noheader   # busy GPUs
   lsof -iTCP -sTCP:LISTEN -P | grep -E ':(80[0-9]{2})\b' || true        # busy ports
   ```
   Kill any leftover vLLM servers from a previous manual run before scheduling. **Done when**: you have the list of free GPU indices and the first free port at/above 8000.

3. **Build the schedule.** List pending issues and parse each body's markdown table (Model, Target, Algorithm, Speculative Tokens, GPUs like `4xh100`, HF Last Modified — values may be backtick-wrapped):
   ```bash
   gh issue list --repo rahul-tuli/speculators-dashboard --label eval:pending --state open --json number,title,body
   ```
   Confirm the selection with the user, then pack greedily: hand out free GPU indices (contiguous per model) and one port per model, first-free at/above 8000. Issues that don't fit stay queued for step 6. For each scheduled model record: issue number, model, algorithm, spec tokens, GPU indices, port. **Done when**: every free GPU is assigned or no remaining issue fits.

   **Slot size comes from the deploy command, not assumed**: take the `### Deployment command` code block from the issue's comments if present, and read its GPU requirement from `--tensor-parallel-size` (1 when the flag is absent). If the issue has no deployment command, the requirement is the GPUs field from its table (`4xh100` → 4). Only schedule a model when that many free GPUs remain.

4. **Claim and write run specs.** For each scheduled model:
   ```bash
   gh issue edit <n> --repo rahul-tuli/speculators-dashboard --add-assignee @me --remove-label eval:pending --add-label eval:running
   ```
   Build its deploy command: the issue's deployment command if present — leave its `--tensor-parallel-size` untouched, it defines the slot — otherwise `vllm serve <Model>` plus `--speculative-config '{"model": "<Model>", "method": "<Algorithm>", "num_speculative_tokens": <Speculative Tokens, min 5>}'` and `--tensor-parallel-size <GPUs field>` (omit for 1 GPU). Adapt it: prepend `CUDA_VISIBLE_DEVICES=<this model's indices>`, set `--port <its port>`, add `--no-enable-chunked-prefill` when Algorithm is `mtp`. Write its entry JSON to `logs/eval-entry-<slug>.json` (same schema `pipeline/cron_eval.sh` writes; slug: text after last `/`, lowercased, non-alnum runs → single dash; `gpus` = slot size actually assigned).

5. **Dispatch one runner subagent per model, all in the background.** Each prompt carries verbatim: the adapted deploy command, its `CUDA_VISIBLE_DEVICES`, its `PORT`, `VLLM_VENV`, `GUIDELLM_VENV`, `SPECULATORS_DIR`, model id, raw output dir `results/<slug>/raw/`, log path `logs/eval-manual-<slug>.log`. Instruct every runner to:
   - Redirect **all** command output to its log file — logs never enter its reply.
   - Start `vllm serve` from `VLLM_VENV` in the background with its deploy command; poll `localhost:<its PORT>/health` up to 40 min (model downloads are slow); if the process dies, return the last ~30 log lines.
   - Run the sweep with the same `CUDA_VISIBLE_DEVICES` and port: `cd $SPECULATORS_DIR/scripts/evaluate && $GUIDELLM_VENV/bin/python evaluate.py --target http://localhost:$PORT/v1 --output-dir <tmpdir> sweep --max-requests 80`.
   - Copy the raw output tree into `results/<slug>/raw/` (replacing any existing one), then kill its vLLM server, success or failure.
   - Reply with at most ~20 lines: ok/failed, files that landed in the raw dir, and — on failure only — the last ~30 log lines.

   Each run takes 15–45 min. If a runner hits its 2-hour timeout, resume that same agent — never start a second vLLM for the same model.

6. **As each runner completes, publish and close that model — yourself, one at a time.** Git and `results.json` writes are never delegated or parallelized.
   - Success:
     ```bash
     python3 pipeline/normalize.py --entry logs/eval-entry-<slug>.json --status ok \
         --raw-dir results/<slug>/raw \
         --deploy-command "<issue's deployment command, or the command that ran>" \
         --deploy-recipe-source "<source URL if known, else empty>"
     git add results.json && git pull --rebase origin main && git commit -m "Eval: <model>" && git push
     ```
     (`results/*/raw/` is gitignored — `results.json` is the dashboard data. On push rejection, `pull --rebase` and push again.) Then comment a metrics summary (acceptance length, throughput tok/s, speedup — read the model's fresh entry in `results.json`), flip `eval:running` → `eval:done`, and close, mirroring `pipeline/cron_eval.sh`'s success format.
   - Failure (or normalize rejects the raw output): comment the runner's log tail in a `<details>` block, flip `eval:running` → `eval:failed`, leave the issue open, note `logs/eval-manual-<slug>.log` for the user.
   - Then re-run the packing from step 3 over the freed GPUs and any queued issues, and dispatch the next runner.
   **Done when**: no runners are active, no queued issue fits the free GPUs, and no vLLM processes remain.

## Notes

- Parallelism is bounded by hardware: total slot sizes ≤ GPU count, one port per live deployment.
- This flow shares `results.json` with the cluster cron flow, hence the `pull --rebase` before every push.
- For the cluster/pod flow (devenv, `oc exec`), use the `run-evals` skill instead.
