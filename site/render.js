"use strict";

/* ============================================================
   Speculators Dashboard v2 — render.js
   DOM construction and rendering helpers.
   Loaded after charts.js and before data.js.
   ============================================================ */

var Render = {};

// ── Private Helpers ───────────────────────────────────────────

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

function renderSortIndicators(sortKey, sortDir) {
  var ths = document.querySelectorAll("#models-table th");
  ths.forEach(function (th) {
    var old = th.querySelector(".sort-arrow");
    if (old) old.remove();
    if (th.dataset.key === sortKey) {
      th.appendChild(el("span", "sort-arrow", sortDir === "asc" ? "▲" : "▼"));
    }
  });
}

function modelRow(m, opts) {
  var classes = "model-row";
  if (m.status === "failed") classes += " failed-row";
  if (opts.expandedModel === m.model) classes += " expanded";

  var tr = el("tr", classes);
  tr.addEventListener("click", function () {
    if (opts.expandedModel === m.model) {
      Charts.dispose(detailContainerId(m.model, "pos"));
    }
    opts.onToggleExpand(m.model);
  });

  // 1. Drafter column: shortName link + algorithm badge
  var tdDrafter = el("td");
  var link = hfLink(m.model);
  if (link) {
    link.textContent = m.shortName || "—";
    tdDrafter.appendChild(link);
  } else {
    tdDrafter.appendChild(el("span", "mono", m.shortName || "—"));
  }
  tdDrafter.appendChild(document.createTextNode(" "));
  tdDrafter.appendChild(el("span", "badge-algo " + algoClass(m.algorithm), m.algorithm || "other"));
  tr.appendChild(tdDrafter);

  // 2. Target column
  var tdTarget = el("td");
  var targetLink = hfLink(m.target);
  if (targetLink) {
    targetLink.textContent = m.targetFamily || "—";
    tdTarget.appendChild(targetLink);
  } else {
    tdTarget.appendChild(el("span", "mono", m.targetFamily || "—"));
  }
  tr.appendChild(tdTarget);

  if (opts.hasThroughput) {
    var tdThroughput = el("td", "col-metric");
    if (m.throughput !== null) {
      var tpVal = el("span", "throughput-value", Math.round(m.throughput).toLocaleString());
      var tpUnit = el("span", "throughput-unit", "tok/s");
      tdThroughput.appendChild(tpVal);
      tdThroughput.appendChild(tpUnit);
    } else {
      tdThroughput.textContent = "—";
    }
    tr.appendChild(tdThroughput);

    var tdSpeedup = el("td", "col-metric");
    if (m.speedup !== null) {
      var sClass = "speedup-badge " + speedupClass(m.speedup);
      tdSpeedup.appendChild(el("span", sClass, m.speedup.toFixed(1) + "x"));
    } else {
      tdSpeedup.textContent = "—";
    }
    tr.appendChild(tdSpeedup);
  }

  // 5. Acceptance Length column
  var tdAcc = el("td", "col-metric");
  tdAcc.textContent = m.acceptanceLength !== null ? m.acceptanceLength.toFixed(2) : "—";
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

function detailRow(m, opts) {
  var tr = el("tr", "detail-row");
  var td = el("td");
  td.colSpan = opts.hasThroughput ? 8 : 6;
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

// ── Public Methods ────────────────────────────────────────────

Render.fmtDate = fmtDate;

Render.stats = function (filtered, hasThroughput) {
  var ok = filtered.filter(function (m) { return m.status === "ok"; });

  // Models evaluated
  var statModelsEl = document.getElementById("stat-models");
  if (statModelsEl) statModelsEl.textContent = ok.length;

  // Best speedup or acceptance length
  var statBestEl = document.getElementById("stat-best");
  var statBestLabelEl = document.getElementById("stat-best-label");

  if (hasThroughput) {
    var best = null;
    var bestModel = null;
    ok.forEach(function (m) {
      var s = m.speedup;
      if (s !== null && (best === null || s > best)) { best = s; bestModel = m; }
    });
    if (statBestEl) statBestEl.textContent = best !== null ? best.toFixed(1) + "x" : "—";
    if (statBestLabelEl) statBestLabelEl.textContent = bestModel ? bestModel.shortName : "Best Speedup";
  } else {
    var bestAcc = null;
    var bestAccModel = null;
    ok.forEach(function (m) {
      var v = m.acceptanceLength;
      if (v !== null && (bestAcc === null || v > bestAcc)) { bestAcc = v; bestAccModel = m; }
    });
    if (statBestEl) statBestEl.textContent = bestAcc !== null ? bestAcc.toFixed(2) : "—";
    if (statBestLabelEl) statBestLabelEl.textContent = bestAccModel ? bestAccModel.shortName : "Best Accept. Len";
  }

  // Algorithms compared
  var algos = {};
  ok.forEach(function (m) { if (m.algorithm) algos[m.algorithm] = true; });
  var statAlgosEl = document.getElementById("stat-algos");
  if (statAlgosEl) statAlgosEl.textContent = Object.keys(algos).length;
};

Render.table = function (filtered, opts) {
  Charts.disposeByPrefix("detail-");

  var tbody = document.getElementById("models-tbody");
  if (!tbody) return;
  tbody.textContent = "";

  var thThroughput = document.querySelector('#models-table th[data-key="throughput_tps"]');
  var thSpeedup = document.querySelector('#models-table th[data-key="speedup"]');
  if (thThroughput) thThroughput.hidden = !opts.hasThroughput;
  if (thSpeedup) thSpeedup.hidden = !opts.hasThroughput;

  var rows = filtered;
  var placeholder = document.getElementById("placeholder");
  var table = document.getElementById("models-table");

  if (rows.length === 0) {
    if (table) table.hidden = true;
    if (placeholder) {
      placeholder.hidden = false;
      placeholder.textContent = opts.rawCount === 0
        ? "No evaluation results yet. Check back after the next eval run."
        : "No models match the current filters.";
    }
    return;
  }
  if (table) table.hidden = false;
  if (placeholder) placeholder.hidden = true;

  for (var i = 0; i < rows.length; i++) {
    var m = rows[i];
    tbody.appendChild(modelRow(m, opts));
    if (opts.expandedModel === m.model) {
      tbody.appendChild(detailRow(m, opts));
    }
  }
  renderSortIndicators(opts.sortKey, opts.sortDir);
};

Render.chart = function (filtered, opts) {
  var ok = filtered.filter(function (m) { return m.status === "ok"; });
  var descEl = document.getElementById("chart-desc");
  if (ok.length === 0) {
    var dom = document.getElementById("chart-algo-compare");
    if (dom) dom.innerHTML = '<div class="placeholder">No data matches the current filters.</div>';
    if (descEl) descEl.textContent = "";
    return;
  }
  if (descEl) {
    descEl.textContent = opts.hasThroughput
      ? "Best throughput (tok/s) per algorithm on each target model"
      : "Best acceptance length per algorithm on each target model";
  }
  Charts.algoCompare("chart-algo-compare", ok, opts.algoColors, opts.algoOrder, opts.hasThroughput);
};
