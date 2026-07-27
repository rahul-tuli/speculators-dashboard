#!/usr/bin/env python3
"""Normalize one eval run into results.json (idempotent upsert).

Usage:
  normalize.py --entry pending.json --status ok --raw-dir results/<slug>/raw
  normalize.py --entry pending.json --status failed --error "pod unschedulable"
"""

from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RESULTS_JSON = REPO_ROOT / "results.json"


def parse_acceptance(raw_dir: Path) -> dict:
    """Parse the eval harness's acceptance.csv into the dashboard schema."""
    csvs = sorted(raw_dir.rglob("acceptance.csv"))
    if not csvs:
        raise FileNotFoundError(f"no acceptance.csv found under {raw_dir}")
    rows = list(csv.DictReader(csvs[0].open()))
    if not rows:
        raise ValueError(f"{csvs[0]} is empty")

    def f(row: dict, key: str) -> float:
        return float(row.get(key) or 0)

    pos_keys = sorted(
        (k for k in rows[0] if k.startswith("acceptance_at_pos_")),
        key=lambda k: int(k.rsplit("_", 1)[1]),
    )

    subsets = {}
    total_drafts = total_accepted = 0.0
    weighted_pos = dict.fromkeys(pos_keys, 0.0)
    for row in rows:
        drafts = f(row, "num_drafts")
        accepted = f(row, "num_accepted_tokens")
        total_drafts += drafts
        total_accepted += accepted
        for k in pos_keys:
            weighted_pos[k] += f(row, k) * drafts
        subsets[row["subset"]] = {
            "acceptance_length": round(f(row, "acceptance_length"), 4),
            "acceptance_at_pos": [round(f(row, k), 4) for k in pos_keys],
            "num_drafts": int(drafts),
            "num_draft_tokens": int(f(row, "num_draft_tokens")),
            "num_accepted_tokens": int(accepted),
        }

    if total_drafts <= 0:
        raise ValueError("acceptance.csv has zero drafts")

    return {
        "acceptance_length": round(1 + total_accepted / total_drafts, 4),
        "acceptance_at_pos": [
            round(weighted_pos[k] / total_drafts, 4) for k in pos_keys
        ],
        "num_drafts": int(total_drafts),
        "subsets": subsets,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--entry", required=True, help="pending entry JSON from discover.py")
    ap.add_argument("--status", choices=["ok", "failed"], required=True)
    ap.add_argument("--raw-dir", type=Path, default=None)
    ap.add_argument("--error", default=None)
    args = ap.parse_args()

    entry = json.loads(Path(args.entry).read_text())
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    record = {
        "model": entry["model"],
        "target": entry.get("target"),
        "algorithm": entry.get("algorithm"),
        "num_speculative_tokens": entry.get("num_speculative_tokens"),
        "hf_last_modified": entry.get("hf_last_modified"),
        "evaluated_at": now,
        "gpus": f"{entry['gpus']}x{entry['gpu_type']}",
        "status": args.status,
        "metrics": None,
        "error": args.error,
    }
    if args.status == "ok":
        if not args.raw_dir:
            ap.error("--raw-dir is required for --status ok")
        record["metrics"] = parse_acceptance(args.raw_dir)

    results = json.loads(RESULTS_JSON.read_text()) if RESULTS_JSON.exists() else {"models": []}
    models = [m for m in results.get("models", []) if m["model"] != record["model"]]
    models.append(record)
    models.sort(key=lambda m: m["model"])
    RESULTS_JSON.write_text(
        json.dumps({"updated_at": now, "models": models}, indent=2) + "\n"
    )
    print(f"results.json: upserted {record['model']} (status={args.status})")


if __name__ == "__main__":
    main()
