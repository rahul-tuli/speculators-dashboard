#!/bin/bash
# Refresh entrypoint (cron): discover pending models and evaluate them
# sequentially. Guarded by flock so overlapping cron runs are no-ops.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

mkdir -p logs
exec 9>logs/refresh.lock
flock -n 9 || { echo "another refresh is already running"; exit 0; }

echo "=== refresh started $(date -u +%FT%TZ) ==="

# Safety sweep: delete a leftover eval pod from a crashed previous run
# (only if it is older than 4 hours — a younger one may be mid-eval).
NAMESPACE="${DEVENV_NAMESPACE:-machine-learning}"
USER_LC="$(echo "${USER:-$(whoami)}" | tr '[:upper:]' '[:lower:]')"
POD="devenv-${USER_LC}-eval"
created="$(oc get pod "$POD" -n "$NAMESPACE" -o jsonpath='{.metadata.creationTimestamp}' 2>/dev/null || true)"
if [ -n "$created" ]; then
    age=$(( $(date +%s) - $(date -u -d "$created" +%s 2>/dev/null || date +%s) ))
    if [ "$age" -gt 14400 ]; then
        echo "Deleting stale eval pod $POD (age ${age}s)"
        oc delete pod "$POD" -n "$NAMESPACE" --wait=false || true
    fi
fi

python3 pipeline/discover.py

shopt -s nullglob
for entry in results/pending/*.json; do
    [ "$(basename "$entry")" = "index.json" ] && continue
    echo
    echo ">>> $entry"
    ./pipeline/run_eval.sh "$entry" || echo "!!! eval failed for $entry (recorded in results.json)"
    rm -f "$entry"
done

echo "=== refresh finished $(date -u +%FT%TZ) ==="
