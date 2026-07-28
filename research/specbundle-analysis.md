# SpecBundle Dashboard Analysis

> Research for issue #4 -- competitive analysis to inform speculators dashboard design.
> Date: 2026-07-28

---

## 1. SpecBundle Dashboard: Architecture and Features

**Source**: `sgl-project/SpecForge/docs/spec_bundle/` -- a Vue 3 + Vite SPA using ECharts (via `vue-echarts`).

### 1.1 Layout and Structure

The dashboard is a single-page app with these sections (top to bottom):

| Section | Purpose |
|---------|---------|
| **Header/Hero** | Logo, "Powered by SpecForge" tagline, HuggingFace link, back-to-docs nav |
| **Filter Controls** | 4 dropdowns in a grid: Target Model, Draft Model, Benchmark, Metric |
| **Stats Overview** | 3 stat cards: Target Model name, Draft Models count, Configurations count |
| **Performance Chart** | ECharts grouped bar chart (500px tall) |
| **Detailed Results Table** | Full data table with per-benchmark metrics |
| **Footer** | "Powered by SpecForge Team" |

### 1.2 Metrics Shown

Three selectable metrics via dropdown:
- **Throughput (tokens/s)** -- default view
- **Acceptance Length** -- average accepted draft tokens per step
- **Speedup vs Baseline** -- ratio against autoregressive decoding (no draft)

Per-benchmark columns show **Acc Len / Tokens/s** as a dual value in each cell. Speedup tags are color-coded: excellent (>=2x, green), good (>=1.5x, blue), moderate (>=1.1x, orange), neutral (gray).

### 1.3 Benchmarks Covered

Seven benchmarks: `gsm8k`, `math500`, `mtbench`, `humaneval`, `livecodebench`, `financeqa`, `gpqa`.

### 1.4 Filtering Model

Four independent dropdowns:
1. **Target Model** -- top-level key in the JSON (e.g., `Qwen/Qwen3-235B-A22B-Instruct-2507`)
2. **Draft Model** -- "All Draft Models" or specific draft (e.g., `SpecBundle`, community EAGLE3)
3. **Benchmark** -- "All Benchmarks" or individual (affects chart pivot)
4. **Metric** -- throughput, acceptance length, or speedup

When benchmark = "all", the chart pivots to show benchmarks on the X-axis with grouped bars per configuration. When a single benchmark is selected, configurations appear on the X-axis.

### 1.5 Data Model

```
data.json
  -> { targetModel: { benchmark: { results: [ { batch_size, steps, topk, num_draft_tokens, metrics: [ { Name, output_throughput, accept_length } ] } ] } } }
```

Key dimensions:
- **Target models**: ~12 (Llama-3.1-8B through Qwen3-480B)
- **Algorithms**: EAGLE3 only (compared against "Without EAGLE3" baseline)
- **Configurations**: batch_size / steps / topk / num_draft_tokens combinations
- **Hardware**: H200 GPUs (parallel config noted but not prominently surfaced)

### 1.6 Visual Design

- **Theme**: Light mode only (`#F8FAFC` background, white cards)
- **Typography**: Inter (body), Outfit (display), Space Grotesk
- **Color palette**: Indigo primary (#4F46E5), Slate neutrals, semantic greens/ambers for speedup badges
- **Cards**: White surfaces with subtle shadows, 12-16px border radius
- **Responsive**: 4-column filter grid at desktop, 2-column at tablet, 1-column at mobile

### 1.7 Interactivity

- Dropdown-driven filtering (4 filters)
- Chart view changes based on benchmark selection (pivoted vs per-config)
- DataZoom slider for charts with many configurations
- Hover tooltips on chart and table rows
- Sticky first column in table for horizontal scrolling

---

## 2. SpecBundle Strengths

1. **Multi-benchmark comparison**: Seven benchmarks give a comprehensive view across task types (code, math, QA, conversation).
2. **Throughput as primary metric**: The default view shows what practitioners care about most.
3. **Configuration exploration**: Users can compare different batch_size/steps/topk/num_draft_tokens combinations, surfacing the best serving configuration.
4. **Dual-value table cells**: Showing acceptance length and throughput side-by-side in each cell is information-dense.
5. **Speedup color coding**: The tiered speedup badges (excellent/good/moderate/neutral) provide instant visual ranking.
6. **Clean, modern design**: The light theme with consistent spacing and typography is polished.
7. **Pivoted chart mode**: When "all benchmarks" is selected, the chart shows cross-benchmark comparison -- useful for spotting domain-specific weaknesses.

---

## 3. SpecBundle Weaknesses

### 3.1 Critical Gaps

1. **Single algorithm**: Only compares EAGLE3 vs baseline (no draft). No cross-algorithm comparison (no DFlash, P-EAGLE, MTP, Domino, DSpark). This is the biggest gap -- users cannot decide which speculative decoding method to use.

2. **No cross-target comparison**: The target model dropdown shows one target at a time. There is no way to compare "how does EAGLE3 perform on Llama-3.1-8B vs Qwen3-8B?" without switching back and forth.

3. **Hidden hardware context**: GPU configuration is barely surfaced (no column in table by default, just a text note on the chart). Users cannot filter or compare across hardware.

4. **No ranking or leaderboard**: There is no global ranking view. Each target model is a silo. Users cannot see "which draft model across all targets gives the best speedup?"

5. **No acceptance-at-position data**: SpecBundle only shows aggregate acceptance length. The per-position acceptance rate (a key diagnostic for understanding where drafts fail) is absent.

### 3.2 UX Issues

6. **Light mode only**: No dark mode support. Many developer dashboards are viewed in dark environments.

7. **No text search**: Users must use dropdowns to navigate. There is no search-as-you-type for models.

8. **No URL state**: Filter selections are not reflected in the URL. Users cannot share or bookmark a specific view.

9. **No expandable detail rows**: The table is flat -- no drill-down into per-subset or per-position data.

10. **No sorting**: Table columns are not sortable. Users cannot reorder by throughput or speedup.

11. **No export**: There is a placeholder for export actions but no implementation.

12. **Chart label overlap**: When many configurations are shown, the X-axis labels overlap despite the 30-degree rotation.

### 3.3 Data Presentation

13. **Configuration naming is cryptic**: Configs are shown as `batch_size-steps-topk-num_draft_tokens` (e.g., `1-3-1-4`) with only a small legend explaining the format.

14. **No trend/history view**: There is no temporal dimension -- no way to see how model performance has changed over time or across model versions.

15. **No error/failure handling visible**: Failed evaluations are not displayed in any meaningful way.

---

## 4. Spec-Bench: Alternative Leaderboard Design

**Source**: [Spec-Bench](https://sites.google.com/view/spec-bench) (ACL 2024 Findings)

### What It Does Differently

- Compares **six speculative decoding methods**: Speculative Sampling, Medusa, EAGLE, Lookahead, PLD, REST
- Reports **speedup ratio** as the primary metric across six subtasks
- Tests across **multiple GPUs** (RTX 3090, A100) and **multiple temperatures**
- Provides a structured leaderboard with per-subtask and overall speedup columns

### Relevant Takeaways

- Cross-method comparison is the killer feature that SpecBundle lacks
- Per-task breakdown (math, QA, translation, summarization, RAG, conversation) maps well to our subset model
- Hardware dimension matters: speedup varies significantly between GPU generations
- Temperature/sampling strategy affects acceptance rate and should be a filter

---

## 5. Current Speculators Dashboard: State of Play

### Architecture

A vanilla JavaScript SPA (no framework) with 4 modules:
- `app.js` -- orchestrator, state, filter/sort wiring
- `data.js` -- fetch, normalize, filter, sort
- `render.js` -- DOM construction
- `charts.js` -- ECharts wrappers

### What It Already Does Well

1. **Multi-algorithm comparison**: Supports eagle3, dflash, peagle, mtp with distinct color-coded badges
2. **Dark theme**: GitHub-inspired dark mode with careful color choices
3. **Expandable detail rows**: Click a model row to see per-subset breakdown and per-position acceptance chart
4. **Sortable columns**: All metric columns are clickable for sort
5. **Text search**: Filter bar includes search-as-you-type
6. **Sparkline visualization**: Acceptance-at-position shown as inline sparkline bars
7. **Algorithm comparison chart**: Grouped bar chart comparing algorithms across targets
8. **Stats row**: Models evaluated, best speedup, algorithms compared

### What It Lacks Compared to SpecBundle

1. **Fewer benchmarks**: Only HumanEval and QA subsets vs SpecBundle's 7 benchmarks
2. **No throughput data yet**: The real `results.json` lacks throughput/speedup (sample data has it); the code handles both cases gracefully
3. **No configuration dimension**: No batch_size/steps/topk/num_draft_tokens comparison
4. **Light mode**: No light mode toggle
5. **Smaller model coverage**: ~10 models vs SpecBundle's ~15 targets
6. **No URL state persistence**: Same gap as SpecBundle

---

## 6. Differentiation Opportunities

Based on this analysis, the speculators dashboard can be **clearly better** by delivering these features that neither SpecBundle nor Spec-Bench provide:

### Tier 1: Core Differentiators

| Feature | SpecBundle | Spec-Bench | Speculators (target) |
|---------|-----------|------------|---------------------|
| Multi-algorithm comparison | No (EAGLE3 only) | Yes (6 methods) | **Yes (eagle3, dflash, peagle, mtp+)** |
| Cross-target comparison | No (1 target at a time) | Partial | **Yes (side-by-side)** |
| Per-position acceptance | No | No | **Yes (sparklines + charts)** |
| Expandable detail rows | No | No | **Yes (already built)** |
| Dark mode | No | No | **Yes (already default)** |
| Sortable table | No | No | **Yes (already built)** |
| Text search | No | No | **Yes (already built)** |

### Tier 2: High-Value Additions

1. **Global leaderboard view**: "Best drafter for each target" -- a ranked list across all algorithms
2. **Hardware-aware filtering**: Filter by GPU config, show results normalized per-GPU
3. **URL state**: Encode filters/sort in URL hash for shareable views
4. **Subset heatmap**: Show acceptance length per benchmark/subset as a color-coded matrix
5. **Failure reporting**: Surface evaluation errors clearly (already in schema)

### Tier 3: Polish

6. **Light/dark toggle**: Support both themes
7. **Export to CSV/JSON**: One-click data export
8. **Responsive improvements**: Better mobile table handling
9. **Trend view**: Show acceptance rate trends as models are re-evaluated over time

---

## 7. Key Takeaways

1. **SpecBundle's biggest weakness is our biggest strength**: They compare one algorithm (EAGLE3) vs baseline. We compare four+ algorithms head-to-head. This is the single most important differentiator for users choosing a speculative decoding strategy.

2. **SpecBundle excels at configuration tuning** (batch_size/steps/topk/num_draft_tokens). We should consider adding this dimension if our eval pipeline supports it.

3. **The speculators dashboard already has several features SpecBundle lacks**: expandable detail rows, sortable columns, text search, dark mode, per-position acceptance data, multi-algorithm badges.

4. **The gap to close is data richness**: More benchmarks (beyond HumanEval and QA), real throughput numbers, and more target models.

5. **Neither dashboard provides a "recommendation" view** -- answering the question "which drafter should I use for my model?" requires mental comparison across rows. An explicit "Best for this target" highlight would be novel.

---

## Sources

- [SpecBundle Dashboard Source](https://github.com/sgl-project/SpecForge/tree/main/docs/spec_bundle) (Vue 3 + Vite + ECharts)
- [SpecBundle Blog Post](https://www.lmsys.org/blog/2025-12-23-spec-bundle-phase-1/)
- [SpecBundle Documentation](https://sgl-project.github.io/SpecForge/community_resources/specbundle.html)
- [SpecBundle HuggingFace Collection](https://huggingface.co/collections/lmsys/specbundle)
- [Spec-Bench](https://sites.google.com/view/spec-bench) (ACL 2024 Findings)
- [SpecForge Paper](https://arxiv.org/abs/2603.18567)
