"use strict";

/* ============================================================
   Speculators Dashboard — data.js
   Data loading, processing, filtering, and sorting.
   ============================================================ */

var Data = {};

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

function safeNum(val) {
  if (val === null || val === undefined) return null;
  var n = Number(val);
  return isNaN(n) || n === 0 ? null : n;
}

function compareNumeric(av, bv, sign) {
  var aMiss = av === null || av === undefined || (typeof av === "number" && isNaN(av));
  var bMiss = bv === null || bv === undefined || (typeof bv === "number" && isNaN(bv));
  if (aMiss && bMiss) return 0;
  if (aMiss) return 1;
  if (bMiss) return -1;
  return (av - bv) * sign;
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

Data.shortName = shortName;
Data.targetFamily = targetFamily;

Data.load = function (resultsUrl, sampleUrl) {
  return fetchJson(resultsUrl).then(
    function (data) {
      if (data && Array.isArray(data.models) && data.models.length > 0) {
        return { data: data, isSample: false };
      }
      throw new Error("empty");
    },
    function () { throw new Error("fetch failed"); }
  ).catch(function () {
    return fetchJson(sampleUrl).then(
      function (data) { return { data: data, isSample: true }; },
      function () { return { data: null, isSample: false }; }
    );
  });
};

Data.process = function (models) {
  var targets = {};
  var algos = {};
  var anyThroughput = false;

  models.forEach(function (m) {
    if (m.target) targets[m.target] = true;
    if (m.algorithm) algos[m.algorithm] = true;

    m._shortName = shortName(m.model);
    m._targetFamily = targetFamily(m.target);
    m._acceptanceLength = m.metrics && typeof m.metrics.acceptance_length === "number"
      ? m.metrics.acceptance_length : null;
    m._throughput = safeNum(m.metrics && m.metrics.throughput_tps);
    m._speedup = safeNum(m.metrics && m.metrics.speedup);
    m._ttft = safeNum(m.metrics && m.metrics.ttft_ms);
    m._itl = safeNum(m.metrics && m.metrics.itl_ms);

    if (m._throughput !== null) anyThroughput = true;
  });

  return {
    uniqueTargets: Object.keys(targets).sort(),
    uniqueAlgorithms: Object.keys(algos).sort(),
    hasThroughput: anyThroughput
  };
};

/** Build target tab data: { family, fullTarget, count }[] */
Data.targetTabs = function (models) {
  var counts = {};
  var familyToFull = {};
  models.forEach(function (m) {
    var fam = m._targetFamily;
    if (!fam) return;
    counts[fam] = (counts[fam] || 0) + 1;
    if (!familyToFull[fam]) familyToFull[fam] = m.target;
  });
  var tabs = Object.keys(counts).sort().map(function (fam) {
    return { family: fam, fullTarget: familyToFull[fam], count: counts[fam] };
  });
  return tabs;
};

Data.filter = function (models, filters) {
  var f = filters;
  return models.filter(function (m) {
    if (f.target !== "all" && m._targetFamily !== f.target) return false;
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
};

Data.sort = function (models, sortKey, sortDir) {
  var key = sortKey;
  var dir = sortDir;

  models.sort(function (a, b) {
    // Failed models always at bottom
    var af = a.status === "failed" ? 1 : 0;
    var bf = b.status === "failed" ? 1 : 0;
    if (af !== bf) return af - bf;

    var sign = dir === "asc" ? 1 : -1;
    var av, bv, cmp;

    if (key === "model") {
      av = a.model || "";
      bv = b.model || "";
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
    } else if (key === "ttft_ms") {
      av = a._ttft;
      bv = b._ttft;
      cmp = compareNumeric(av, bv, sign);
    } else if (key === "itl_ms") {
      av = a._itl;
      bv = b._itl;
      cmp = compareNumeric(av, bv, sign);
    } else if (key === "evaluated_at") {
      av = Date.parse(a.evaluated_at || "") || null;
      bv = Date.parse(b.evaluated_at || "") || null;
      cmp = compareNumeric(av, bv, sign);
    } else {
      cmp = 0;
    }

    if (cmp === 0) cmp = String(a.model || "").localeCompare(String(b.model || ""));
    return cmp;
  });

  return models;
};
