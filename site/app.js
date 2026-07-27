"use strict";

/* ============================================================
   Speculators Dashboard v2 — app.js
   Single-page, throughput-first layout.
   Loaded after data.js and charts.js.
   ============================================================ */

// ── Section 1: Constants ───────────────────────────────────────

var RESULTS_URL = "../results.json";
var SAMPLE_URL = "./sample-results.json";

var ALGO_COLORS = {
  eagle3: { bg: "rgba(16,185,129,0.15)", text: "#10b981", chart: "#10b981" },
  dflash: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", chart: "#f59e0b" },
  peagle: { bg: "rgba(139,92,246,0.15)", text: "#8b5cf6", chart: "#8b5cf6" },
  mtp:    { bg: "rgba(6,182,212,0.15)",  text: "#06b6d4", chart: "#06b6d4" },
};
var ALGO_ORDER = ["eagle3", "dflash", "peagle", "mtp"];

// ── Section 2: State ───────────────────────────────────────────

var state = {
  raw: [],
  filtered: [],
  sortKey: "speedup",
  sortDir: "desc",
  filters: { target: "all", algorithm: "all", text: "" },
  expandedModel: null,
  uniqueTargets: [],
  uniqueAlgorithms: [],
  hasThroughput: false,
};

// ── Section 3: DOM Helpers ─────────────────────────────────────

function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function relativeDate(iso) {
  if (!iso) return "—";
  var t = Date.parse(iso);
  if (isNaN(t)) return "—";
  var diff = Date.now() - t;
  var abs = Math.abs(diff);
  var mins = Math.round(abs / 60000);
  var s;
  if (mins < 60) s = mins <= 1 ? "1m" : mins + "m";
  else if (mins < 60 * 24) s = Math.round(mins / 60) + "h";
  else if (mins < 60 * 24 * 30) s = Math.round(mins / (60 * 24)) + "d";
  else if (mins < 60 * 24 * 365) s = Math.round(mins / (60 * 24 * 30)) + "mo";
  else s = Math.round(mins / (60 * 24 * 365)) + "y";
  return diff >= 0 ? s + " ago" : "in " + s;
}

function fmtDate(iso) {
  var t = Date.parse(iso || "");
  if (isNaN(t)) return iso || "—";
  return new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function hfLink(modelId) {
  if (!modelId || typeof modelId !== "string") return null;
  var a = el("a", "mono");
  a.href = "https://huggingface.co/" + encodeURI(modelId);
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.addEventListener("click", function (e) { e.stopPropagation(); });
  return a;
}

function algoClass(algo) {
  var map = { eagle3: "badge-eagle3", dflash: "badge-dflash", peagle: "badge-peagle", mtp: "badge-mtp" };
  return map[(algo || "").toLowerCase()] || "badge-other";
}

function speedupClass(val) {
  if (val === null || val === undefined) return "";
  if (val >= 2) return "speedup-excellent";
  if (val >= 1.5) return "speedup-good";
  if (val >= 1.2) return "speedup-moderate";
  return "speedup-low";
}

// ── Section 7: (Hero is now static HTML — no dynamic rendering needed) ──

// ── Section 8: Stats Rendering ─────────────────────────────────

function renderStats() {
  var ok = state.filtered.filter(function (m) { return m.status === "ok"; });

  // Models evaluated
  var statModelsEl = document.getElementById("stat-models");
  if (statModelsEl) statModelsEl.textContent = ok.length;

  // Best speedup or acceptance length
  var statBestEl = document.getElementById("stat-best");
  var statBestLabelEl = document.getElementById("stat-best-label");

  if (state.hasThroughput) {
    var best = null;
    var bestModel = null;
    ok.forEach(function (m) {
      var s = Data.speedupValue(m);
      if (s !== null && (best === null || s > best)) { best = s; bestModel = m; }
    });
    if (statBestEl) statBestEl.textContent = best !== null ? best.toFixed(1) + "x" : "—";
    if (statBestLabelEl) statBestLabelEl.textContent = bestModel ? Data.shortName(bestModel.model) : "Best Speedup";
  } else {
    var bestAcc = null;
    var bestAccModel = null;
    ok.forEach(function (m) {
      var v = Data.metricValue(m);
      if (v !== null && (bestAcc === null || v > bestAcc)) { bestAcc = v; bestAccModel = m; }
    });
    if (statBestEl) statBestEl.textContent = bestAcc !== null ? bestAcc.toFixed(2) : "—";
    if (statBestLabelEl) statBestLabelEl.textContent = bestAccModel ? Data.shortName(bestAccModel.model) : "Best Accept. Len";
  }

  // Algorithms compared
  var algos = {};
  ok.forEach(function (m) { if (m.algorithm) algos[m.algorithm] = true; });
  var statAlgosEl = document.getElementById("stat-algos");
  if (statAlgosEl) statAlgosEl.textContent = Object.keys(algos).length;
}

// ── Section 9: Filter Controls ─────────────────────────────────

function populateFilters() {
  var targetSel = document.getElementById("filter-target");
  if (targetSel) {
    state.uniqueTargets.forEach(function (t) {
      var opt = document.createElement("option");
      opt.value = t;
      opt.textContent = Data.targetFamily(t);
      targetSel.appendChild(opt);
    });
  }

  var algoSel = document.getElementById("filter-algorithm");
  if (algoSel) {
    state.uniqueAlgorithms.forEach(function (a) {
      var opt = document.createElement("option");
      opt.value = a;
      opt.textContent = a;
      algoSel.appendChild(opt);
    });
  }
}

function setupFilterListeners() {
  var targetSel = document.getElementById("filter-target");
  if (targetSel) {
    targetSel.addEventListener("change", function (e) {
      state.filters.target = e.target.value;
      onFilterChange();
    });
  }

  var algoSel = document.getElementById("filter-algorithm");
  if (algoSel) {
    algoSel.addEventListener("change", function (e) {
      state.filters.algorithm = e.target.value;
      onFilterChange();
    });
  }

  var textInput = document.getElementById("filter-text");
  if (textInput) {
    textInput.addEventListener("input", function (e) {
      state.filters.text = e.target.value.trim();
      onFilterChange();
    });
  }
}

function onFilterChange() {
  state.filtered = Data.filter(state.raw, state.filters);
  Data.sort(state.filtered, state.sortKey, state.sortDir);
  renderAll();
}

// ── Section 10: Table Rendering ────────────────────────────────

function sparkline(values) {
  var wrap = el("span", "spark");
  if (!Array.isArray(values) || values.length === 0) {
    wrap.appendChild(el("span", null, "—"));
    return wrap;
  }
  for (var i = 0; i < values.length; i++) {
    var bar = el("span", "spark-bar");
    var h = Math.max(1, Math.round((Number(values[i]) || 0) * 18));
    bar.style.height = h + "px";
    bar.title = (Number(values[i]) || 0).toFixed(2);
    wrap.appendChild(bar);
  }
  return wrap;
}

function detailContainerId(modelId, suffix) {
  return "detail-" + suffix + "-" + modelId.replace(/[^a-zA-Z0-9]/g, "-");
}

function renderSortIndicators() {
  var ths = document.querySelectorAll("#models-table th");
  ths.forEach(function (th) {
    var old = th.querySelector(".sort-arrow");
    if (old) old.remove();
    if (th.dataset.key === state.sortKey) {
      th.appendChild(el("span", "sort-arrow", state.sortDir === "asc" ? "▲" : "▼"));
    }
  });
}

function renderTable() {
  Charts.disposeByPrefix("detail-");

  var tbody = document.getElementById("models-tbody");
  if (!tbody) return;
  tbody.textContent = "";

  var thThroughput = document.querySelector('#models-table th[data-key="throughput_tps"]');
  var thSpeedup = document.querySelector('#models-table th[data-key="speedup"]');
  if (thThroughput) thThroughput.hidden = !state.hasThroughput;
  if (thSpeedup) thSpeedup.hidden = !state.hasThroughput;

  var rows = state.filtered;
  var placeholder = document.getElementById("placeholder");
  var table = document.getElementById("models-table");

  if (rows.length === 0) {
    if (table) table.hidden = true;
    if (placeholder) {
      placeholder.hidden = false;
      placeholder.textContent = state.raw.length === 0
        ? "No evaluation results yet. Check back after the next eval run."
        : "No models match the current filters.";
    }
    return;
  }
  if (table) table.hidden = false;
  if (placeholder) placeholder.hidden = true;

  for (var i = 0; i < rows.length; i++) {
    var m = rows[i];
    tbody.appendChild(modelRow(m));
    if (state.expandedModel === m.model) {
      tbody.appendChild(detailRow(m));
    }
  }
  renderSortIndicators();
}

function modelRow(m) {
  var classes = "model-row";
  if (m.status === "failed") classes += " failed-row";
  if (state.expandedModel === m.model) classes += " expanded";

  var tr = el("tr", classes);
  tr.addEventListener("click", function () {
    if (state.expandedModel === m.model) {
      Charts.dispose(detailContainerId(m.model, "pos"));
    }
    state.expandedModel = state.expandedModel === m.model ? null : m.model;
    renderTable();
  });

  // 1. Drafter column: shortName link + algorithm badge
  var tdDrafter = el("td");
  var link = hfLink(m.model);
  if (link) {
    link.textContent = m._shortName || "—";
    tdDrafter.appendChild(link);
  } else {
    tdDrafter.appendChild(el("span", "mono", m._shortName || "—"));
  }
  tdDrafter.appendChild(document.createTextNode(" "));
  tdDrafter.appendChild(el("span", "badge-algo " + algoClass(m.algorithm), m.algorithm || "other"));
  tr.appendChild(tdDrafter);

  // 2. Target column
  var tdTarget = el("td");
  var targetLink = hfLink(m.target);
  if (targetLink) {
    targetLink.textContent = m._targetFamily || "—";
    tdTarget.appendChild(targetLink);
  } else {
    tdTarget.appendChild(el("span", "mono", m._targetFamily || "—"));
  }
  tr.appendChild(tdTarget);

  if (state.hasThroughput) {
    var tdThroughput = el("td", "col-metric");
    if (m._throughput !== null) {
      var tpVal = el("span", "throughput-value", Math.round(m._throughput).toLocaleString());
      var tpUnit = el("span", "throughput-unit", "tok/s");
      tdThroughput.appendChild(tpVal);
      tdThroughput.appendChild(tpUnit);
    } else {
      tdThroughput.textContent = "—";
    }
    tr.appendChild(tdThroughput);

    var tdSpeedup = el("td", "col-metric");
    if (m._speedup !== null) {
      var sClass = "speedup-badge " + speedupClass(m._speedup);
      tdSpeedup.appendChild(el("span", sClass, m._speedup.toFixed(1) + "x"));
    } else {
      tdSpeedup.textContent = "—";
    }
    tr.appendChild(tdSpeedup);
  }

  // 5. Acceptance Length column
  var tdAcc = el("td", "col-metric");
  tdAcc.textContent = m._acceptanceLength !== null ? m._acceptanceLength.toFixed(2) : "—";
  tr.appendChild(tdAcc);

  // 6. Acceptance@pos sparkline
  var tdSpark = el("td");
  tdSpark.appendChild(sparkline(m.metrics && m.metrics.acceptance_at_pos));
  tr.appendChild(tdSpark);

  // 7. GPUs
  tr.appendChild(el("td", null, m.gpus || "—"));

  // 8. Evaluated date
  tr.appendChild(el("td", null, relativeDate(m.evaluated_at)));

  return tr;
}

function detailRow(m) {
  var tr = el("tr", "detail-row");
  var td = el("td");
  td.colSpan = state.hasThroughput ? 8 : 6;
  var panel = el("div", "detail-panel");

  // Error text if failed
  if (m.error) {
    var errorHeader = el("h3", null, "Error");
    panel.appendChild(errorHeader);
    panel.appendChild(el("div", "error-text", m.error));
  }

  var subsets = m.metrics && m.metrics.subsets;
  var hasSubsets = subsets && Object.keys(subsets).length > 0;

  if (hasSubsets) {
    var subsetNames = Object.keys(subsets);

    // Left: detail-stats table
    var statsDiv = el("div", "detail-stats");
    var statsTable = el("table");
    var stHead = el("thead");
    var stHr = el("tr");
    var headers = ["Subset", "Throughput", "Speedup", "Accept. Len", "Drafts"];
    headers.forEach(function (h) { stHr.appendChild(el("th", null, h)); });
    stHead.appendChild(stHr);
    statsTable.appendChild(stHead);

    var stBody = el("tbody");
    subsetNames.forEach(function (name) {
      var s = subsets[name];
      var row = el("tr");
      row.appendChild(el("td", null, name));

      // Throughput
      var stTp = el("td", "col-metric");
      if (s.throughput_tps != null) {
        stTp.textContent = Math.round(s.throughput_tps).toLocaleString() + " tok/s";
      } else {
        stTp.textContent = "—";
      }
      row.appendChild(stTp);

      // Speedup
      var stSp = el("td", "col-metric");
      if (s.speedup != null) {
        stSp.textContent = s.speedup.toFixed(2) + "x";
      } else {
        stSp.textContent = "—";
      }
      row.appendChild(stSp);

      // Acceptance length
      var stAl = el("td", "col-metric");
      if (s.acceptance_length != null) {
        stAl.textContent = s.acceptance_length.toFixed(2);
      } else {
        stAl.textContent = "—";
      }
      row.appendChild(stAl);

      // Num drafts
      var stDr = el("td", "col-metric");
      stDr.textContent = s.num_drafts != null ? s.num_drafts.toLocaleString() : "—";
      row.appendChild(stDr);

      stBody.appendChild(row);
    });
    statsTable.appendChild(stBody);
    statsDiv.appendChild(statsTable);
    panel.appendChild(statsDiv);

    // Right: ECharts chart for acceptance@pos per subset
    var chartDiv = el("div", "detail-chart");
    var chartId = detailContainerId(m.model, "pos");
    chartDiv.id = chartId;
    panel.appendChild(chartDiv);
  }

  // Fallback: if no subsets but has position data, show text
  var pos = m.metrics && m.metrics.acceptance_at_pos;
  if (!hasSubsets && Array.isArray(pos) && pos.length > 0) {
    panel.appendChild(el("h3", null, "Acceptance rate by draft position"));
    var posText = pos.map(function (v, i) {
      return "Position " + (i + 1) + ": " + (Number(v) || 0).toFixed(2);
    }).join("  |  ");
    var posDiv = el("div", "mono");
    posDiv.style.gridColumn = "1 / -1";
    posDiv.style.color = "#8b949e";
    posDiv.textContent = posText;
    panel.appendChild(posDiv);
  }

  td.appendChild(panel);
  tr.appendChild(td);

  // Render ECharts after the DOM nodes are attached
  if (hasSubsets) {
    setTimeout(function () {
      Charts.subsetPositions(detailContainerId(m.model, "pos"), m);
    }, 0);
  }

  return tr;
}

// ── Section 11: Sort Listeners ─────────────────────────────────

function setupSortListeners() {
  var ths = document.querySelectorAll("#models-table th");
  ths.forEach(function (th) {
    th.addEventListener("click", function () {
      var key = th.dataset.key;
      if (!key) return;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        state.sortDir = (key === "model" || key === "target" || key === "gpus") ? "asc" : "desc";
      }
      Data.sort(state.filtered, state.sortKey, state.sortDir);
      renderTable();
    });
  });
}

// ── Section 12: Chart Rendering ────────────────────────────────

function renderChart() {
  var ok = state.filtered.filter(function (m) { return m.status === "ok"; });
  var descEl = document.getElementById("chart-desc");
  if (ok.length === 0) {
    var dom = document.getElementById("chart-algo-compare");
    if (dom) dom.innerHTML = '<div class="placeholder">No data matches the current filters.</div>';
    if (descEl) descEl.textContent = "";
    return;
  }
  if (descEl) {
    descEl.textContent = state.hasThroughput
      ? "Best throughput (tok/s) per algorithm on each target model"
      : "Best acceptance length per algorithm on each target model";
  }
  Charts.algoCompare("chart-algo-compare", ok, ALGO_COLORS, ALGO_ORDER, state.hasThroughput);
}

// ── Section 13: Render All ─────────────────────────────────────

function renderAll() {
  renderStats();
  renderTable();
  renderChart();
}

// ── Section 14: Window Resize + Init ──────────────────────────

window.addEventListener("resize", function () {
  Charts.resize();
});

function init() {
  setupFilterListeners();
  setupSortListeners();

  Data.load(RESULTS_URL, SAMPLE_URL).then(function (result) {
    if (!result.data || !Array.isArray(result.data.models)) {
      var ph = document.getElementById("placeholder");
      if (ph) {
        ph.hidden = false;
        ph.textContent = "Could not load evaluation results.";
      }
      return;
    }

    var samplePill = document.getElementById("sample-pill");
    if (result.isSample && samplePill) samplePill.hidden = false;

    state.raw = result.data.models;
    var info = Data.process(state.raw);
    state.uniqueTargets = info.uniqueTargets;
    state.uniqueAlgorithms = info.uniqueAlgorithms;
    state.hasThroughput = info.hasThroughput;
    populateFilters();

    var lastUpdatedEl = document.getElementById("last-updated");
    if (lastUpdatedEl) lastUpdatedEl.textContent = "Last updated: " + fmtDate(result.data.updated_at);

    if (state.hasThroughput) {
      state.sortKey = "speedup";
    } else {
      state.sortKey = "acceptance_length";
    }
    state.sortDir = "desc";

    state.filtered = Data.filter(state.raw, state.filters);
    Data.sort(state.filtered, state.sortKey, state.sortDir);
    renderAll();
  });
}

document.addEventListener("DOMContentLoaded", init);
