/* Chart components for this post only, in the style of the shared charts.js (svg helper, hairline grid, direct labels,
   hover tooltips, data tables, redraw on resize, panels stacked below 720px). Data: window.FIGURES, window.EXAMPLES. */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const f2 = (x) => x.toFixed(2), f3 = (x) => x.toFixed(3);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function el(tag, attrs = {}, parent) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, attrs = {}) { const t = el("text", Object.assign({ x, y }, attrs), parent); t.textContent = str; return t; }
  function svg(container, w, h) { const s = el("svg", { viewBox: `0 0 ${w} ${h}`, role: "img" }); container.appendChild(s); return s; }
  const scale = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
  let tip;
  function tooltip(target, html) {
    if (!tip) { tip = document.createElement("div"); tip.className = "tip"; document.body.appendChild(tip); }
    target.addEventListener("mousemove", (e) => {
      tip.innerHTML = html; tip.style.opacity = 1;
      tip.style.left = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8) + "px"; tip.style.top = e.clientY + 14 + "px";
    });
    target.addEventListener("mouseleave", () => { tip.style.opacity = 0; });
  }
  function table(container, head, rows) {
    const t = document.createElement("table"); t.className = "data";
    t.innerHTML = "<thead><tr>" + head.map((h, i) => `<th class="${i ? "n" : ""}">${h}</th>`).join("") + "</tr></thead>";
    const b = document.createElement("tbody");
    rows.forEach((r) => { const tr = document.createElement("tr"); tr.innerHTML = r.map((c, i) => `<td class="${i ? "n" : ""}">${c}</td>`).join(""); b.appendChild(tr); });
    t.appendChild(b); container.appendChild(t);
  }
  const short = (s, n = 60) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const probeTip = (m, p) => `<b>${m.name}</b> · score ${f3(p.s)}<br>sent: ${esc(short(p.p))}<br>got: ${esc(short(p.o || "(empty)"))}<br>${p.w} word${p.w === 1 ? "" : "s"} · ${Math.round(100 * p.nov)}% unseen in baseline`;

  /* Figure 1: every probe's score per model, with the model's ceiling. */
  function ceilingStrip(container, models, opts = {}) {
    const cw = container.clientWidth, narrow = cw < 720;
    const W = Math.max(320, cw), labelW = narrow ? 0 : 92, padR = narrow ? 8 : 92, top = 34, rowH = narrow ? 74 : 62;
    const H = top + models.length * rowH + 44;
    const s = svg(container, W, H), innerW = W - labelW - padR, x = scale(0, 6, 0, innerW);
    const g = el("g", { transform: `translate(${labelW},0)` }, s);
    const grid = el("g", { class: "grid" }, g), tk = el("g", { class: "tick" }, g);
    for (let t = 0; t <= 6; t++) { el("line", { x1: x(t), x2: x(t), y1: top - 6, y2: top + models.length * rowH - 8 }, grid); text(tk, x(t), top - 12, t, { "text-anchor": "middle" }); }
    text(g, innerW / 2, H - 6, "anomaly score of each probe", { "text-anchor": "middle", "font-size": 11.5, fill: css("--muted") });
    let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    models.forEach((m, i) => {
      const y0 = top + i * rowH, yc = y0 + (narrow ? 40 : 26);
      if (narrow) text(g, 0, y0 + 10, m.name, { "font-size": 13, "font-weight": 650 });
      else text(g, -12, yc + 4, m.name, { "text-anchor": "end", "font-size": 13, "font-weight": 650 });
      const xc = x(m.ceiling);
      el("line", { x1: xc, x2: xc, y1: yc - 19, y2: yc + 19, stroke: css("--c-soft"), "stroke-width": 1.6, "stroke-dasharray": "3 2" }, g);
      if (i === models.length - 1) text(g, xc, yc + 32, `ceiling ${m.ceiling.toFixed(2)}`, { "text-anchor": "middle", "font-size": 10.5, fill: css("--t-soft"), "font-weight": 600 });
      m.probes.forEach((p) => {
        const at = p.s >= m.ceiling - 0.005;
        const c = el("circle", { cx: x(p.s), cy: yc + (rnd() - 0.5) * 26, r: at ? 3.6 : 2.4, fill: at ? css("--c-soft") : css("--c-broken"), opacity: at ? 0.95 : 0.45 }, g);
        tooltip(c, probeTip(m, p));
      });
      const lab = `${m.at_ceiling} of ${m.n} at ceiling`;
      if (narrow) text(g, innerW, y0 + 10, lab, { "text-anchor": "end", class: "num", "font-size": 10.5, fill: css("--t-soft") });
      else { text(g, innerW + 12, yc - 2, `${m.at_ceiling} of ${m.n}`, { class: "num", "font-weight": 600, fill: css("--ink") }); text(g, innerW + 12, yc + 12, "at ceiling", { "font-size": 11, fill: css("--muted") }); }
    });
    if (opts.table) table(opts.table, ["Model", "Probes", "Median", "Ceiling", "Top", "At ceiling"],
      models.map((m) => [m.name, m.n, f2(m.median), f3(m.ceiling), f3(m.top), m.at_ceiling]));
  }

  /* Figure 2: score against reply length, inside the band the formula allows (novelty 0 to 1). */
  function lengthBand(container, models) {
    const cw = container.clientWidth, narrow = cw < 720;
    const W = Math.max(320, cw), cols = cw < 520 ? 1 : 2, gapX = 26, gapY = 22, padL = 30, padR = 8, top = 30, h = 140;
    const colW = (W - (cols - 1) * gapX) / cols, innerW = colW - padL - padR, panelH = top + h + 34;
    const rows = Math.ceil(models.length / cols), H = rows * panelH + (rows - 1) * gapY;
    const s = svg(container, W, H);
    const lx = (w) => Math.log10(Math.max(1, w)), x = scale(0, Math.log10(3000), 0, innerW), y = scale(0, 6, top + h, top);
    models.forEach((m, i) => {
      const g = el("g", { transform: `translate(${(i % cols) * (colW + gapX) + padL},${Math.floor(i / cols) * (panelH + gapY)})` }, s);
      text(g, -padL, 14, m.name, { "font-weight": 650, "font-size": 14 });
      text(g, innerW, 14, `mean ${Math.round(m.mean_len)} words`, { "text-anchor": "end", class: "num" });
      const grid = el("g", { class: "grid" }, g), tk = el("g", { class: "tick" }, g);
      [1, 10, 100, 1000].forEach((t) => { el("line", { x1: x(lx(t)), x2: x(lx(t)), y1: top, y2: top + h }, grid); text(tk, x(lx(t)), top + h + 14, t.toLocaleString(), { "text-anchor": "middle" }); });
      [0, 2, 4, 6].forEach((t) => { el("line", { x1: 0, x2: innerW, y1: y(t), y2: y(t) }, grid); text(tk, -6, y(t) + 4, t, { "text-anchor": "end" }); });
      // the band: score = 0.6|w - mean|/std + 4·novelty, novelty in [0, 1]
      const lo = [], hi = [];
      for (let k = 0; k <= 120; k++) { const w = Math.pow(10, (k / 120) * Math.log10(3000)), z = 0.6 * Math.abs(w - m.mean_len) / m.std_len; lo.push([x(lx(w)), y(Math.min(6, z))]); hi.push([x(lx(w)), y(Math.min(6, z + 4))]); }
      el("path", { d: "M" + hi.map((q) => q.join(",")).join("L") + "L" + lo.slice().reverse().map((q) => q.join(",")).join("L") + "Z", fill: css("--tint"), opacity: 0.85 }, g);
      el("path", { d: "M" + hi.map((q) => q.join(",")).join("L"), fill: "none", stroke: css("--axis"), "stroke-width": 1.2 }, g);
      el("path", { d: "M" + lo.map((q) => q.join(",")).join("L"), fill: "none", stroke: css("--axis"), "stroke-width": 1.2 }, g);
      el("line", { x1: 0, x2: innerW, y1: y(m.ceiling), y2: y(m.ceiling), stroke: css("--c-soft"), "stroke-width": 1.4, "stroke-dasharray": "3 2" }, g);
      m.probes.forEach((p) => {
        const at = p.s >= m.ceiling - 0.005;
        const c = el("circle", { cx: x(lx(p.w)), cy: y(p.s), r: at ? 3.4 : 2.3, fill: at ? css("--c-soft") : css("--ink-2"), opacity: at ? 0.95 : 0.4 }, g);
        tooltip(c, probeTip(m, p));
      });
      if (i === 0) {
        text(g, x(lx(1)) + 8, y(m.ceiling) - 7, "ceiling", { "font-size": 11, fill: css("--t-soft"), "font-weight": 600 });
        text(g, x(lx(m.mean_len)), y(0.9) + 2, "all words seen", { "text-anchor": "middle", "font-size": 10.5, fill: css("--muted") });
      }
      text(g, innerW / 2, top + h + 30, "reply length (words, log scale)", { "text-anchor": "middle", "font-size": 11, fill: css("--muted") });
    });
  }

  /* Figure 3: each repeat of the same prompt as a dot; filled = identical to the most common reply. */
  function repeats(container, rows, opts = {}) {
    const cw = container.clientWidth, narrow = cw < 720;
    const W = Math.max(320, cw), labelW = narrow ? 0 : 230, padR = narrow ? 8 : 78, top = 30, rowH = narrow ? 44 : 32, groupGap = 30;
    const groups = [["greedy", "Warmup · run locally, greedy decoding"], ["sampled", "Models 2 and 3 · via the API, sampled"]];
    const H = top + rows.length * rowH + groups.length * groupGap + 24;
    const s = svg(container, W, H), innerW = W - labelW - padR, x = scale(0, 6, 0, innerW);
    const g = el("g", { transform: `translate(${labelW},0)` }, s);
    const grid = el("g", { class: "grid" }, g), tk = el("g", { class: "tick" }, g);
    for (let t = 0; t <= 6; t++) { el("line", { x1: x(t), x2: x(t), y1: top - 6, y2: H - 30 }, grid); text(tk, x(t), top - 12, t, { "text-anchor": "middle" }); }
    text(g, innerW / 2, H - 8, "anomaly score of each repeat", { "text-anchor": "middle", "font-size": 11.5, fill: css("--muted") });
    let yy = top;
    groups.forEach(([key, title]) => {
      yy += groupGap;
      text(g, narrow ? 0 : -labelW, yy - 10, title.toUpperCase(), { "font-size": 10.5, "font-weight": 650, "letter-spacing": ".08em", fill: css("--muted") });
      rows.filter((r) => r.decoding === key).forEach((r) => {
        const yc = yy + (narrow ? 26 : 16), lab = `${r.name}: ${r.prompt}`;
        if (narrow) text(g, 0, yc - 13, lab, { "font-size": 12, "font-weight": 600 });
        else text(g, -12, yc + 4, lab, { "text-anchor": "end", "font-size": 12.5, "font-weight": 600 });
        const allDiffer = r.k_same === 1, groups = new Map();
        r.trials.forEach((t, k) => { const same = t.same && !allDiffer, key = same ? t.s.toFixed(2) + "s" : "d" + k;
          if (!groups.has(key)) groups.set(key, { s: t.s, same, idx: [] }); groups.get(key).idx.push(k); });
        groups.forEach((gp) => {
          const c = el("circle", { cx: x(gp.s), cy: yc, r: 5.5, fill: gp.same ? css("--accent") : "#fff", stroke: css("--accent"), "stroke-width": 1.8 }, g);
          if (gp.idx.length > 1) text(g, x(gp.s) - 9, yc + 4, `×${gp.idx.length}`, { "text-anchor": "end", class: "num", "font-weight": 600, fill: css("--t-explicit") });
          const t0 = r.trials[gp.idx[0]];
          tooltip(c, `<b>${esc(lab)}</b><br>${gp.idx.length} of ${r.n} repeats here, score ${f3(gp.s)}<br>got: ${esc(short(t0.o))}<br>${gp.same ? "the most common reply" : "a reply no other repeat matched"}`);
        });
        const lt = allDiffer ? `all ${r.n} differ` : `${r.k_same}/${r.n} same`;
        if (narrow) text(g, innerW, yc - 13, lt, { "text-anchor": "end", class: "num", "font-weight": 600, fill: css("--ink") });
        else text(g, innerW + 12, yc + 4, lt, { class: "num", "font-weight": 600, fill: css("--ink") });
        yy += rowH;
      });
    });
    if (opts.table) table(opts.table, ["Model · prompt", "Decoding", "n", "Same", "Scores"],
      rows.map((r) => [`${r.name}: ${esc(r.prompt)}`, r.decoding, r.n, r.k_same, r.trials.map((t) => f2(t.s)).join(", ")]));
  }

  /* Examples: one row per example; each opens into the prompt and the replies. */
  const KIND = { candidate: "candidate", artifact: "ceiling artifact", completion: "message completion", "self-report": "self-report", normal: "normal reply" };
  function examples(rootId, ids) {
    const root = document.getElementById(rootId), E = window.EXAMPLES; if (!root || !E) return;
    const items = ids.map((id) => E.items.find((x) => x.id === id));
    let h = `<div class="ex-bar"><span>Open a row to read the replies, quoted verbatim (long ones cut at “…”).</span></div>`;
    items.forEach((it, i) => {
      const first = it.replies[0];
      h += `<div class="ex-item"><button type="button" class="ex-row dx" aria-expanded="false"><span class="ex-cat"><b>${i + 1}</b>${esc(it.name)}</span>` +
        `<span class="ex-prompt">${esc(short(first.prompt, 46))}</span><span class="kchip ${it.kind.replace(/\W/g, "")}"><i></i>${KIND[it.kind]}</span>` +
        `<span class="ex-caret" aria-hidden="true"></span></button><div class="ex-detail"><p class="ex-take"><b>What to notice.</b> ${esc(it.takeaway)}</p>`;
      let last = null;
      it.replies.forEach((r) => {
        if (r.prompt !== last) h += `<div class="ex-ask"><span>Sent to ${esc(it.name)}</span>${esc(r.prompt)}</div>`;
        last = r.prompt;
        h += `<div class="ex-bubble dx"><div class="ex-bh"><span>reply · ${r.words} word${r.words === 1 ? "" : "s"} · score ${f3(r.score)}</span></div><div class="dx-text">${esc(r.text)}</div></div>`;
      });
      h += `</div></div>`;
    });
    root.className = "ex"; root.innerHTML = h;
    root.querySelectorAll(".ex-row").forEach((b) => b.onclick = () => { const o = b.parentElement.classList.toggle("open"); b.setAttribute("aria-expanded", o); });
  }

  const registry = [];
  const responsive = (fn) => (container, data, opts = {}) => {
    const draw = () => { container.innerHTML = ""; if (opts.table) opts.table.innerHTML = ""; fn(container, data, opts); };
    registry.push(draw); draw();
  };
  let lastW = innerWidth, timer;
  addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(() => { if (Math.abs(innerWidth - lastW) > 40) { lastW = innerWidth; registry.forEach((d) => d()); } }, 150); });
  window.Post = { ceilingStrip: responsive(ceilingStrip), lengthBand: responsive(lengthBand), repeats: responsive(repeats), examples };
})();
