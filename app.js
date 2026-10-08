// EHRDyn leaderboard: static page. Reads data/*.json (aggregate paper results) and data/copy.json (page text).
(function () {
  "use strict";
  const state = { tab: "policies", family: "fitted", sortKey: "diff", sortDir: "desc", query: "" };
  let copy = {}, board = [], perTask = [], ope = [];

  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, attrs = {}, text) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const svgEl = (tag, attrs = {}) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };
  const fmt = (x, digits = 3) => (x === null || x === undefined || Number.isNaN(x) ? "—" : Number(x).toFixed(digits));
  const signed = (x) => (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x).toFixed(3);
  const nmaeFmt = (x) => (Math.abs(x) >= 1000 ? Number(x).toExponential(2).replace("e+", "e") : Number(x).toFixed(3));
  const setText = (id, key) => { const node = document.getElementById(id); if (node) node.textContent = copy[key] || ""; };

  function cols() {
    const f = state.family;
    return { mean: f + "_mean", diff: f + "_diff", lo: f + "_lo", hi: f + "_hi" };
  }
  function status(row) {
    const c = cols();
    if (row[c.lo] > 0) return "above";
    if (row[c.hi] < 0) return "below";
    return "zero";
  }

  function fillCopy() {
    document.title = copy.site_title || "EHRDyn Leaderboard";
    setText("site-title", "site_title"); setText("tagline", "tagline"); setText("intro", "intro");
    setText("eyebrow", "eyebrow"); setText("howto-summary", "howto_summary");
    const list = $("#how-to-read"); list.replaceChildren(...(copy.how_to_read || []).map((t) => el("li", {}, t)));
    for (const t of ["policies", "per_task", "ope", "about"]) setText("tab-" + t, "tab_" + t);
    for (const i of [1, 2]) { setText("fam-fitted-" + i, "family_fitted_label"); setText("fam-controlled-" + i, "family_controlled_label"); }
    setText("policies-heading", "policies_heading"); setText("per-task-heading", "per_task_heading");
    setText("per-task-note", "per_task_note"); setText("ope-heading", "ope_heading"); setText("ope-note", "ope_note");
    setText("ope-fitted-title", "ope_fitted_title"); setText("ope-controlled-title", "ope_controlled_title");
    setText("legend-above", "legend_above"); setText("legend-zero", "legend_zero"); setText("legend-below", "legend_below");
    setText("scale-low", "scale_low"); setText("scale-high", "scale_high"); setText("search-label", "search_label");
    setText("tasks-above-note", "tasks_above_note");
    setText("about-heading", "about_heading"); setText("about-text", "about_text");
    setText("submit-heading", "submit_heading"); setText("submit-text", "submit_text");
    setText("caveats-heading", "caveats_heading"); setText("footer", "footer");
    $("#caveats").replaceChildren(...(copy.caveats || []).map((t) => el("li", {}, t)));
    $("#search").placeholder = copy.search_placeholder || "";
  }

  // ---------- policies: forest plot ----------
  function drawForest() {
    const c = cols();
    const rows = board.slice().sort((a, b) => b[c.diff] - a[c.diff]);
    const fig = $("#forest");
    const width = Math.max(320, fig.clientWidth || 720);
    const narrow = width < 560;
    const labelW = narrow ? 150 : 230, right = 56, rowH = 22, top = 26, bottom = 34;
    const height = top + rows.length * rowH + bottom;
    const lo = Math.min(...rows.map((r) => r[c.lo]), 0), hi = Math.max(...rows.map((r) => r[c.hi]), 0);
    const pad = (hi - lo) * 0.05;
    const x0 = labelW, x1 = width - right;
    const sx = (v) => x0 + ((v - (lo - pad)) / (hi + pad - (lo - pad))) * (x1 - x0);
    const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", role: "img",
      "aria-label": copy.chart_axis_label || "" });
    const step = niceStep((hi - lo) / (narrow ? 4 : 7));
    for (let t = Math.ceil((lo - pad) / step) * step; t <= hi + pad + 1e-9; t += step) {
      const x = sx(t);
      svg.append(svgEl("line", { x1: x, x2: x, y1: top - 6, y2: height - bottom + 4, class: Math.abs(t) < 1e-9 ? "zero" : "grid" }));
      const g = svgEl("g", { class: "tick" });
      const label = svgEl("text", { x, y: height - bottom + 18, "text-anchor": "middle" });
      label.textContent = Math.abs(t) < 1e-9 ? "0" : (t > 0 ? "+" : "−") + Math.abs(t).toFixed(step < 0.1 ? 2 : 1);
      g.append(label); svg.append(g);
    }
    const axis = svgEl("text", { x: (x0 + x1) / 2, y: height - 4, "text-anchor": "middle" });
    axis.textContent = copy.chart_axis_label || ""; axis.setAttribute("class", "axis-label");
    svg.append(axis);
    rows.forEach((r, i) => {
      const y = top + i * rowH + rowH / 2;
      const s = status(r);
      const color = s === "above" ? "var(--accent)" : s === "below" ? "var(--below)" : "var(--muted-mark)";
      const name = svgEl("text", { x: labelW - 10, y: y + 4, "text-anchor": "end" });
      name.textContent = r.method; svg.append(name);
      svg.append(svgEl("line", { x1: sx(r[c.lo]), x2: sx(r[c.hi]), y1: y, y2: y, stroke: color, "stroke-width": 2.5, "stroke-linecap": "round" }));
      svg.append(svgEl("circle", { cx: sx(r[c.diff]), cy: y, r: 4.2, fill: color }));
      const val = svgEl("text", { x: width - right + 8, y: y + 4, class: "tick" });
      val.setAttribute("font-family", "var(--font-data)"); val.setAttribute("font-size", "11");
      val.textContent = signed(r[c.diff]); svg.append(val);
    });
    fig.replaceChildren(svg);
  }
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
  }

  // ---------- policies: table ----------
  function drawPolicyTable() {
    const c = cols();
    const fitted = state.family === "fitted";
    const headers = [
      ["method", copy.col_method, false], ["family", copy.col_family, false], ["mean", copy.col_mean, true],
      ["diff", copy.col_diff, true], ["interval", copy.col_interval, true],
    ];
    if (fitted) headers.push(["tasks", copy.col_tasks_above, true]);
    const tr = $("#policy-table thead tr");
    tr.replaceChildren(...headers.map(([key, label, num]) => {
      const th = el("th", { scope: "col", class: num ? "num" : "" });
      if (state.sortKey === key) th.setAttribute("aria-sort", state.sortDir === "asc" ? "ascending" : "descending");
      const b = el("button", { type: "button" }, label || "");
      b.addEventListener("click", () => {
        state.sortDir = state.sortKey === key && state.sortDir === "desc" ? "asc" : "desc";
        state.sortKey = key; drawPolicyTable();
      });
      th.append(b); return th;
    }));
    const value = (r, key) => ({ method: r.method, family: r.family, mean: r[c.mean], diff: r[c.diff], interval: r[c.lo],
      tasks: r.fitted_tasks_above_best_control }[key]);
    const q = state.query.trim().toLowerCase();
    const rows = board.filter((r) => !q || r.method.toLowerCase().includes(q) || r.family.toLowerCase().includes(q))
      .sort((a, b) => {
        const va = value(a, state.sortKey), vb = value(b, state.sortKey);
        const cmp = typeof va === "string" ? va.localeCompare(vb) : va - vb;
        return state.sortDir === "asc" ? cmp : -cmp;
      });
    $("#policy-table tbody").replaceChildren(...rows.map((r) => {
      const s = status(r);
      const row = el("tr", { "data-key": r.method });
      row.append(el("td", { class: "method" }, r.method), el("td", {}, r.family),
        el("td", { class: "num" }, fmt(r[c.mean])), el("td", { class: "num" }, signed(r[c.diff])));
      const ci = el("td", { class: "num" });
      ci.append(el("span", { class: "pill " + (s === "above" ? "" : s) }, `[${signed(r[c.lo])}, ${signed(r[c.hi])}]`));
      row.append(ci);
      if (fitted) row.append(el("td", { class: "num" }, String(r.fitted_tasks_above_best_control)));
      return row;
    }));
    $("#tasks-above-note").hidden = !fitted;
  }

  // ---------- per task heat table ----------
  function drawHeat() {
    const fam = state.family === "fitted" ? "EHR-fitted" : "Controlled";
    const units = ["Sepsis", "Respiratory", "Shock", "AKI", "HF"];
    const rows = perTask.filter((r) => r.family === fam);
    const methods = board.map((r) => r.method);
    const vals = rows.map((r) => r.control_scaled);
    const vmax = Math.max(1, ...vals), vmin = Math.min(0, ...vals);
    $("#heat-table thead tr").replaceChildren(el("th", { scope: "col" }, copy.col_method || ""),
      ...units.map((u) => el("th", { scope: "col", class: "num" }, u)));
    const cs = getComputedStyle(document.documentElement);
    const lo = cs.getPropertyValue("--heat-lo").trim(), hi = cs.getPropertyValue("--heat-hi").trim();
    $("#heat-table tbody").replaceChildren(...methods.map((m) => {
      const tr = el("tr", { "data-key": m });
      tr.append(el("td", { class: "method" }, m));
      for (const u of units) {
        const cell = rows.find((r) => r.method === m && r.unit === u);
        const v = cell ? cell.control_scaled : NaN;
        const t = Math.max(0, Math.min(1, (v - vmin) / (vmax - vmin)));
        const td = el("td", { class: "num" }, fmt(v, 2));
        td.style.background = `color-mix(in srgb, ${hi} ${Math.round(t * 85)}%, ${lo})`;
        if (t > 0.6) td.style.color = "#ffffff";
        tr.append(td);
      }
      return tr;
    }));
  }

  // ---------- OPE tables ----------
  function drawOpe() {
    for (const table of document.querySelectorAll(".ope-table")) {
      const fam = table.dataset.family;
      const rows = ope.filter((r) => r.family === fam);
      const best = {
        nmae: Math.min(...rows.map((r) => r.nmae)),
        cov: rows.reduce((a, r) => (Math.abs(r.coverage90 - 0.9) < Math.abs(a - 0.9) ? r.coverage90 : a), rows[0].coverage90),
        sp: Math.max(...rows.map((r) => r.spearman)), pw: Math.max(...rows.map((r) => r.pairwise_order)),
      };
      table.querySelector("thead tr").replaceChildren(el("th", { scope: "col" }, copy.col_estimator || ""),
        ...[copy.col_nmae, copy.col_cov90, copy.col_spearman, copy.col_pairwise].map((l) => el("th", { scope: "col", class: "num" }, l || "")));
      table.querySelector("tbody").replaceChildren(...rows.map((r) => {
        const tr = el("tr", { "data-key": r.estimator });
        tr.append(el("td", { class: "method" }, r.estimator),
          el("td", { class: "num" + (r.nmae === best.nmae ? " best" : "") }, nmaeFmt(r.nmae)),
          el("td", { class: "num" + (r.coverage90 === best.cov ? " best" : "") }, fmt(r.coverage90)),
          el("td", { class: "num" + (r.spearman === best.sp ? " best" : "") }, fmt(r.spearman)),
          el("td", { class: "num" + (r.pairwise_order === best.pw ? " best" : "") }, fmt(r.pairwise_order)));
        return tr;
      }));
    }
  }

  function render() {
    for (const b of document.querySelectorAll(".tabs button")) b.setAttribute("aria-selected", String(b.dataset.tab === state.tab));
    for (const p of document.querySelectorAll(".panel")) p.hidden = p.id !== state.tab;
    for (const b of document.querySelectorAll(".toggle button")) b.setAttribute("aria-pressed", String(b.dataset.family === state.family));
    $("#policies-note").textContent = copy["policies_note_" + state.family] || "";
    if (state.tab === "policies") { drawForest(); drawPolicyTable(); }
    if (state.tab === "per_task") drawHeat();
    if (state.tab === "ope") drawOpe();
  }

  function wire() {
    for (const b of document.querySelectorAll(".tabs button")) b.addEventListener("click", () => {
      state.tab = b.dataset.tab; render();
      if (history.replaceState) history.replaceState(null, "", "#" + state.tab);
    });
    for (const b of document.querySelectorAll(".toggle button")) b.addEventListener("click", () => { state.family = b.dataset.family; render(); });
    $("#search").addEventListener("input", (e) => { state.query = e.target.value; drawPolicyTable(); });
    let pending;
    window.addEventListener("resize", () => { clearTimeout(pending); pending = setTimeout(render, 120); });
    const hash = location.hash.slice(1);
    if (["policies", "per_task", "ope", "about"].includes(hash)) state.tab = hash;
  }

  Promise.all(["copy", "leaderboard", "per_task", "ope_estimators"].map((n) => fetch(`data/${n}.json`).then((r) => r.json())))
    .then(([c, b, p, o]) => { copy = c; board = b; perTask = p; ope = o; fillCopy(); wire(); render(); })
    .catch(() => { const t = document.getElementById("intro"); if (t) t.textContent = "The leaderboard data could not be loaded."; });
})();
