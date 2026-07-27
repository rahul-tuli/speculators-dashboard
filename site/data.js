"use strict";

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
Data.metricValue = metricValue;
Data.throughputValue = throughputValue;
Data.speedupValue = speedupValue;

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
    m._acceptanceLength = metricValue(m);
    m._throughput = throughputValue(m);
    m._speedup = speedupValue(m);

    if (m._throughput !== null) anyThroughput = true;
  });

  return {
    uniqueTargets: Object.keys(targets).sort(),
    uniqueAlgorithms: Object.keys(algos).sort(),
    hasThroughput: anyThroughput
  };
};

Data.filter = function (models, filters) {
  var f = filters;
  return models.filter(function (m) {
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
};

Data.sort = function (models, sortKey, sortDir) {
  var key = sortKey;
  var dir = sortDir;

  models.sort(function (a, b) {
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

    if (cmp === 0) cmp = String(a.model || "").localeCompare(String(b.model || ""));
    return cmp;
  });

  return models;
};
