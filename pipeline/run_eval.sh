#!/bin/bash
# Drives one model evaluation end-to-end on the OpenShift cluster via devenv.
#
# Usage: run_eval.sh <pending-entry.json>
#
# Flow: devenv pod up -> eval inside pod -> copy results out -> normalize
# into results.json. The pod is ALWAYS deleted afterwards (trap on EXIT),
# including on failure or interruption.
set -uo pipefail

ENTRY="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
DEVENV_DIR="${DEVENV_DIR:-$HOME/projects/devenv}"
NAMESPACE="${DEVENV_NAMESPACE:-machine-learning}"
EVAL_TIMEOUT="${EVAL_TIMEOUT:-5400}"   # 90 min hard cap per model

USER_LC="$(echo "${USER:-$(whoami)}" | tr '[:upper:]' '[:lower:]')"
POD="devenv-${USER_LC}-eval"

# --- Read the pending entry ------------------------------------------------
eval "$(python3 - "$ENTRY" <<'PYEOF'
import json, shlex, sys
e = json.load(open(sys.argv[1]))
for k in ("model", "slug", "algorithm"):
    print(f'{k.upper()}={shlex.quote(str(e[k]))}')
print(f'GPUS={int(e["gpus"])}')
print(f'GPU_TYPE={shlex.quote(e["gpu_type"])}')
PYEOF
)"

OUTDIR="$REPO_ROOT/results/$SLUG"
mkdir -p "$OUTDIR"

fail() {
    echo "ERROR: $1"
    python3 "$SCRIPT_DIR/normalize.py" --entry "$ENTRY" --status failed --error "$1"
    exit 1
}

# --- Guaranteed teardown ----------------------------------------------------
cleanup() {
    echo "=== Tearing down $POD ==="
    printf 'y\n' | "$DEVENV_DIR/launch.sh" --name eval --down || true
}
trap cleanup EXIT

echo "=== Eval: $MODEL on ${GPUS}x${GPU_TYPE} (pod $POD) ==="

# --- 1. Bring the pod up -----------------------------------------------------
# launch.sh creates the pod, waits for Ready, then tries to attach an
# interactive tmux — that last step fails without a TTY (stdin is /dev/null),
# which is expected; the pod stays up.
"$DEVENV_DIR/launch.sh" --name eval --gpus "$GPUS" --gpu-type "$GPU_TYPE" --cluster </dev/null || true
oc wait --for=condition=Ready "pod/$POD" -n "$NAMESPACE" --timeout=1800s \
    || fail "pod did not become ready"

# --- 2. Run the eval inside the pod ------------------------------------------
timeout "$EVAL_TIMEOUT" oc exec -i "$POD" -n "$NAMESPACE" -- \
    bash -s -- "$MODEL" "$GPUS" "$ALGORITHM" < "$SCRIPT_DIR/in_pod_eval.sh" \
    || fail "eval command failed or timed out (see $OUTDIR/raw logs if fetched)"

# --- 3. Copy results out ------------------------------------------------------
rm -rf "$OUTDIR/raw"
oc cp "$NAMESPACE/$POD:/tmp/eval-out" "$OUTDIR/raw" \
    || fail "failed to copy results out of pod"

# --- 4. Normalize into results.json -------------------------------------------
python3 "$SCRIPT_DIR/normalize.py" --entry "$ENTRY" --raw-dir "$OUTDIR/raw" --status ok \
    || fail "normalize.py failed"

echo "=== Done: $MODEL ==="
