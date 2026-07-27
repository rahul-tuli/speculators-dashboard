"use strict";

/* ============================================================
   Speculators Dashboard v2 — app.js
   Single-page, throughput-first layout.
   Loaded after charts.js.
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
  chartInstances: {},
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

function cacheBust(url) {
  return url + "?t=" + Date.now();
}

function fetchJson(url) {
  return fetch(cacheBust(url), { cache: "no-store" }).then(function (res) {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  });
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

function shortName(modelId) {
  if (!modelId || typeof modelId !== "string") return modelId || "—";
  var idx = modelId.indexOf("/");
  return idx >= 0 ? modelId.substring(idx + 1) : modelId;
}

function targetFamily(targetId) {
  if (!targetId || typeof targetId !== "string") return targetId || "—";
  var idx = targetId.indexOf("/");
  return idx >= 0 ? targetId.substring(idx + 1) : targetId;
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

function metricValue(m) {
  return m && m.metrics && typeof m.metrics.acceptance_length === "number"
    ? m.metrics.acceptance_length
    : null;
}

function throughputValue(m) {
  return m && m.metrics && typeof m.metrics.throughput_tps === "number"
    ? m.metrics.throughput_tps
    : null;
}

function speedupValue(m) {
  return m && m.metrics && typeof m.metrics.speedup === "number"
    ? m.metrics.speedup
    : null;
}

function speedupClass(val) {
  if (val === null || val === undefined) return "";
  if (val >= 2) return "speedup-excellent";
  if (val >= 1.5) return "speedup-good";
  if (val >= 1.2) return "speedup-moderate";
  return "speedup-low";
}

// ── Section 4: Data Loading ────────────────────────────────────

function loadData() {
  return fetchJson(RESULTS_URL).then(
    function (data) {
      if (data && Array.isArray(data.models) && data.models.length > 0) {
        return { data: data, isSample: false };
      }
      throw new Error("empty");
    },
    function () { throw new Error("fetch failed"); }
  ).catch(function () {
    return fetchJson(SAMPLE_URL).then(
      function (data) { return { data: data, isSample: true }; },
      function () { return { data: null, isSample: false }; }
    );
  });
}

function processData(models) {
  var targets = {};
  var algos = {};
  var anyThroughput = false;

  models.forEach(function (m) {
    if (m.target) targets[m.target] = true;
    if (m.algorithm) algos[m.algorithm] = true;

    // Pre-compute display values
    m._shortName = shortName(m.model);
    m._targetFamily = targetFamily(m.target);
    m._acceptanceLength = metricValue(m);
    m._throughput = throughputValue(m);
    m._speedup = speedupValue(m);

    if (m._throughput !== null) anyThroughput = true;
  });

  state.uniqueTargets = Object.keys(targets).sort();
  state.uniqueAlgorithms = Object.keys(algos).sort();
  state.hasThroughput = anyThroughput;
}

// ── Section 5: Filtering ───────────────────────────────────────

function applyFilters() {
  var f = state.filters;
  state.filtered = state.raw.filter(function (m) {
    if (f.target !== "all" && m.target !== f.target) return false;
    if (f.algorithm !== "all" && m.algorithm !== f.algorithm) return false;
    if (f.text) {
      var q = f.text.toLowerCase();
      var match = [m.model, m.target, m.algorithm].some(function (v) {
        return v && String(v).toLowerCase().indexOf(q) >= 0;
      });
      if (!match) return false;
    }
    return true;
  });
}

// ── Section 6: Sorting ────────────────────────────────────────

function applySorting() {
  var key = state.sortKey;
  var dir = state.sortDir;

  state.filtered.sort(function (a, b) {
    // Failed entries always last
    var af = a.status === "failed" ? 1 : 0;
    var bf = b.status === "failed" ? 1 : 0;
    if (af !== bf) return af - bf;

    var sign = dir === "asc" ? 1 : -1;
    var av, bv, cmp;

    if (key === "model") {
      av = a.model || "";
      bv = b.model || "";
      cmp = String(av).localeCompare(String(bv)) * sign;
    } else if (key === "target") {
      av = a.target || "";
      bv = b.target || "";
      cmp = String(av).localeCompare(String(bv)) * sign;
    } else if (key === "gpus") {
      av = a.gpus || "";
      bv = b.gpus || "";
      cmp = String(av).localeCompare(String(bv)) * sign;
    } else if (key === "throughput_tps") {
      av = a._throughput;
      bv = b._throughput;
      cmp = compareNumeric(av, bv, sign);
    } else if (key === "speedup") {
      av = a._speedup;
      bv = b._speedup;
      cmp = compareNumeric(av, bv, sign);
    } else if (key === "acceptance_length") {
      av = a._acceptanceLength;
      bv = b._acceptanceLength;
      cmp = compareNumeric(av, bv, sign);
    } else if (key === "evaluated_at") {
      av = Date.parse(a.evaluated_at || "") || null;
      bv = Date.parse(b.evaluated_at || "") || null;
      cmp = compareNumeric(av, bv, sign);
    } else {
      cmp = 0;
    }

    // Tiebreak by model name
    if (cmp === 0) cmp = String(a.model || "").localeCompare(String(b.model || ""));
    return cmp;
  });
}

function compareNumeric(av, bv, sign) {
  var aMiss = av === null || av === undefined || (typeof av === "number" && isNaN(av));
  var bMiss = bv === null || bv === undefined || (typeof bv === "number" && isNaN(bv));
  if (aMiss && bMiss) return 0;
  if (aMiss) return 1;   // nulls always last
  if (bMiss) return -1;
  return (av - bv) * sign;
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
      var s = speedupValue(m);
      if (s !== null && (best === null || s > best)) { best = s; bestModel = m; }
    });
    if (statBestEl) statBestEl.textContent = best !== null ? best.toFixed(1) + "x" : "—";
    if (statBestLabelEl) statBestLabelEl.textContent = bestModel ? shortName(bestModel.model) : "Best Speedup";
  } else {
    var bestAcc = null;
    var bestAccModel = null;
    ok.forEach(function (m) {
      var v = metricValue(m);
      if (v !== null && (bestAcc === null || v > bestAcc)) { bestAcc = v; bestAccModel = m; }
    });
    if (statBestEl) statBestEl.textContent = bestAcc !== null ? bestAcc.toFixed(2) : "—";
    if (statBestLabelEl) statBestLabelEl.textContent = bestAccModel ? shortName(bestAccModel.model) : "Best Accept. Len";
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
      opt.textContent = targetFamily(t);
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
  applyFilters();
  applySorting();
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
  // Dispose any existing detail chart instances before re-rendering
  disposeDetailCharts();

  var tbody = document.getElementById("models-tbody");
  if (!tbody) return;
  tbody.textContent = "";

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
      disposeDetailChartsForModel(m.model);
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

  // 3. Throughput column
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

  // 4. Speedup column
  var tdSpeedup = el("td", "col-metric");
  if (m._speedup !== null) {
    var sClass = "speedup-badge " + speedupClass(m._speedup);
    tdSpeedup.appendChild(el("span", sClass, m._speedup.toFixed(1) + "x"));
  } else {
    tdSpeedup.textContent = "—";
  }
  tr.appendChild(tdSpeedup);

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
  td.colSpan = 8;
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
      Charts.subsetPositions(detailContainerId(m.model, "pos"), m, state.chartInstances);
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
      applySorting();
      renderTable();
    });
  });
}

// ── Section 12: Chart Rendering ────────────────────────────────

function renderChart() {
  var ok = state.filtered.filter(function (m) { return m.status === "ok"; });
  if (ok.length === 0) {
    var dom = document.getElementById("chart-algo-compare");
    if (dom) dom.innerHTML = '<div class="placeholder">No data matches the current filters.</div>';
    var descEl = document.getElementById("chart-desc");
    if (descEl) descEl.textContent = "";
    return;
  }
  Charts.algoCompare("chart-algo-compare", ok, ALGO_COLORS, ALGO_ORDER, state.hasThroughput, state.chartInstances);
}

// ── Section 13: Render All ─────────────────────────────────────

function renderAll() {
  renderStats();
  renderTable();
  renderChart();
}

// ── Section 14: Chart Disposal Utilities ───────────────────────

function disposeChart(id) {
  if (state.chartInstances[id]) {
    state.chartInstances[id].dispose();
    delete state.chartInstances[id];
  }
}

function disposeDetailCharts() {
  Object.keys(state.chartInstances).forEach(function (key) {
    if (key.indexOf("detail-") === 0) {
      disposeChart(key);
    }
  });
}

function disposeDetailChartsForModel(modelId) {
  var posId = detailContainerId(modelId, "pos");
  disposeChart(posId);
}

// ── Section 15: Window Resize + Init ───────────────────────────

window.addEventListener("resize", function () {
  Object.keys(state.chartInstances).forEach(function (key) {
    if (state.chartInstances[key]) {
      try {
        state.chartInstances[key].resize();
      } catch (e) {
        // Chart may have been disposed
      }
    }
  });
});

function init() {
  setupFilterListeners();
  setupSortListeners();

  loadData().then(function (result) {
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
    processData(state.raw);
    populateFilters();

    var lastUpdatedEl = document.getElementById("last-updated");
    if (lastUpdatedEl) lastUpdatedEl.textContent = "Last updated: " + fmtDate(result.data.updated_at);

    // Set default sort based on available data
    if (state.hasThroughput) {
      state.sortKey = "speedup";
    } else {
      state.sortKey = "acceptance_length";
    }
    state.sortDir = "desc";

    applyFilters();
    applySorting();
    renderAll();
  });
}

document.addEventListener("DOMContentLoaded", init);
