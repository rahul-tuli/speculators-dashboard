"use strict";

// Speculators Dashboard — vanilla JS, no dependencies.

const RESULTS_URL = "../results.json";
const SAMPLE_URL = "./sample-results.json";

const state = {
  models: [],
  sortKey: "acceptance_length",
  sortDir: "desc",
  filter: "",
  expandedModel: null,
};

const ALGO_CLASSES = { eagle3: "badge-eagle3", dflash: "badge-dflash", peagle: "badge-peagle", mtp: "badge-mtp" };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function cacheBust(url) {
  return url + "?t=" + Date.now();
}

async function fetchJson(url) {
  const res = await fetch(cacheBust(url), { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

// Try ../results.json first; fall back to bundled sample data.
async function loadData() {
  try {
    const data = await fetchJson(RESULTS_URL);
    return { data, isSample: false };
  } catch (err) {
    try {
      const data = await fetchJson(SAMPLE_URL);
      return { data, isSample: true };
    } catch (err2) {
      return { data: null, isSample: false };
    }
  }
}

function relativeDate(iso) {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  let s;
  if (mins < 60) s = mins <= 1 ? "1m" : mins + "m";
  else if (mins < 60 * 24) s = Math.round(mins / 60) + "h";
  else if (mins < 60 * 24 * 30) s = Math.round(mins / (60 * 24)) + "d";
  else if (mins < 60 * 24 * 365) s = Math.round(mins / (60 * 24 * 30)) + "mo";
  else s = Math.round(mins / (60 * 24 * 365)) + "y";
  return diff >= 0 ? s + " ago" : "in " + s;
}

function fmtDate(iso) {
  const t = Date.parse(iso || "");
  if (Number.isNaN(t)) return iso || "—";
  return new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function fmtInt(n) {
  return typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() : "—";
}

function algoClass(algo) {
  return ALGO_CLASSES[(algo || "").toLowerCase()] || "badge-other";
}

function hfLink(modelId) {
  if (!modelId || typeof modelId !== "string") return null;
  const a = el("a", "mono", modelId);
  a.href = "https://huggingface.co/" + encodeURI(modelId);
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.addEventListener("click", (e) => e.stopPropagation());
  return a;
}

// Tiny CSS-bar sparkline for acceptance_at_pos.
function sparkline(values) {
  const wrap = el("span", "spark");
  if (!Array.isArray(values) || values.length === 0) {
    wrap.appendChild(el("span", null, "—"));
    return wrap;
  }
  for (const v of values) {
    const bar = el("span", "spark-bar");
    const h = Math.max(1, Math.round((Number(v) || 0) * 18));
    bar.style.height = h + "px";
    bar.title = (Number(v) || 0).toFixed(2);
    wrap.appendChild(bar);
  }
  return wrap;
}

function metricValue(m) {
  const acc = m && m.metrics && typeof m.metrics.acceptance_length === "number"
    ? m.metrics.acceptance_length
    : null;
  return acc;
}

function compare(a, b, key, dir) {
  const sign = dir === "asc" ? 1 : -1;
  const av = a[key], bv = b[key];
  // Missing values always sort last.
  const aMiss = av === null || av === undefined || (typeof av === "number" && Number.isNaN(av));
  const bMiss = bv === null || bv === undefined || (typeof bv === "number" && Number.isNaN(bv));
  if (aMiss && bMiss) return 0;
  if (aMiss) return 1;
  if (bMiss) return -1;
  if (typeof av === "number" && typeof bv === "number") return (av - bv) * sign;
  return String(av).localeCompare(String(bv)) * sign;
}

function sortedFiltered() {
  const f = state.filter.toLowerCase();
  let rows = state.models.filter((m) => {
    if (!f) return true;
    return [m.model, m.target, m.algorithm].some((v) => v && String(v).toLowerCase().includes(f));
  });
  // Flatten sort key: acceptance_length lives under metrics.
  rows = rows.map((m) => ({ m, acc: metricValue(m) }));
  rows.sort((x, y) => {
    // Failed entries always last, regardless of sort.
    const xf = x.m.status === "failed" ? 1 : 0;
    const yf = y.m.status === "failed" ? 1 : 0;
    if (xf !== yf) return xf - yf;
    const key = state.sortKey;
    let cmp;
    if (key === "acceptance_length") cmp = compare({ v: x.acc }, { v: y.acc }, "v", state.sortDir);
    else if (key === "num_speculative_tokens") cmp = compare({ v: x.m.num_speculative_tokens }, { v: y.m.num_speculative_tokens }, "v", state.sortDir);
    else if (key === "evaluated_at") cmp = compare({ v: Date.parse(x.m.evaluated_at || "") || null }, { v: Date.parse(y.m.evaluated_at || "") || null }, "v", state.sortDir);
    else if (key === "acceptance_at_pos") cmp = 0;
    else cmp = compare({ v: x.m[key] }, { v: y.m[key] }, "v", state.sortDir);
    if (cmp === 0) cmp = String(x.m.model || "").localeCompare(String(y.m.model || ""));
    return cmp;
  });
  return rows.map((r) => r.m);
}

function renderStats() {
  const models = state.models;
  const ok = models.filter((m) => m.status === "ok");
  const failed = models.filter((m) => m.status === "failed");
  const accs = ok.map(metricValue).filter((v) => v !== null);
  const mean = accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : null;
  document.getElementById("stat-total").textContent = models.length;
  document.getElementById("stat-ok").textContent = ok.length;
  document.getElementById("stat-failed").textContent = failed.length;
  document.getElementById("stat-mean").textContent = mean !== null ? mean.toFixed(2) : "—";
}

function renderSortIndicators() {
  document.querySelectorAll("#models-table th").forEach((th) => {
    const old = th.querySelector(".sort-arrow");
    if (old) old.remove();
    if (th.dataset.key === state.sortKey) {
      th.appendChild(el("span", "sort-arrow", state.sortDir === "asc" ? "▲" : "▼"));
    }
  });
}

function renderTable() {
  const tbody = document.getElementById("models-tbody");
  tbody.textContent = "";
  const rows = sortedFiltered();
  const placeholder = document.getElementById("placeholder");
  const table = document.getElementById("models-table");

  if (rows.length === 0) {
    table.hidden = true;
    placeholder.hidden = false;
    placeholder.textContent = state.models.length === 0
      ? "No evaluation results yet. Check back after the next eval run."
      : "No models match the current filter.";
    return;
  }
  table.hidden = false;
  placeholder.hidden = true;

  for (const m of rows) {
    tbody.appendChild(modelRow(m));
    if (state.expandedModel === m.model) {
      tbody.appendChild(detailRow(m));
    }
  }
  renderSortIndicators();
}

function modelRow(m) {
  const tr = el("tr", "model-row" + (m.status === "failed" ? " failed-row" : "") + (state.expandedModel === m.model ? " expanded" : ""));
  tr.addEventListener("click", () => {
    state.expandedModel = state.expandedModel === m.model ? null : m.model;
    renderTable();
  });

  const tdModel = el("td");
  tdModel.appendChild(hfLink(m.model) || el("span", "mono", m.model || "—"));
  tr.appendChild(tdModel);

  const tdTarget = el("td");
  tdTarget.appendChild(hfLink(m.target) || el("span", "mono", m.target || "—"));
  tr.appendChild(tdTarget);

  const tdAlgo = el("td");
  tdAlgo.appendChild(el("span", "badge badge-algo " + algoClass(m.algorithm), m.algorithm || "other"));
  tr.appendChild(tdAlgo);

  tr.appendChild(el("td", null, m.num_speculative_tokens != null ? m.num_speculative_tokens : "—"));

  const acc = metricValue(m);
  tr.appendChild(el("td", "accelen", acc !== null ? acc.toFixed(2) : "—"));

  const tdSpark = el("td");
  tdSpark.appendChild(sparkline(m.metrics && m.metrics.acceptance_at_pos));
  tr.appendChild(tdSpark);

  tr.appendChild(el("td", null, relativeDate(m.evaluated_at)));
  tr.appendChild(el("td", null, m.gpus || "—"));

  const tdStatus = el("td");
  const ok = m.status === "ok";
  tdStatus.appendChild(el("span", "badge " + (ok ? "badge-ok" : "badge-failed"), m.status || "unknown"));
  tr.appendChild(tdStatus);

  return tr;
}

function detailRow(m) {
  const tr = el("tr", "detail-row");
  const td = el("td");
  td.colSpan = 9;
  const panel = el("div", "detail-panel");

  if (m.error) {
    panel.appendChild(el("h3", null, "Error"));
    panel.appendChild(el("div", "error-text", m.error));
  }

  const subsets = m.metrics && m.metrics.subsets;
  if (subsets && Object.keys(subsets).length > 0) {
    panel.appendChild(el("h3", null, "Per-subset results"));
    const tbl = el("table");
    const head = el("tr");
    for (const h of ["Subset", "Accept. Len", "Num Drafts", "Acceptance@pos"]) head.appendChild(el("th", null, h));
    const thead = el("thead");
    thead.appendChild(head);
    tbl.appendChild(thead);
    const tb = el("tbody");
    for (const [name, s] of Object.entries(subsets)) {
      const r = el("tr");
      r.appendChild(el("td", null, name));
      r.appendChild(el("td", null, typeof s.acceptance_length === "number" ? s.acceptance_length.toFixed(2) : "—"));
      r.appendChild(el("td", null, fmtInt(s.num_drafts)));
      const tdPos = el("td", "mono");
      tdPos.textContent = Array.isArray(s.acceptance_at_pos)
        ? s.acceptance_at_pos.map((v) => (Number(v) || 0).toFixed(2)).join(" · ")
        : "—";
      r.appendChild(tdPos);
      tb.appendChild(r);
    }
    tbl.appendChild(tb);
    panel.appendChild(tbl);
  }

  const pos = m.metrics && m.metrics.acceptance_at_pos;
  if (Array.isArray(pos) && pos.length > 0) {
    panel.appendChild(el("h3", null, "Acceptance rate by draft position"));
    const bars = el("div", "pos-bars");
    pos.forEach((v, i) => {
      const g = el("div", "pos-bar-group");
      g.appendChild(el("span", "pos-bar-value", (Number(v) || 0).toFixed(2)));
      const bar = el("div", "pos-bar");
      bar.style.height = Math.max(1, Math.round((Number(v) || 0) * 70)) + "px";
      g.appendChild(bar);
      g.appendChild(el("span", "pos-bar-label", "pos " + (i + 1)));
      bars.appendChild(g);
    });
    panel.appendChild(bars);
  }

  td.appendChild(panel);
  tr.appendChild(td);
  return tr;
}

function setupControls() {
  document.getElementById("filter").addEventListener("input", (e) => {
    state.filter = e.target.value.trim();
    renderTable();
  });
  document.querySelectorAll("#models-table th").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      if (!key) return;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        state.sortDir = key === "model" || key === "target" || key === "algorithm" ? "asc" : "desc";
      }
      renderTable();
    });
  });
}

async function init() {
  setupControls();
  const { data, isSample } = await loadData();
  if (!data || !Array.isArray(data.models)) {
    document.getElementById("models-table").hidden = true;
    const ph = document.getElementById("placeholder");
    ph.hidden = false;
    ph.textContent = "Could not load evaluation results. The results file may be missing or unreadable — check back later.";
    return;
  }
  if (isSample) document.getElementById("sample-banner").hidden = false;
  state.models = data.models;
  document.getElementById("last-updated").textContent = "Last updated: " + fmtDate(data.updated_at);
  renderStats();
  renderTable();
}

document.addEventListener("DOMContentLoaded", init);
