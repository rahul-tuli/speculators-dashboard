---
name: setup-repo
description: Set up a machine for running speculator evals — clone this repo plus the speculators and vLLM checkouts, and build the venvs the eval harness needs. Use when asked to set up, bootstrap, or prepare a machine/environment for running evals.
---

Set up a machine to run the eval pipeline. The pipeline itself is stdlib-only — the venvs exist for the **eval harness** (`speculators/scripts/evaluate/evaluate.py`, which also needs `guidellm`) and for **vLLM**, which serves the models.

## Steps

1. **Ask the user what already exists** — before cloning or installing anything:
   - Do you already have a `speculators` checkout? Where?
   - Do you already have `vllm` installed or checked out? Where / which env?
   Their answers decide which of steps 3–5 run. Default sibling layout when they have nothing: `~/projects/speculators-dashboard`, `~/projects/speculators`, `~/projects/vllm`.

2. **This repo.** If not already inside a checkout:
   ```bash
   git clone https://github.com/rahul-tuli/speculators-dashboard.git ~/projects/speculators-dashboard
   ```
   Then `make install` — creates `.venv` and installs the pipeline + dev tooling.

3. **speculators checkout + eval venv** (skip if the user's existing checkout is reused — point `SPECDIR` at it):
   ```bash
   git clone https://github.com/vllm-project/speculators.git ~/projects/speculators
   python3 -m venv ~/projects/speculators/.venv
   ~/projects/speculators/.venv/bin/pip install -e ~/projects/speculators guidellm
   ```

4. **vLLM venv** (skip if the user already has a working `vllm` — record its path). Default: released vLLM in its own venv:
   ```bash
   python3 -m venv ~/projects/vllm-venv
   ~/projects/vllm-venv/bin/pip install vllm
   ```
   If the user works from a vLLM source checkout instead, create `<checkout>/.venv` and `pip install -e <checkout>` there — this mirrors what `in_pod_eval.sh` expects at `/workspace/vllm/.venv`.

5. **Verify** — every line must succeed:
   ```bash
   ~/projects/speculators/.venv/bin/python -c "import speculators"
   ~/projects/speculators/.venv/bin/guidellm --help > /dev/null
   <vllm-venv>/bin/vllm --help > /dev/null
   ```

6. **Report** the paths that matter — speculators checkout, eval venv, vLLM venv — so later sessions can point `in_pod_eval.sh` / `run_speculator_eval.sh` at them. Setup is done when all three verifications pass and the paths are reported.

## Notes

- On the cluster-connected machine, run `make setup` after this — it handles the scheduler and its own preflight (`oc`, `gh`, devenv), which this skill deliberately does not duplicate.
- GPU pods already carry these tools at `/workspace/`; this skill is for bare machines that don't.
