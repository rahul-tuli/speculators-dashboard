---
name: deploy-commands
description: Research and post vLLM deployment commands for drafter models on the open eval issues of this repo. Use when asked to fill in, figure out, or refresh deployment/deploy/serve commands on the eval issue backlog.
---

Every open eval issue needs a deployment command for its drafter, posted as a comment. The command must come from polling real sources — the drafter's HuggingFace model card and the verifier's recipe on https://recipes.vllm.ai/ — never from memory.

## Steps

1. **List the open eval issues.**
   ```bash
   gh issue list --repo rahul-tuli/speculators-dashboard --label eval:pending --state open --json number,title,body --limit 100
   ```
   If the user asked for all eval issues regardless of label, drop `--label` and match titles starting with `Eval:`.

2. **Skip issues already answered.** Fetch each issue's comments and skip any that already contain a `### Deployment command` heading — unless the user asked to refresh, in which case post a fresh comment anyway.
   ```bash
   gh issue view <number> --repo rahul-tuli/speculators-dashboard --json comments --jq '.comments[].body'
   ```

3. **Parse the issue body table.** Each eval issue carries a markdown table with: `Model` (the drafter), `Target` (the verifier), `Algorithm`, `Speculative Tokens`, `GPUs` (form `4xh100`). Values may be backtick-wrapped. Missing or unparseable fields → note the gap in the comment instead of guessing.

4. **Poll the sources, in this order.**
   - **Drafter's HF model card**: `https://huggingface.co/<model>/raw/main/README.md` — look for a `vllm serve` snippet or a documented speculative config.
   - **Verifier's recipe**: fetch `https://recipes.vllm.ai/models.json`, find the entry matching the target model, fetch that recipe, extract its serve command.

5. **Compose the command.** Base it on the verifier's recipe command, then add the speculative config for the drafter. If no recipe exists for the verifier, fall back to the model card's command. If neither source yields a command, post a comment saying which sources were checked and came up empty — do not invent flags.

6. **Post the comment.**
   ```bash
   gh issue comment <number> --repo rahul-tuli/speculators-dashboard --body "..."
   ```
   Format: a `### Deployment command` heading, the command in a `bash` code block, then a Sources line naming the HF card URL and the recipe URL (or "no recipe found for `<target>`").

7. **Report.** End with a per-issue list: issue title → posted / skipped (already had one) / no command found. Every open eval issue must appear in the report exactly once.

## Command rules

- **Long-form flags only**: `--tensor-parallel-size 4`, never `-tp 4`. Expand any shorthand a source uses.
- **At least 5 speculative tokens**: the speculative config carries `"num_speculative_tokens": 5` at minimum — raise it if a source recommends more, never lower it.
- **Tensor parallelism follows the issue's GPU count** (the number before `x` in the GPUs field); omit the flag entirely for 1 GPU.
- The speculative config points at the **drafter** (the issue's Model), with the method matching the issue's Algorithm.
