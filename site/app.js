"use strict";

/* ============================================================
   Speculators Dashboard v2 — app.js
   Thin orchestrator: state, filters, sort wiring, init.
   Loaded after render.js and data.js.
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
  uniqueTargets: [],
  uniqueAlgorithms: [],
  hasThroughput: false,
};

// ── Filter Controls ───────────────────────────────────────────

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
        state.sortDir = (key === "model" || key === "target" || key === "gpus") ? "asc" : "desc";
      }
      Data.sort(state.filtered, state.sortKey, state.sortDir);
      renderAll();
    });
  });
}

// ── Render All ────────────────────────────────────────────────

function renderAll() {
  Render.stats(state.filtered, state.hasThroughput);
  Render.table(state.filtered, {
    hasThroughput: state.hasThroughput,
    expandedModel: state.expandedModel,
    sortKey: state.sortKey,
    sortDir: state.sortDir,
    rawCount: state.raw.length,
    onToggleExpand: function (model) {
      state.expandedModel = state.expandedModel === model ? null : model;
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
    state.uniqueTargets = info.uniqueTargets;
    state.uniqueAlgorithms = info.uniqueAlgorithms;
    state.hasThroughput = info.hasThroughput;
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
