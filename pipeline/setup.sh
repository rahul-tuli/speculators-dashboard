#!/usr/bin/env bash
# pipeline/setup.sh - one-command setup on the cluster-connected machine:
# verify prerequisites, then install the scheduler that runs cron_eval.sh
# every 30 minutes. Idempotent — safe to re-run.
#
# Usage: ./pipeline/setup.sh   (or: make setup)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEVENV_DIR="${DEVENV_DIR:-$HOME/projects/devenv}"

ok()   { echo "  ok   $*"; }
warn() { echo "  WARN $*"; }
fail() { echo "  FAIL $*"; }

echo "== Preflight checks =="
FAILURES=0

for tool in python3 flock git gh; do
    if command -v "$tool" >/dev/null 2>&1; then ok "$tool found"
    else fail "$tool not found on PATH"; FAILURES=$((FAILURES+1)); fi
done

if command -v oc >/dev/null 2>&1; then
    if oc whoami >/dev/null 2>&1; then ok "oc logged in as $(oc whoami)"
    else fail "oc not logged in — run: oc login <cluster-url>"; FAILURES=$((FAILURES+1)); fi
else
    fail "oc not found on PATH"; FAILURES=$((FAILURES+1))
fi

if command -v gh >/dev/null 2>&1; then
    if gh auth status >/dev/null 2>&1; then ok "gh authenticated"
    else fail "gh not authenticated — run: gh auth login"; FAILURES=$((FAILURES+1)); fi
fi

if [ -f "$DEVENV_DIR/launch.sh" ]; then ok "devenv checkout at $DEVENV_DIR"
else fail "devenv not at $DEVENV_DIR — clone it there or set DEVENV_DIR"; FAILURES=$((FAILURES+1)); fi

if git -C "$REPO_ROOT" ls-remote origin >/dev/null 2>&1; then ok "git remote 'origin' reachable"
else fail "git remote 'origin' unreachable — eval results are committed and pushed"; FAILURES=$((FAILURES+1)); fi

if [ "$FAILURES" -gt 0 ]; then
    echo
    echo "$FAILURES preflight check(s) failed. Fix them and re-run: ./pipeline/setup.sh"
    exit 1
fi

echo
echo "== Installing the eval scheduler =="

if command -v systemctl >/dev/null 2>&1 && systemctl --user list-units >/dev/null 2>&1; then
    UNIT_DIR="$HOME/.config/systemd/user"
    mkdir -p "$UNIT_DIR" "$HOME/.config/speculators-dashboard"

    # Point WorkingDirectory at wherever this clone lives.
    sed "s|^WorkingDirectory=.*|WorkingDirectory=$REPO_ROOT|" \
        "$SCRIPT_DIR/speculators-eval.service" > "$UNIT_DIR/speculators-eval.service"
    cp "$SCRIPT_DIR/speculators-eval.timer" "$UNIT_DIR/speculators-eval.timer"
    ok "units installed to $UNIT_DIR"

    ENV_FILE="$HOME/.config/speculators-dashboard/env"
    if [ ! -f "$ENV_FILE" ]; then
        printf '# Optional environment for the eval cron (literal paths only)\n# GH_TOKEN=...\n' > "$ENV_FILE"
        ok "created env skeleton at $ENV_FILE"
    fi

    systemctl --user daemon-reload
    systemctl --user enable --now speculators-eval.timer
    ok "timer enabled (every 30 min)"

    if loginctl enable-linger "$USER" 2>/dev/null; then
        ok "linger enabled — timer survives reboots and closed sessions"
    else
        warn "could not enable linger for $USER (may need sudo: sudo loginctl enable-linger $USER)"
    fi

    echo
    echo "Done. Verify with:"
    echo "  systemctl --user list-timers speculators-eval.timer"
    echo "  tail -f $REPO_ROOT/logs/cron.log"
else
    # No systemd user manager — fall back to crontab. flock prevents overlap
    # (the oneshot service gets this from systemd; cron does not).
    LINE="*/30 * * * * cd $REPO_ROOT && flock -n logs/cron.lock ./pipeline/cron_eval.sh >> logs/cron.log 2>&1"
    mkdir -p "$REPO_ROOT/logs"
    if crontab -l 2>/dev/null | grep -qF "cron_eval.sh"; then
        ok "crontab entry already present"
    else
        (crontab -l 2>/dev/null || true; echo "$LINE") | crontab -
        ok "crontab entry installed (every 30 min)"
    fi
    echo
    echo "Done. Verify with:"
    echo "  crontab -l"
    echo "  tail -f $REPO_ROOT/logs/cron.log"
fi

echo
echo "The scheduler picks up GitHub issues labeled eval:pending. To run a full"
echo "refresh of the HF collection right now instead: ./pipeline/refresh.sh"
