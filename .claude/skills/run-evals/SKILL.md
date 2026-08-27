---
name: run-evals
description: Run all pending speculator evals on the cluster and monitor them to completion. Use when asked to kick off, run, watch, or monitor the eval backlog.
---

Run the full eval backlog and monitor it through. Evals run one model at a time, 15–45 min each (model download + server start + eval), so monitoring is the bulk of the work.

## Steps

1. **Preflight** — all must pass before kicking anything off:
   ```bash
   oc whoami                          # logged into the cluster
   ls results/pending/*.json          # backlog entries exist
   ```
   No pending entries → run `python3 pipeline/discover.py` first to regenerate them from the HF collection.

2. **Kick off the full pass in the background** (flock-guarded, safe against the scheduler):
   ```bash
   ./pipeline/refresh.sh 2>&1 | tee logs/refresh.log
   ```
   Run it as a background task — do not block on it.

3. **Monitor.** Poll on a slow cadence (every few minutes, not in a tight loop):
   - Progress: `tail -20 logs/refresh.log` — each model logs `=== Eval:` start and `=== Done:`/`ERROR` end.
   - Per-model detail: `logs/eval-<slug>.log`.
   - Pod health: `oc get pods -n machine-learning | grep eval` — a pod should exist while an eval runs and vanish after.
   - Results landing: `git diff --stat results.json` or watch `evaluated_at` fields update.
   - Stuck pod (Running far past 45 min, or an eval that crashed without teardown): see CHEATSHEET.md §7 — `printf 'y\n' | $DEVENV_DIR/launch.sh --name eval --down`; `refresh.sh` also sweeps pods older than 4h itself.

4. **Handle failures without stopping the run.** A failed model is recorded in `results.json` with `status: "failed"` and the run moves on — let it. Collect failures for the final report; re-run a fixed model via `./pipeline/refresh.sh single --entry <entry.json>` after the backlog clears.

5. **Done when**: `results/pending/` holds only `index.json`, no eval pod remains, and every model is accounted for in `results.json` as `ok` or `failed`. Report the final counts: evaluated ok / failed / total, with the failed models named and their log paths.

## Notes

- This is the **cluster/pod flow** (devenv, `oc exec`). When already on a GPU server and running an eval by hand against local GPUs, use the `run-evals-manual` skill instead.
- This runs the **collection backlog** (`results/pending/`). The issue-driven flow (`eval:pending` GitHub issues) belongs to the scheduler installed by `make setup` — if that timer is live it is already working the issue queue, and both flows share the single eval pod name `devenv-$USER-eval`, so they serialize rather than collide.
- Machine reboots kill the run — it is a foreground process, not the timer. Re-run `./pipeline/refresh.sh`; already-evaluated models are skipped by `discover.py`.
