#!/usr/bin/env python3
"""Orchestrate the full speculator eval cycle: discover -> eval -> normalize.

Replaces refresh.sh + run_eval.sh. Keeps in_pod_eval.sh as the in-pod
adapter (it runs inside the cluster pod, a genuine boundary).
"""

from __future__ import annotations

import fcntl
import json
import os
import shutil
import signal
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DEVENV_DIR = Path(os.environ.get("DEVENV_DIR", Path.home() / "projects" / "devenv"))
NAMESPACE = os.environ.get("DEVENV_NAMESPACE", "machine-learning")
EVAL_TIMEOUT = int(os.environ.get("EVAL_TIMEOUT", "5400"))

_teardown_registered = False


def pod_name() -> str:
    user = os.environ.get("USER", os.environ.get("LOGNAME", "unknown"))
    return f"devenv-{user.lower()}-eval"


def run_cmd(cmd, **kwargs):
    return subprocess.run(cmd, check=True, **kwargs)


def teardown_pod():
    pod = pod_name()
    print(f"=== Tearing down {pod} ===")
    try:
        subprocess.run(
            [str(DEVENV_DIR / "launch.sh"), "--name", "eval", "--down"],
            input=b"y\n",
            timeout=120,
        )
    except Exception:
        pass


def _register_teardown_signals():
    """Wire SIGTERM/SIGINT to tear down the pod before exiting."""
    global _teardown_registered
    if _teardown_registered:
        return
    _teardown_registered = True

    def _handler(signum, _frame):
        teardown_pod()
        sys.exit(128 + signum)

    signal.signal(signal.SIGTERM, _handler)
    signal.signal(signal.SIGINT, _handler)


def provision_pod(gpus: int, gpu_type: str):
    # launch.sh tries to attach an interactive tmux after creating the pod;
    # that step fails without a TTY, which is expected — the pod stays up.
    subprocess.run(
        [
            str(DEVENV_DIR / "launch.sh"),
            "--name", "eval",
            "--gpus", str(gpus),
            "--gpu-type", gpu_type,
            "--cluster",
        ],
        stdin=subprocess.DEVNULL,
    )
    run_cmd([
        "oc", "wait", "--for=condition=Ready",
        f"pod/{pod_name()}", "-n", NAMESPACE, "--timeout=1800s",
    ])


def run_eval_in_pod(model: str, gpus: int, algorithm: str):
    with open(SCRIPT_DIR / "in_pod_eval.sh") as f:
        run_cmd(
            [
                "oc", "exec", "-i", pod_name(), "-n", NAMESPACE, "--",
                "bash", "-s", "--", model, str(gpus), algorithm,
            ],
            stdin=f,
            timeout=EVAL_TIMEOUT,
        )


def copy_results_out(slug: str) -> Path:
    outdir = REPO_ROOT / "results" / slug / "raw"
    if outdir.exists():
        shutil.rmtree(outdir)
    run_cmd([
        "oc", "cp",
        f"{NAMESPACE}/{pod_name()}:/tmp/eval-out",
        str(outdir),
    ])
    return outdir


def evaluate_model(entry: dict):
    model = entry["model"]
    slug = entry["slug"]
    gpus = int(entry["gpus"])
    gpu_type = entry["gpu_type"]
    algorithm = entry["algorithm"]

    entry_path = REPO_ROOT / "results" / "pending" / f"{slug}.json"

    print(f"\n=== Eval: {model} on {gpus}x{gpu_type} (pod {pod_name()}) ===")

    _register_teardown_signals()
    try:
        provision_pod(gpus, gpu_type)
        run_eval_in_pod(model, gpus, algorithm)
        raw_dir = copy_results_out(slug)

        run_cmd([
            sys.executable, str(SCRIPT_DIR / "normalize.py"),
            "--entry", str(entry_path),
            "--raw-dir", str(raw_dir),
            "--status", "ok",
        ])
        print(f"=== Done: {model} ===")
    except Exception as e:
        print(f"ERROR: {e}")
        try:
            run_cmd([
                sys.executable, str(SCRIPT_DIR / "normalize.py"),
                "--entry", str(entry_path),
                "--status", "failed",
                "--error", str(e),
            ])
        except Exception:
            print(f"ERROR: normalize.py also failed for {model}")
    finally:
        teardown_pod()


def cleanup_stale_pod():
    pod = pod_name()
    try:
        result = subprocess.run(
            [
                "oc", "get", "pod", pod, "-n", NAMESPACE,
                "-o", "jsonpath={.metadata.creationTimestamp}",
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0 or not result.stdout.strip():
            return
        created = datetime.fromisoformat(
            result.stdout.strip().replace("Z", "+00:00")
        )
        age = (datetime.now(timezone.utc) - created).total_seconds()
        if age > 14400:
            print(f"Deleting stale eval pod {pod} (age {int(age)}s)")
            subprocess.run(
                ["oc", "delete", "pod", pod, "-n", NAMESPACE, "--wait=false"]
            )
    except Exception:
        pass


def main():
    lock_path = REPO_ROOT / "logs" / "refresh.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    lock_fd = open(lock_path, "w")
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        print("another refresh is already running")
        return

    print(f"=== refresh started {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')} ===")

    cleanup_stale_pod()

    run_cmd([sys.executable, str(SCRIPT_DIR / "discover.py")])

    pending_dir = REPO_ROOT / "results" / "pending"
    for entry_path in sorted(pending_dir.glob("*.json")):
        if entry_path.name == "index.json":
            continue
        entry = json.loads(entry_path.read_text())
        evaluate_model(entry)
        entry_path.unlink(missing_ok=True)

    print(f"=== refresh finished {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')} ===")


if __name__ == "__main__":
    main()
