"use strict";

/* ============================================================
   Speculators Dashboard — app.js
   State management and orchestration (Variant A design).
   ============================================================ */

// ── Constants ─────────────────────────────────────────────────

var RESULTS_URL = "./results.json";
var SAMPLE_URL = "./sample-results.json";

var ALGO_COLORS = {
  eagle3: { bg: "rgba(16,185,129,0.15)", text: "#10b981", chart: "#10b981" },
  dflash: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", chart: "#f59e0b" },
  peagle: { bg: "rgba(139,92,246,0.15)", text: "#8b5cf6", chart: "#8b5cf6" },
  mtp:    { bg: "rgba(6,182,212,0.15)",  text: "#06b6d4", chart: "#06b6d4" },
};
var ALGO_ORDER = ["eagle3", "dflash", "peagle", "mtp"];

// ── State ─────────────────────────────────────────────────────

var state = {
  raw: [],
  filtered: [],
  sortKey: "speedup",
  sortDir: "desc",
  filters: { target: "all", algorithm: "all", text: "" },
  expandedModel: null,
  deployOpen: null,
  targetTabs: [],
  uniqueAlgorithms: [],
  hasThroughput: false,
};

// ── Filter Controls ───────────────────────────────────────────

function populateFilters() {
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

// ── Sort Listeners ────────────────────────────────────────────

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
        // Default sort direction: ascending for text columns, descending for metrics
        // TTFT and ITL are "lower is better" so default descending still shows high first,
        // user can toggle to asc to see lowest first
        state.sortDir = (key === "model" || key === "gpus") ? "asc" : "desc";
      }
      Data.sort(state.filtered, state.sortKey, state.sortDir);
      renderAll();
    });
  });
}

// ── Render All ────────────────────────────────────────────────

function renderAll() {
  Render.stats(state.filtered, state.hasThroughput);

  Render.targetTabs(state.targetTabs, state.filters.target, state.raw.length, function (target) {
    state.filters.target = target;
    onFilterChange();
  });

  Render.table(state.filtered, {
    hasThroughput: state.hasThroughput,
    expandedModel: state.expandedModel,
    deployOpen: state.deployOpen,
    activeTarget: state.filters.target,
    sortKey: state.sortKey,
    sortDir: state.sortDir,
    rawCount: state.raw.length,
    onToggleExpand: function (model) {
      state.expandedModel = state.expandedModel === model ? null : model;
      renderAll();
    },
    onToggleDeploy: function (model) {
      state.deployOpen = state.deployOpen === model ? null : model;
      renderAll();
    }
  });

  Render.chart(state.filtered, {
    hasThroughput: state.hasThroughput,
    algoColors: ALGO_COLORS,
    algoOrder: ALGO_ORDER
  });
}

// ── Window Resize + Init ──────────────────────────────────────

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
    state.uniqueAlgorithms = info.uniqueAlgorithms;
    state.hasThroughput = info.hasThroughput;
    state.targetTabs = Data.targetTabs(state.raw);
    populateFilters();

    var lastUpdatedEl = document.getElementById("last-updated");
    if (lastUpdatedEl) lastUpdatedEl.textContent = "Last updated: " + Render.fmtDate(result.data.updated_at);

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
