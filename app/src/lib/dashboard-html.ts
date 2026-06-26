const CHART_JS_V4_CDN =
  "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js";
const CHART_COMPAT_MARKER = "data-chart-compat";

const CHART_COMPAT_SHIM = `<script ${CHART_COMPAT_MARKER}="true">
(function () {
  if (typeof window === "undefined" || window.__chartCompatInstalled) {
    return;
  }

  window.__chartCompatInstalled = true;

  function normalizeAxis(axis) {
    if (!axis || typeof axis !== "object" || Array.isArray(axis)) {
      return axis;
    }

    if (axis.gridLines && !axis.grid) {
      axis.grid = axis.gridLines;
      delete axis.gridLines;
    }

    if (axis.scaleLabel && !axis.title) {
      axis.title = {
        display: Boolean(axis.scaleLabel.display),
        text: axis.scaleLabel.labelString || "",
      };
      delete axis.scaleLabel;
    }

    if (
      axis.ticks &&
      typeof axis.ticks === "object" &&
      axis.beginAtZero == null &&
      "beginAtZero" in axis.ticks
    ) {
      axis.beginAtZero = axis.ticks.beginAtZero;
      delete axis.ticks.beginAtZero;
    }

    return axis;
  }

  function normalizeLegacyAxes(scales, legacyKey, prefix) {
    var legacyAxes = scales[legacyKey];
    if (!Array.isArray(legacyAxes)) {
      return;
    }

    for (var i = 0; i < legacyAxes.length; i += 1) {
      var axis = normalizeAxis(legacyAxes[i]);
      var axisId =
        axis && typeof axis.id === "string"
          ? axis.id
          : i === 0
            ? prefix
            : prefix + i;

      if (!scales[axisId]) {
        scales[axisId] = axis;
      }
    }

    delete scales[legacyKey];
  }

  function normalizeConfig(config) {
    if (!config || typeof config !== "object") {
      return config;
    }

    if (config.type === "horizontalBar") {
      config.type = "bar";
      config.options = config.options || {};
      if (!config.options.indexAxis) {
        config.options.indexAxis = "y";
      }
    }

    var options = config.options;
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      return config;
    }

    if (options.legend || options.tooltips) {
      options.plugins = options.plugins || {};

      if (options.legend && !options.plugins.legend) {
        options.plugins.legend = options.legend;
      }

      if (options.tooltips && !options.plugins.tooltip) {
        options.plugins.tooltip = options.tooltips;
      }

      delete options.legend;
      delete options.tooltips;
    }

    if (
      typeof options.cutoutPercentage === "number" &&
      options.cutout == null
    ) {
      options.cutout = options.cutoutPercentage + "%";
      delete options.cutoutPercentage;
    }

    var scales = options.scales;
    if (scales && typeof scales === "object" && !Array.isArray(scales)) {
      normalizeLegacyAxes(scales, "xAxes", "x");
      normalizeLegacyAxes(scales, "yAxes", "y");
    }

    return config;
  }

  // Override the Chart constructor after it loads.
  // We use a polling approach because the <script src> that loads Chart.js
  // may execute asynchronously depending on browser behavior.
  var _origChart = null;
  var _patched = false;

  function patchChart() {
    if (_patched || typeof window.Chart !== "function") return;
    _origChart = window.Chart;
    _patched = true;

    // Detect major version
    var major = 4;
    try {
      var v = _origChart.version || (_origChart.Chart && _origChart.Chart.version);
      if (typeof v === "string") major = parseInt(v.split(".")[0], 10) || 4;
    } catch(e) {}

    if (major < 3) return; // v2 uses legacy format natively, no patching needed

    // Replace window.Chart with a wrapper function
    window.Chart = function GriChartWrapper(ctx, config) {
      config = normalizeConfig(config);
      return new _origChart(ctx, config);
    };

    // Copy all static properties and prototype
    try {
      Object.keys(_origChart).forEach(function(key) {
        try { window.Chart[key] = _origChart[key]; } catch(e) {}
      });
      window.Chart.prototype = _origChart.prototype;
      window.Chart.version = _origChart.version;
      window.Chart.register = _origChart.register;
      window.Chart.defaults = _origChart.defaults;
    } catch(e) {}
  }

  // Try immediately (Chart.js may already be loaded)
  patchChart();

  // Also watch for Chart being set later (async script load)
  if (!_patched) {
    var _checkCount = 0;
    var _interval = setInterval(function() {
      patchChart();
      _checkCount++;
      if (_patched || _checkCount > 100) clearInterval(_interval);
    }, 50);
  }
})();
</script>`;

function pinChartJsCdn(html: string): string {
  // Only pin UNVERSIONED Chart.js URLs (the ones that float to latest and break).
  // Dashboards that explicitly reference @2, @3 etc. are left as-is —
  // the compat shim handles config normalization at runtime regardless.
  return html
    .replace(
      /https:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js\/dist\/chart(?:\.min)?\.js/gi,
      CHART_JS_V4_CDN
    )
    .replace(
      /https:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js\/auto(?:\/auto(?:\.min)?\.js)?/gi,
      CHART_JS_V4_CDN
    )
    .replace(
      /https:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js(?!@)(?=["'])/gi,
      CHART_JS_V4_CDN
    );
}

/**
 * Static HTML rewriting for Chart.js v2/v3 → v4 migration.
 * These run server-side before serving the HTML, so they're 100% reliable
 * (no runtime Proxy or interception needed).
 */
function rewriteLegacyChartConfig(html: string): string {
  // 1. horizontalBar → bar + indexAxis: 'y'
  // Match: type: 'horizontalBar' or type: "horizontalBar"
  let result = html.replace(
    /type:\s*['"]horizontalBar['"]/g,
    (match) => {
      const quote = match.includes("'") ? "'" : '"';
      return `type: ${quote}bar${quote}, options: { indexAxis: ${quote}y${quote}`;
    }
  );

  // Fix: the above inserts options inside the config object but we need to handle
  // the case where options already exists. Simpler approach: just replace the type
  // and inject indexAxis into the existing options block if present.
  // Actually, the safest approach: just replace type and add a standalone indexAxis setter.
  // Reset and use a simpler approach:
  result = html;

  // Static rewrite: horizontalBar → bar + indexAxis:'y'.
  // Must be done server-side because Chart.js v4 rejects 'horizontalBar'
  // before any runtime wrapper can intercept.
  //
  // Strategy: find each 'horizontalBar' occurrence. For each one, replace
  // the type AND find the NEXT 'options:' or 'options :' after it to inject
  // indexAxis. If no options block follows, the runtime shim handles it.
  if (result.includes("horizontalBar")) {
    const parts: string[] = [];
    let lastIdx = 0;
    const typeRe = /type:\s*['"]horizontalBar['"]/g;
    let match: RegExpExecArray | null;

    while ((match = typeRe.exec(result)) !== null) {
      // Replace the type
      parts.push(result.slice(lastIdx, match.index));
      parts.push("type: 'bar'");
      lastIdx = match.index + match[0].length;

      // Find the next 'options:' or 'options :' after this type declaration
      // and inject indexAxis: 'y'
      const afterType = result.slice(lastIdx);
      const optionsMatch = afterType.match(/options\s*:\s*\{/);
      if (optionsMatch && optionsMatch.index !== undefined) {
        const optEnd = lastIdx + optionsMatch.index + optionsMatch[0].length;
        parts.push(result.slice(lastIdx, optEnd));
        parts.push(" indexAxis: 'y',");
        lastIdx = optEnd;
      }
    }
    parts.push(result.slice(lastIdx));
    result = parts.join('');
  }

  // Step 4: Inject safety CSS to prevent canvas infinite growth
  if (!result.includes('data-chart-safety')) {
    const safetyCSS = '<style data-chart-safety>canvas{max-height:500px!important}</style>';
    const headClose = result.indexOf('</head>');
    if (headClose !== -1) {
      result = result.slice(0, headClose) + safetyCSS + result.slice(headClose);
    }
  }

  return result;
}

export function prepareDashboardHtmlForRender(html: string): string {
  if (!html) {
    return html;
  }

  // Step 1: Pin floating CDN URLs to v4
  let result = pinChartJsCdn(html);

  // Step 2: Static rewrite of legacy Chart.js config in HTML
  result = rewriteLegacyChartConfig(result);

  // Step 3: Inject runtime compat shim (handles remaining edge cases)
  if (
    result.includes(CHART_COMPAT_MARKER) ||
    result.includes("__chartCompatInstalled")
  ) {
    return result;
  }

  const headMatch = result.match(/<head\b[^>]*>/i);
  if (headMatch && typeof headMatch.index === "number") {
    const insertAt = headMatch.index + headMatch[0].length;
    return (
      result.slice(0, insertAt) +
      CHART_COMPAT_SHIM +
      result.slice(insertAt)
    );
  }

  const scriptMatch = result.match(/<script\b/i);
  if (scriptMatch && typeof scriptMatch.index === "number") {
    return (
      result.slice(0, scriptMatch.index) +
      CHART_COMPAT_SHIM +
      result.slice(scriptMatch.index)
    );
  }

  return CHART_COMPAT_SHIM + result;
}
