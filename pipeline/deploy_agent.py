#!/usr/bin/env python3
"""Deploy command recipe-lookup agent.

Generates deploy commands for speculator models by:
1. Checking recipes.vllm.ai for a known recipe for the target model
2. Falling back to generating a command from speculator metadata

Stdlib-only (urllib.request for HTTP).

Usage (CLI):
  python deploy_agent.py --model org/spec-model --target org/base-model \
                         --algorithm eagle3 --gpus 4

Programmatic:
  from deploy_agent import lookup_deploy
  result = lookup_deploy("org/spec-model", "org/base-model", "eagle3", 4)
  # -> {"command": "vllm serve ...", "recipe_source": "", "recipe_model": ""}
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request

RECIPES_INDEX_URL = "https://recipes.vllm.ai/models.json"
RECIPES_BASE_URL = "https://recipes.vllm.ai"
HTTP_TIMEOUT = 10

# Algorithms where vLLM auto-detects everything from config.json, so the
# serve command uses the *speculator* model ID (not the target).
_AUTO_DETECT_ALGORITHMS = frozenset({"eagle3", "dflash", "peagle", "dspark"})


def _fetch_json(url: str) -> dict | list | None:
    """Fetch JSON from a URL, returning None on any failure."""
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": "speculators-dashboard"}
        )
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            return json.loads(resp.read())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None


def _lookup_recipe(target: str) -> dict | None:
    """Check recipes.vllm.ai for a recipe matching the target model.

    Returns {"command": str, "recipe_source": str, "recipe_model": str}
    if a recipe is found, None otherwise.
    """
    index = _fetch_json(RECIPES_INDEX_URL)
    if not index or not isinstance(index, list):
        return None

    # The index is a list of model entries. Find one matching our target.
    # Each entry may have an "id" or "model" field and a path to the recipe.
    target_lower = target.lower()
    match = None
    for entry in index:
        entry_id = ""
        if isinstance(entry, dict):
            entry_id = entry.get("id", entry.get("model", ""))
        elif isinstance(entry, str):
            entry_id = entry
        if entry_id and entry_id.lower() == target_lower:
            match = entry
            break

    if match is None:
        return None

    # Fetch the individual recipe
    if isinstance(match, dict):
        recipe_path = match.get("path", match.get("url", ""))
        recipe_model_id = match.get("id", match.get("model", ""))
    else:
        recipe_path = match
        recipe_model_id = match

    if not recipe_path:
        return None

    # Build recipe URL
    if recipe_path.startswith("http"):
        recipe_url = recipe_path
    else:
        recipe_url = f"{RECIPES_BASE_URL}/{recipe_path.lstrip('/')}"

    recipe = _fetch_json(recipe_url)
    if not recipe or not isinstance(recipe, dict):
        return None

    # Extract the recommended command from the recipe
    command = recipe.get("command", recipe.get("serve_command", ""))
    if not command:
        return None

    return {
        "command": command,
        "recipe_source": recipe_url,
        "recipe_model": recipe_model_id,
    }


def _generate_command(model: str, target: str, algorithm: str, gpus: int) -> str:
    """Generate a fallback vllm serve command from metadata."""
    algo = algorithm.lower()

    if algo == "mtp":
        # MTP uses the target model directly
        parts = ["vllm", "serve", target, "--no-enable-chunked-prefill"]
        if gpus > 1:
            parts.extend(["-tp", str(gpus)])
        return " ".join(parts)

    # eagle3, dflash, peagle, dspark: vLLM auto-detects from config.json
    parts = ["vllm", "serve", model]
    if gpus > 1:
        parts.extend(["-tp", str(gpus)])
    return " ".join(parts)


def lookup_deploy(model: str, target: str, algorithm: str, gpus: int) -> dict:
    """Look up or generate a deploy command for a speculator model.

    Args:
        model: The speculator model HF ID (e.g. "RedHatAI/Llama-3.1-8B-eagle3")
        target: The target/verifier model HF ID (e.g. "meta-llama/Llama-3.1-8B")
        algorithm: Speculation algorithm (eagle3, dflash, peagle, dspark, mtp)
        gpus: Number of GPUs for tensor parallelism

    Returns:
        {"command": str, "recipe_source": str, "recipe_model": str}
    """
    # Try recipe lookup first
    try:
        recipe = _lookup_recipe(target)
    except Exception:
        recipe = None

    if recipe:
        return recipe

    # Fallback: generate from metadata
    return {
        "command": _generate_command(model, target, algorithm, gpus),
        "recipe_source": "",
        "recipe_model": "",
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Deploy command recipe-lookup agent")
    ap.add_argument("--model", required=True, help="Speculator model HF ID")
    ap.add_argument("--target", required=True, help="Target/verifier model HF ID")
    ap.add_argument("--algorithm", required=True, help="Speculation algorithm")
    ap.add_argument("--gpus", type=int, required=True, help="Number of GPUs")
    args = ap.parse_args()

    result = lookup_deploy(args.model, args.target, args.algorithm, args.gpus)
    json.dump(result, sys.stdout, indent=2)
    print()


if __name__ == "__main__":
    main()
