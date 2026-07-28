"use strict";

/* ============================================================
   Speculators Dashboard — render.js
   DOM construction and rendering helpers (Variant A design).
   ============================================================ */

var Render = {};

// ── DOM Helper ───────────────────────────────────────────────

function h(tag, attrs, children) {
  var el = document.createElement(tag);
  if (attrs) {
    Object.keys(attrs).forEach(function (k) {
      if (k === "className") el.className = attrs[k];
      else if (k === "innerHTML") el.innerHTML = attrs[k];
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (k === "style" && typeof attrs[k] === "object") Object.assign(el.style, attrs[k]);
      else el.setAttribute(k, attrs[k]);
    });
  }
  if (children != null) {
    if (typeof children === "string" || typeof children === "number") el.textContent = String(children);
    else if (Array.isArray(children)) children.forEach(function (c) { if (c) el.appendChild(c); });
    else if (children instanceof HTMLElement) el.appendChild(children);
  }
  return el;
}

// ── Formatting Helpers ───────────────────────────────────────

function fmtDate(iso) {
  var t = Date.parse(iso || "");
  if (isNaN(t)) return iso || "—";
  return new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function spdClass(val) {
  if (val === null || val === undefined) return "";
  if (val >= 2) return "spd-excellent";
  if (val >= 1.5) return "spd-good";
  if (val >= 1.2) return "spd-moderate";
  return "spd-low";
}

function algoClass(algo) {
  var map = { eagle3: "algo-eagle3", dflash: "algo-dflash", peagle: "algo-peagle", mtp: "algo-mtp" };
  return map[(algo || "").toLowerCase()] || "algo-other";
}

function sparkline(values) {
  var wrap = h("span", { className: "spark" });
  if (!Array.isArray(values) || values.length === 0) {
    wrap.appendChild(h("span", null, "—"));
    return wrap;
  }
  values.forEach(function (v) {
    var bar = h("span", {
      className: "spark-bar",
      style: { height: Math.max(2, Math.round((Number(v) || 0) * 18)) + "px" },
      title: (Number(v) || 0).toFixed(2)
    });
    wrap.appendChild(bar);
  });
  return wrap;
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(function () {
    var orig = btn.textContent;
    btn.textContent = "Copied!";
    btn.style.color = "var(--green)";
    setTimeout(function () { btn.textContent = orig; btn.style.color = ""; }, 1200);
  });
}

function formatHardware(gpus) {
  if (!gpus) return "—";
  // Convert "1xa100" to "1x A100", "4xh100" to "4x H100"
  var match = gpus.match(/^(\d+)x(.+)$/i);
  if (match) return match[1] + "x " + match[2].toUpperCase();
  return gpus;
}

// ── Deploy Panel Builder ─────────────────────────────────────

function renderDeployPanel(m) {
  var panel = h("div", { className: "deploy-panel" });
  panel.appendChild(h("div", { className: "deploy-panel-title" }, "Deploy with vLLM"));

  var cmd = m.deploy && m.deploy.command;
  if (!cmd) {
    panel.appendChild(h("div", { className: "deploy-pending" }, "Command pending evaluation"));
    return panel;
  }

  var codeWrap = h("div", { className: "code-block" });

  // Syntax highlight the command
  var parts = cmd.split(" ");
  var htmlParts = [];
  var i = 0;
  while (i < parts.length) {
    var part = parts[i];
    if (i <= 1) {
      // "vllm serve" or first two words
      htmlParts.push('<span class="cmd">' + escapeHtml(part) + '</span>');
    } else if (part.charAt(0) === "-") {
      htmlParts.push('<span class="flag">' + escapeHtml(part) + '</span>');
    } else {
      htmlParts.push('<span class="val">' + escapeHtml(part) + '</span>');
    }
    i++;
  }
  codeWrap.innerHTML = htmlParts.join(" ");

  var copyBtn = h("button", {
    className: "copy-btn",
    onClick: function (e) {
      e.stopPropagation();
      copyToClipboard(cmd, copyBtn);
    }
  }, "Copy");
  codeWrap.appendChild(copyBtn);
  panel.appendChild(codeWrap);

  var meta = h("div", { className: "deploy-meta" });
  meta.appendChild(h("span", null, formatHardware(m.gpus) + " evaluated"));
  meta.appendChild(h("span", null, "vLLM auto-detects algorithm & target"));
  panel.appendChild(meta);

  return panel;
}

function escapeHtml(str) {
  var div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── Subset Table Builder ─────────────────────────────────────

function renderSubsetTable(m) {
  var subsets = m.metrics && m.metrics.subsets;
  if (!subsets || Object.keys(subsets).length === 0) {
    return h("div", { className: "deploy-pending" }, "No per-subset data available");
  }

  var subs = Object.keys(subsets).map(function (k) {
    return Object.assign({ name: k }, subsets[k]);
  });

  // Determine best values for green highlighting
  var vals = { throughput: [], acceptance_length: [], ttft_ms: [], itl_ms: [] };
  subs.forEach(function (s) {
    if (s.throughput_tps != null) vals.throughput.push(s.throughput_tps);
    if (s.acceptance_length != null) vals.acceptance_length.push(s.acceptance_length);
    if (s.ttft_ms != null) vals.ttft_ms.push(s.ttft_ms);
    if (s.itl_ms != null) vals.itl_ms.push(s.itl_ms);
  });
  var bestTp = vals.throughput.length > 0 ? Math.max.apply(null, vals.throughput) : null;
  var bestAl = vals.acceptance_length.length > 0 ? Math.max.apply(null, vals.acceptance_length) : null;
  var bestTtft = vals.ttft_ms.length > 0 ? Math.min.apply(null, vals.ttft_ms) : null;
  var bestItl = vals.itl_ms.length > 0 ? Math.min.apply(null, vals.itl_ms) : null;

  var table = h("table", { className: "subset-tbl" });
  var thead = h("thead");
  var hr = h("tr");
  ["Subset", "Throughput", "Accept. Len", "TTFT", "ITL"].forEach(function (t, i) {
    hr.appendChild(h("th", { className: i > 0 ? "num" : "" }, t));
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  var tbody = h("tbody");
  subs.forEach(function (s) {
    var tr = h("tr");
    tr.appendChild(h("td", { className: "subset-name" }, s.name));

    // Throughput
    var tdTp = h("td", { className: "num" + (s.throughput_tps != null && s.throughput_tps === bestTp ? " best" : "") });
    if (s.throughput_tps != null) {
      tdTp.innerHTML = Math.round(s.throughput_tps).toLocaleString() + '<span class="unit">tok/s</span>';
    } else {
      tdTp.textContent = "—";
    }
    tr.appendChild(tdTp);

    // Acceptance length
    var alVal = s.acceptance_length;
    tr.appendChild(h("td", {
      className: "num" + (alVal != null && alVal === bestAl ? " best" : "")
    }, alVal != null ? alVal.toFixed(2) : "—"));

    // TTFT
    var tdTtft = h("td", { className: "num" + (s.ttft_ms != null && s.ttft_ms === bestTtft ? " best" : "") });
    if (s.ttft_ms != null) {
      tdTtft.innerHTML = s.ttft_ms.toFixed(1) + '<span class="unit">ms</span>';
    } else {
      tdTtft.textContent = "—";
    }
    tr.appendChild(tdTtft);

    // ITL
    var tdItl = h("td", { className: "num" + (s.itl_ms != null && s.itl_ms === bestItl ? " best" : "") });
    if (s.itl_ms != null) {
      tdItl.innerHTML = s.itl_ms.toFixed(1) + '<span class="unit">ms</span>';
    } else {
      tdItl.textContent = "—";
    }
    tr.appendChild(tdItl);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

// ── Public Methods ───────────────────────────────────────────

Render.fmtDate = fmtDate;

Render.stats = function (filtered, hasThroughput) {
  var ok = filtered.filter(function (m) { return m.status === "ok"; });

  var statModelsEl = document.getElementById("stat-models");
  if (statModelsEl) statModelsEl.textContent = ok.length;

  var statBestEl = document.getElementById("stat-best");
  var statBestLabelEl = document.getElementById("stat-best-label");

  if (hasThroughput) {
    var best = null;
    var bestModel = null;
    ok.forEach(function (m) {
      var s = m._speedup;
      if (s !== null && (best === null || s > best)) { best = s; bestModel = m; }
    });
    if (statBestEl) statBestEl.textContent = best !== null ? best.toFixed(1) + "x" : "—";
    if (statBestLabelEl) statBestLabelEl.textContent = bestModel ? bestModel._shortName : "Best Speedup";
  } else {
    var bestAcc = null;
    var bestAccModel = null;
    ok.forEach(function (m) {
      var v = m._acceptanceLength;
      if (v !== null && (bestAcc === null || v > bestAcc)) { bestAcc = v; bestAccModel = m; }
    });
    if (statBestEl) statBestEl.textContent = bestAcc !== null ? bestAcc.toFixed(2) : "—";
    if (statBestLabelEl) statBestLabelEl.textContent = bestAccModel ? bestAccModel._shortName : "Best Accept. Len";
  }

  var algos = {};
  ok.forEach(function (m) { if (m.algorithm) algos[m.algorithm] = true; });
  var statAlgosEl = document.getElementById("stat-algos");
  if (statAlgosEl) statAlgosEl.textContent = Object.keys(algos).length;
};

Render.targetTabs = function (tabs, activeTarget, totalCount, onSelect) {
  var container = document.getElementById("target-tabs");
  if (!container) return;
  container.textContent = "";

  // "All Targets" tab
  var allTab = h("button", {
    className: "target-tab" + (activeTarget === "all" ? " active" : ""),
    "data-target": "all",
    onClick: function () { onSelect("all"); }
  });
  allTab.innerHTML = 'All Targets <span class="tab-count">' + totalCount + '</span>';
  container.appendChild(allTab);

  tabs.forEach(function (t) {
    var tab = h("button", {
      className: "target-tab" + (activeTarget === t.family ? " active" : ""),
      "data-target": t.family,
      onClick: function () { onSelect(t.family); }
    });
    tab.innerHTML = escapeHtml(t.family) + ' <span class="tab-count">' + t.count + '</span>';
    container.appendChild(tab);
  });
};

Render.table = function (filtered, opts) {
  Charts.disposeByPrefix("detail-");

  var tbody = document.getElementById("models-tbody");
  if (!tbody) return;
  tbody.textContent = "";

  var placeholder = document.getElementById("placeholder");
  var table = document.getElementById("models-table");

  if (filtered.length === 0) {
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

  // Render sort arrows on headers
  var ths = document.querySelectorAll("#models-table th");
  ths.forEach(function (th) {
    var old = th.querySelector(".sort-arrow");
    if (old) old.remove();
    if (th.dataset.key === opts.sortKey) {
      th.appendChild(h("span", { className: "sort-arrow" }, opts.sortDir === "asc" ? "▲" : "▼"));
    }
  });

  for (var i = 0; i < filtered.length; i++) {
    var m = filtered[i];
    var isExpanded = opts.expandedModel === m.model;
    var isDeployOpen = opts.deployOpen === m.model && !isExpanded;

    // ── Model Row ──
    var classes = "model-row";
    if (m.status === "failed") classes += " failed-row";
    if (isExpanded) classes += " expanded";

    var tr = h("tr", { className: classes });
    (function (model) {
      tr.addEventListener("click", function (e) {
        if (e.target.closest(".deploy-btn")) return;
        opts.onToggleExpand(model.model);
      });
    })(m);

    // 1. Drafter column
    var tdDrafter = h("td");
    var nameWrap = h("div", { className: "va-model-name" });
    var link = h("a", {
      href: "https://huggingface.co/" + encodeURI(m.model),
      target: "_blank",
      rel: "noopener noreferrer",
      onClick: function (e) { e.stopPropagation(); }
    }, m._shortName || "—");
    nameWrap.appendChild(link);
    nameWrap.appendChild(document.createTextNode(" "));
    nameWrap.appendChild(h("span", { className: "algo-badge " + algoClass(m.algorithm) }, m.algorithm || "other"));
    // Show target family when "All Targets" tab is active
    if (opts.activeTarget === "all") {
      nameWrap.appendChild(h("small", null, m._targetFamily || ""));
    }
    tdDrafter.appendChild(nameWrap);
    tr.appendChild(tdDrafter);

    // 2. Throughput
    var tdThroughput = h("td", { className: "right" });
    if (m._throughput !== null) {
      tdThroughput.appendChild(h("span", {
        style: { fontFamily: "var(--mono)", fontWeight: "700", fontSize: "15px" }
      }, Math.round(m._throughput).toLocaleString()));
      tdThroughput.appendChild(h("span", {
        style: { fontSize: "11px", color: "var(--text-3)", marginLeft: "4px" }
      }, "tok/s"));
    } else {
      tdThroughput.textContent = "—";
    }
    tr.appendChild(tdThroughput);

    // 3. Speedup badge
    var tdSpeedup = h("td", { className: "right" });
    if (m._speedup !== null) {
      tdSpeedup.appendChild(h("span", {
        className: "spd-badge " + spdClass(m._speedup)
      }, m._speedup.toFixed(1) + "x"));
    } else {
      tdSpeedup.textContent = "—";
    }
    tr.appendChild(tdSpeedup);

    // 4. Acceptance length
    var tdAcc = h("td", {
      className: "right",
      style: { fontFamily: "var(--mono)", fontWeight: "600", fontSize: "15px" }
    }, m._acceptanceLength !== null ? m._acceptanceLength.toFixed(2) : "—");
    tr.appendChild(tdAcc);

    // 5. TTFT
    var tdTtft = h("td", { className: "right" });
    if (m._ttft !== null) {
      tdTtft.appendChild(h("span", {
        style: { fontFamily: "var(--mono)", fontWeight: "600", fontSize: "15px" }
      }, m._ttft.toFixed(1)));
      tdTtft.appendChild(h("span", {
        style: { fontSize: "11px", color: "var(--text-3)", marginLeft: "3px" }
      }, "ms"));
    } else {
      tdTtft.textContent = "—";
    }
    tr.appendChild(tdTtft);

    // 6. ITL
    var tdItl = h("td", { className: "right" });
    if (m._itl !== null) {
      tdItl.appendChild(h("span", {
        style: { fontFamily: "var(--mono)", fontWeight: "600", fontSize: "15px" }
      }, m._itl.toFixed(1)));
      tdItl.appendChild(h("span", {
        style: { fontSize: "11px", color: "var(--text-3)", marginLeft: "3px" }
      }, "ms"));
    } else {
      tdItl.textContent = "—";
    }
    tr.appendChild(tdItl);

    // 7. Accept@pos sparkline
    var tdSpark = h("td");
    tdSpark.appendChild(sparkline(m.metrics && m.metrics.acceptance_at_pos));
    tr.appendChild(tdSpark);

    // 8. Hardware chip
    var tdHw = h("td");
    tdHw.appendChild(h("span", { className: "hw-chip" }, formatHardware(m.gpus)));
    tr.appendChild(tdHw);

    // 9. Deploy button
    var tdDeploy = h("td");
    var dBtn = h("button", { className: "deploy-btn" });
    dBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 17l6-6-6-6"/><path d="M12 19h8"/></svg> Deploy';
    (function (model) {
      dBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        opts.onToggleDeploy(model.model);
      });
    })(m);
    tdDeploy.appendChild(dBtn);
    tr.appendChild(tdDeploy);

    tbody.appendChild(tr);

    // ── Detail Row (expanded) ──
    if (isExpanded) {
      var detailTr = h("tr", { className: "va-detail" });
      var detailTd = h("td", { colSpan: 9 });
      var inner = h("div", { className: "va-detail-inner" });

      // Detail tabs
      var tabs = h("div", { className: "detail-tabs" });
      var metricsTab = h("button", { className: "detail-tab active" }, "Metrics");
      var deployTab = h("button", { className: "detail-tab" }, "Deploy");
      tabs.appendChild(metricsTab);
      tabs.appendChild(deployTab);
      inner.appendChild(tabs);

      // Metrics pane
      var metricsPane = h("div", { style: { padding: "16px 0" } });
      // Error text if failed
      if (m.error) {
        metricsPane.appendChild(h("div", {
          style: { color: "var(--red)", marginBottom: "12px", fontWeight: "600" }
        }, "Error: " + m.error));
      }
      metricsPane.appendChild(renderSubsetTable(m));
      inner.appendChild(metricsPane);

      // Deploy pane
      var deployPane = h("div", { style: { display: "none", padding: "16px 0" } });
      deployPane.appendChild(renderDeployPanel(m));
      inner.appendChild(deployPane);

      metricsTab.addEventListener("click", function (e) {
        e.stopPropagation();
        metricsTab.classList.add("active");
        deployTab.classList.remove("active");
        metricsPane.style.display = "";
        deployPane.style.display = "none";
      });
      deployTab.addEventListener("click", function (e) {
        e.stopPropagation();
        deployTab.classList.add("active");
        metricsTab.classList.remove("active");
        deployPane.style.display = "";
        metricsPane.style.display = "none";
      });

      detailTd.appendChild(inner);
      detailTr.appendChild(detailTd);
      tbody.appendChild(detailTr);
    }

    // ── Standalone deploy panel (from button, row not expanded) ──
    if (isDeployOpen) {
      var dpTr = h("tr", { className: "deploy-row" });
      var dpTd = h("td", { colSpan: 9 });
      dpTd.appendChild(renderDeployPanel(m));
      dpTr.appendChild(dpTd);
      tbody.appendChild(dpTr);
    }
  }
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
