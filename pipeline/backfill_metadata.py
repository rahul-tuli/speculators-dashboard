#!/usr/bin/env python3
"""Backfill HF metadata (params/architecture/base_model) into results.json.

One-off migration for records created before discovery captured model
metadata (issue #98). Idempotent: only fills fields a record lacks.

Usage: python pipeline/backfill_metadata.py
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from discover import fetch_hf_metadata

REPO_ROOT = Path(__file__).resolve().parent.parent
RESULTS_JSON = REPO_ROOT / "results.json"


def main() -> None:
    results = json.loads(RESULTS_JSON.read_text())
    changed = False
    for record in results.get("models", []):
        missing = {
            k: v
            for k, v in fetch_hf_metadata(record["model"]).items()
            if k not in record
        }
        if not missing:
            print(f"  up-to-date: {record['model']}")
            continue
        record.update(missing)
        print(f"  backfilled {record['model']}: {missing}")
        changed = True
    if not changed:
        print("nothing to backfill")
        return
    results["updated_at"] = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    RESULTS_JSON.write_text(json.dumps(results, indent=2) + "\n")
    print("results.json updated")


if __name__ == "__main__":
    main()
