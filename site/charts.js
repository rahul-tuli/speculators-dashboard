"use strict";

/* ============================================================
   Speculators Dashboard v2 — charts.js
   Global Charts object for ECharts-based visualizations.
   Loaded before app.js. Requires ECharts 5.5.1.
   ============================================================ */

var Charts = {};

// ── Shared defaults ────────────────────────────────────────────

var CHART_DEFAULTS = {
  backgroundColor: "transparent",
  textStyle: { fontFamily: "Inter, -apple-system, sans-serif" },
  tooltip: {
    backgroundColor: "#1c2128",
    borderColor: "#30363d",
    textStyle: { color: "#e6edf3", fontSize: 12 },
  },
};

/**
 * Dispose any previous chart on the same container, then init a fresh one.
 * Returns the new ECharts instance (or null if the DOM node is missing).
 */
function initChart(containerId, instances) {
  if (instances[containerId]) {
    instances[containerId].dispose();
    delete instances[containerId];
  }
  var dom = document.getElementById(containerId);
  if (!dom) return null;
  var chart = echarts.init(dom, "dark");
  instances[containerId] = chart;
  return chart;
}

/**
 * Merge CHART_DEFAULTS into a raw option object (mutates & returns it).
 */
function mergeDefaults(option) {
  option.backgroundColor = CHART_DEFAULTS.backgroundColor;
  if (!option.textStyle) option.textStyle = {};
  option.textStyle.fontFamily = CHART_DEFAULTS.textStyle.fontFamily;
  if (!option.tooltip) option.tooltip = {};
  var td = CHART_DEFAULTS.tooltip;
  if (!option.tooltip.backgroundColor) option.tooltip.backgroundColor = td.backgroundColor;
  if (!option.tooltip.borderColor) option.tooltip.borderColor = td.borderColor;
  if (!option.tooltip.textStyle) option.tooltip.textStyle = {};
  if (!option.tooltip.textStyle.color) option.tooltip.textStyle.color = td.textStyle.color;
  if (!option.tooltip.textStyle.fontSize) option.tooltip.textStyle.fontSize = td.textStyle.fontSize;
  return option;
}

// ── Chart 1: Algorithm Comparison — Grouped Bar ────────────────

Charts.algoCompare = function (containerId, models, algoColors, algoOrder, hasThroughput, instances) {
  var chart = initChart(containerId, instances);
  if (!chart) return;

  // Update chart description text
  var descEl = document.getElementById("chart-desc");
  if (descEl) {
    descEl.textContent = hasThroughput
      ? "Best throughput (tok/s) per algorithm on each target model"
      : "Best acceptance length per algorithm on each target model";
  }

  // Group: { target: { algo: bestValue } }
  var targetAlgo = {};
  models.forEach(function (m) {
    var t = m._targetFamily;
    var a = m.algorithm;
    var v = hasThroughput ? (m._throughput || 0) : (m._acceptanceLength || 0);
    if (!t || !a || !v) return;
    if (!targetAlgo[t]) targetAlgo[t] = {};
    if (!targetAlgo[t][a] || v > targetAlgo[t][a]) targetAlgo[t][a] = v;
  });

  var targets = Object.keys(targetAlgo).sort();
  var presentAlgos = algoOrder.filter(function (a) {
    return targets.some(function (t) { return targetAlgo[t][a] !== undefined; });
  });

  if (targets.length === 0 || presentAlgos.length === 0) {
    var dom = document.getElementById(containerId);
    if (dom) dom.innerHTML = '<div class="placeholder">No data available for chart.</div>';
    return;
  }

  var yAxisName = hasThroughput ? "Throughput (tok/s)" : "Acceptance Length";

  var option = mergeDefaults({
    grid: { left: 10, right: 10, top: 30, bottom: 40, containLabel: true },
    legend: { data: presentAlgos, bottom: 0, textStyle: { color: "#8b949e" } },
    xAxis: {
      type: "category",
      data: targets,
      axisLabel: { color: "#e6edf3", fontSize: 12, rotate: targets.length > 5 ? 20 : 0 },
      axisLine: { lineStyle: { color: "#30363d" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      name: yAxisName,
      nameTextStyle: { color: "#8b949e" },
      splitLine: { lineStyle: { color: "#21262d" } },
      axisLabel: { color: "#8b949e" },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    series: presentAlgos.map(function (algo) {
      return {
        name: algo,
        type: "bar",
        data: targets.map(function (t) { return targetAlgo[t][algo] || null; }),
        itemStyle: {
          color: (algoColors[algo] || {}).chart || "#8b949e",
          borderRadius: [4, 4, 0, 0],
        },
        barGap: "15%",
        label: {
          show: true,
          position: "top",
          color: "#e6edf3",
          fontSize: 10,
          formatter: function (p) {
            if (!p.value) return "";
            return hasThroughput ? Math.round(p.value).toLocaleString() : p.value.toFixed(2);
          },
        },
      };
    }),
  });

  chart.setOption(option);
};

// ── Chart 2: Detail Row — Subset Acceptance@pos Grouped Bar ────

Charts.subsetPositions = function (containerId, model, instances) {
  var chart = initChart(containerId, instances);
  if (!chart) return;

  var subsets = model.metrics && model.metrics.subsets;
  if (!subsets) return;

  var names = Object.keys(subsets);
  var maxPos = 0;
  names.forEach(function (n) {
    var pos = subsets[n].acceptance_at_pos;
    if (Array.isArray(pos) && pos.length > maxPos) maxPos = pos.length;
  });

  if (maxPos === 0) return;

  var posLabels = [];
  for (var i = 0; i < maxPos; i++) posLabels.push("Pos " + (i + 1));

  var colors = ["#6366f1", "#f59e0b", "#10b981", "#f43f5e", "#8b5cf6", "#06b6d4"];

  var option = mergeDefaults({
    grid: { left: 10, right: 10, top: 30, bottom: 30, containLabel: true },
    legend: { data: names, bottom: 0, textStyle: { color: "#8b949e" } },
    xAxis: {
      type: "category",
      data: posLabels,
      axisLabel: { color: "#8b949e" },
      axisLine: { lineStyle: { color: "#30363d" } },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 1,
      splitLine: { lineStyle: { color: "#21262d" } },
      axisLabel: { color: "#8b949e" },
    },
    series: names.map(function (name, ni) {
      var pos = subsets[name].acceptance_at_pos || [];
      return {
        name: name,
        type: "bar",
        data: pos.map(function (v) { return parseFloat(v.toFixed(3)); }),
        itemStyle: { color: colors[ni % colors.length], borderRadius: [3, 3, 0, 0] },
        barGap: "10%",
      };
    }),
  });

  chart.setOption(option);
};
