"use strict";

/* ============================================================
   Speculators Dashboard — charts.js
   Global Charts object for ECharts-based visualizations.
   Requires ECharts 5.5.1.
   ============================================================ */

var Charts = {};

var _instances = {};

// ── Shared defaults ────────────────────────────────────────────

var CHART_DEFAULTS = {
  backgroundColor: "transparent",
  textStyle: { fontFamily: "Inter, -apple-system, sans-serif" },
  tooltip: {
    backgroundColor: "#0f172a",
    borderColor: "rgba(255,255,255,0.1)",
    textStyle: { color: "#f8fafc", fontSize: 12 },
  },
};

/**
 * Dispose any previous chart on the same container, then init a fresh one.
 * Returns the new ECharts instance (or null if the DOM node is missing).
 */
function initChart(containerId) {
  if (_instances[containerId]) {
    _instances[containerId].dispose();
    delete _instances[containerId];
  }
  var dom = document.getElementById(containerId);
  if (!dom) return null;
  var chart = echarts.init(dom, "dark");
  _instances[containerId] = chart;
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

Charts.dispose = function (id) {
  if (_instances[id]) {
    _instances[id].dispose();
    delete _instances[id];
  }
};

Charts.disposeByPrefix = function (prefix) {
  Object.keys(_instances).forEach(function (key) {
    if (key.indexOf(prefix) === 0) {
      Charts.dispose(key);
    }
  });
};

Charts.disposeAll = function () {
  Object.keys(_instances).forEach(function (key) {
    Charts.dispose(key);
  });
};

Charts.resize = function () {
  Object.keys(_instances).forEach(function (key) {
    if (_instances[key]) {
      try { _instances[key].resize(); } catch (e) {}
    }
  });
};

// ── Algorithm Comparison — Grouped Bar ──────────────────────────

Charts.algoCompare = function (containerId, models, algoColors, algoOrder, hasThroughput) {
  var chart = initChart(containerId);
  if (!chart) return;

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
    legend: { data: presentAlgos, bottom: 0, textStyle: { color: "#e2e8f0", fontFamily: "Inter", fontSize: 11 } },
    xAxis: {
      type: "category",
      data: targets,
      axisLabel: { color: "#cbd5e1", fontFamily: "Inter", fontSize: 10, rotate: targets.length > 4 ? 15 : 0 },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      name: yAxisName,
      nameTextStyle: { color: "#cbd5e1", fontSize: 10, fontFamily: "Inter" },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
      axisLabel: { color: "#cbd5e1", fontFamily: "JetBrains Mono", fontSize: 10 },
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
          color: "#f8fafc",
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
