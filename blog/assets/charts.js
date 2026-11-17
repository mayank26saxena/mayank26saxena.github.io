/* Small, dependency-free SVG chart components for research blog posts.
   Each component takes a container element and a plain data object, draws an SVG with hairline grid, direct labels,
   interval whiskers and a hover tooltip, and fills a data table for accessibility. Styling comes from tokens.css. */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const COLOR = { REFUSE_EXPLICIT: "--c-explicit", REFUSE_SOFT: "--c-soft", COMPLY: "--c-comply", BROKEN: "--c-broken" };
  const NAME = { REFUSE_EXPLICIT: "Explicit refusal", REFUSE_SOFT: "Soft refusal", COMPLY: "Complied", BROKEN: "Broken" };
  const fmt = (x, d = 1) => (Math.abs(x) < 0.05 && d === 1 ? "0.0" : x.toFixed(d)).replace("-", "−");
  const sgn = (x, d = 1) => (x > 0 ? "+" : x < 0 ? "−" : "") + fmt(Math.abs(x), d);

  function el(tag, attrs = {}, parent) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, attrs = {}) {
    const t = el("text", Object.assign({ x, y }, attrs), parent);
    t.textContent = str;
    return t;
  }
  function svg(container, w, h) {
    const s = el("svg", { viewBox: `0 0 ${w} ${h}`, role: "img" });
    container.appendChild(s);
    return s;
  }
  const scale = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

  // shared tooltip
  let tip;
  function tooltip(target, html) {
    if (!tip) { tip = document.createElement("div"); tip.className = "tip"; document.body.appendChild(tip); }
    target.addEventListener("mousemove", (e) => {
      tip.innerHTML = html; tip.style.opacity = 1;
      const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
      tip.style.left = x + "px"; tip.style.top = e.clientY + 14 + "px";
    });
    target.addEventListener("mouseleave", () => { tip.style.opacity = 0; });
  }
  function xgrid(g, x, ticks, y0, y1, fmtTick = (t) => t + "%") {
    const grid = el("g", { class: "grid" }, g), tk = el("g", { class: "tick" }, g);
    ticks.forEach((t) => {
      el("line", { x1: x(t), x2: x(t), y1: y0, y2: y1 }, grid);
      text(tk, x(t), y0 - 8, fmtTick(t), { "text-anchor": "middle" });
    });
  }
  function whisker(g, x0, x1, y, color, h = 5) {
    el("line", { x1: x0, x2: x1, y1: y, y2: y, stroke: color, "stroke-width": 1.5, opacity: 0.55 }, g);
    [x0, x1].forEach((x) => el("line", { x1: x, x2: x, y1: y - h / 2, y2: y + h / 2, stroke: color, "stroke-width": 1.5, opacity: 0.55 }, g));
  }
  function table(container, head, rows) {
    const t = document.createElement("table"); t.className = "data";
    t.innerHTML = "<thead><tr>" + head.map((h) => `<th>${h}</th>`).join("") + "</tr></thead>";
    const b = document.createElement("tbody");
    rows.forEach((r) => { const tr = document.createElement("tr"); tr.innerHTML = r.map((c, i) => `<td class="${i ? "n" : ""}">${c}</td>`).join(""); b.appendChild(tr); });
    t.appendChild(b); container.appendChild(t);
  }

  /* Paired dumbbells: for each category, English -> Hindi share with Wilson whiskers, one panel per model. */
  function pairedShift(container, panels, opts = {}) {
    const narrow = container.clientWidth < 720;
    const W = narrow ? Math.max(320, container.clientWidth) : 920, rowH = 44, top = 74, panelGap = 34, labelW = container.clientWidth < 500 ? 116 : 128, padR = 58;
    const colW = narrow ? W - labelW : (W - labelW - panelGap) / 2, innerW = colW - padR;
    const panelH = top + 4 * rowH + 74, H = narrow ? panelH * panels.length : panelH;
    const s = svg(container, W, H);
    const x = scale(0, 100, 0, innerW);
    panels.forEach((p, pi) => {
      const g = el("g", { transform: narrow ? `translate(${labelW},${pi * panelH})` : `translate(${labelW + pi * (colW + panelGap)},0)` }, s);
      text(g, 0, 18, p.title, { "font-weight": 650, "font-size": 15 });
      text(g, 0, 36, p.subtitle, { class: "num", "font-size": 11 });
      xgrid(g, x, [0, 25, 50, 75, 100], top - 4, top + 4 * rowH - 10);
      p.rows.forEach((r, i) => {
        const y = top + 14 + i * rowH, c = css(COLOR[r.label]);
        if (pi === 0 || narrow) text(g, -14, y + 4, NAME[r.label], { "text-anchor": "end", "font-size": 13, "font-weight": 600 });
        whisker(g, x(r.en.ci[0]), x(r.en.ci[1]), y, css("--ink-2"));
        whisker(g, x(r.hi.ci[0]), x(r.hi.ci[1]), y, c);
        el("line", { x1: x(r.en.pct), x2: x(r.hi.pct), y1: y, y2: y, stroke: c, "stroke-width": 2.5, opacity: 0.85 }, g);
        el("circle", { cx: x(r.en.pct), cy: y, r: 6, fill: "#fff", stroke: css("--ink-2"), "stroke-width": 2 }, g);
        el("circle", { cx: x(r.hi.pct), cy: y, r: 6.5, fill: c, stroke: "#fff", "stroke-width": 2 }, g);
        const d = r.change.pts;
        text(g, innerW + 10, y + 4, sgn(d, 0) + " pts", { class: "num", "font-weight": 600, fill: css("--ink") });
        const hit = el("rect", { class: "hit", x: -6, y: y - rowH / 2, width: innerW + padR, height: rowH }, g);
        tooltip(hit, `<b>${p.title}: ${NAME[r.label]}</b><br>English ${fmt(r.en.pct)}% (${r.en.k}/${p.n})<br>Hindi ${fmt(r.hi.pct)}% (${r.hi.k}/${p.n})<br>Change ${sgn(d)} pts [${fmt(r.change.ci[0])}, ${fmt(r.change.ci[1])}]`);
      });
      // composition of lost refusals
      const yb = top + 4 * rowH + 12, total = p.lost_n;
      if (pi === 0 || narrow) text(g, -14, yb + 15, "Lost refusals", { "text-anchor": "end", "font-size": 13, "font-weight": 600, fill: css("--ink-2") });
      let acc = 0;
      ["REFUSE_SOFT", "COMPLY", "BROKEN"].forEach((k) => {
        const v = p.lost[k] || 0, w = (v / total) * innerW;
        const r = el("rect", { x: x(0) + (acc / total) * innerW + (acc ? 1 : 0), y: yb, width: Math.max(0, w - 2), height: 22, rx: 3, fill: css(COLOR[k]) }, g);
        if (w > 46) text(g, x(0) + (acc / total) * innerW + w / 2, yb + 15, `${v}`, { "text-anchor": "middle", "font-size": 12, "font-weight": 650, fill: k === "REFUSE_SOFT" ? css("--ink") : "#fff" });
        tooltip(r, `<b>${p.title}</b>: of ${total} requests refused explicitly in English but not in Hindi, ${v} became <b>${NAME[k].toLowerCase()}</b> in Hindi`);
        acc += v;
      });
      text(g, innerW + 10, yb + 15, `${total}`, { class: "num" });
    });
    if (opts.table) table(opts.table, ["Model / label", "English %", "Hindi %", "Change (pts)", "95% CI"],
      panels.flatMap((p) => p.rows.map((r) => [`${p.title}: ${NAME[r.label]}`, fmt(r.en.pct), fmt(r.hi.pct), sgn(r.change.pts), `${fmt(r.change.ci[0])} to ${fmt(r.change.ci[1])}`])));
  }

  /* Before -> after arrows per language, with the gap and a registered bar; one panel per model. */
  function repairs(container, panels, opts = {}) {
    const narrow = container.clientWidth < 720;
    const W = narrow ? Math.max(320, container.clientWidth) : 920, top = 78, rowH = 46, labelW = narrow ? 64 : 150, padR = narrow ? 70 : 160;
    const panelH = top + 2 * rowH + (narrow ? 74 : 58);
    const H = panels.length * panelH;
    const s = svg(container, W, H);
    const innerW = W - labelW - padR, x = scale(0, 100, 0, innerW);
    panels.forEach((p, pi) => {
      const g = el("g", { transform: `translate(${labelW},${pi * panelH})` }, s);
      text(g, -labelW, 20, p.title, { "font-weight": 650, "font-size": 15 });
      text(g, -labelW, 38, narrow ? p.subtitle.split(" · ")[0] : p.subtitle, { "font-size": 12.5, fill: css("--muted") });
      xgrid(g, x, [0, 25, 50, 75, 100], top - 4, top + 2 * rowH - 6);
      [["English", "en", css("--ink-2")], ["Hindi", "hi", css("--accent")]].forEach(([name, k, c], i) => {
        const a = p.arms[k], y = top + 18 + i * rowH;
        text(g, -12, y + 4, name, { "text-anchor": "end", "font-size": 13.5, "font-weight": 600 });
        whisker(g, x(a.before_ci[0]), x(a.before_ci[1]), y, c);
        whisker(g, x(a.after_ci[0]), x(a.after_ci[1]), y, c);
        el("line", { x1: x(a.before) + 7, x2: x(a.after) - 9, y1: y, y2: y, stroke: c, "stroke-width": 2.5 }, g);
        el("path", { d: `M${x(a.after) - 10},${y - 5} L${x(a.after) - 2},${y} L${x(a.after) - 10},${y + 5} Z`, fill: c }, g);
        el("circle", { cx: x(a.before), cy: y, r: 5, fill: "#fff", stroke: c, "stroke-width": 2 }, g);
        el("circle", { cx: x(a.after), cy: y, r: 5.5, fill: c, stroke: "#fff", "stroke-width": 2 }, g);
        text(g, innerW + 12, y + 4, `${sgn(a.change)} pts`, { class: "num", "font-weight": 600, fill: css("--ink") });
        if (!narrow) text(g, innerW + 82, y + 4, `[${fmt(a.ci[0])}, ${fmt(a.ci[1])}]`, { class: "num", "font-size": 10.5 });
        const hit = el("rect", { class: "hit", x: -labelW, y: y - rowH / 2, width: W, height: rowH }, g);
        tooltip(hit, `<b>${p.title}, ${name}</b><br>explicit refusal ${fmt(a.before)}% → ${fmt(a.after)}%<br>change ${sgn(a.change)} pts [${fmt(a.ci[0])}, ${fmt(a.ci[1])}], n = ${a.n}`);
      });
      if (p.bar_explicit) {
        const xb = x(p.arms.hi.before + p.bar_explicit), yb = top + 18 + rowH;
        el("line", { x1: xb, x2: xb, y1: yb - 13, y2: yb + 13, stroke: css("--c-comply"), "stroke-width": 1.5, "stroke-dasharray": "3 2" }, g);
        text(g, xb, yb + 26, `registered bar (+${p.bar_explicit})`, { "text-anchor": "middle", "font-size": 11, fill: css("--t-comply") });
      }
      const ng1 = `Gap ${fmt(p.gap_before)} → ${fmt(p.gap_after)} pts`, ng2 = `narrowing ${sgn(p.narrowing)} [${fmt(p.narrowing_ci[0])}, ${fmt(p.narrowing_ci[1])}]` + (p.bar_gap ? ` · bar ${p.bar_gap}` : "");
      if (narrow) { text(g, -labelW, top + 2 * rowH + 30, ng1, { class: "num", "font-size": 11.5, fill: css("--ink-2") }); text(g, -labelW, top + 2 * rowH + 48, ng2, { class: "num", "font-size": 11.5, fill: css("--ink-2") }); }
      else text(g, 0, top + 2 * rowH + 30, ng1 + " · " + ng2, { class: "num", "font-size": 11.5, fill: css("--ink-2") });
    });
    if (opts.table) table(opts.table, ["Model / language", "Before %", "After %", "Change (pts)", "95% CI"],
      panels.flatMap((p) => [["English", "en"], ["Hindi", "hi"]].map(([n, k]) => [`${p.title}: ${n}`, fmt(p.arms[k].before), fmt(p.arms[k].after), sgn(p.arms[k].change), `${fmt(p.arms[k].ci[0])} to ${fmt(p.arms[k].ci[1])}`])));
  }

  /* Projection small multiples: harmless and harmful, English and Hindi, each model on its own axis. */
  function projections(container, panels, opts = {}) {
    const narrow = container.clientWidth < 720;
    const W = narrow ? Math.max(320, container.clientWidth) : 920, panelGap = 40, labelW = 92, padR = 18, top = 78, rowH = 60;
    const colW = narrow ? W : (W - panelGap) / 2, panelH = top + 2 * rowH + 52, H = narrow ? panelH * panels.length : panelH;
    const s = svg(container, W, H);
    panels.forEach((p, pi) => {
      const innerW = colW - labelW - padR;
      const vals = Object.values(p.cells).flatMap((c) => c.ci);
      const lo = Math.floor(Math.min(0, ...vals)), hi = Math.ceil(Math.max(...vals));
      const x = scale(lo, hi, 0, innerW);
      const g = el("g", { transform: narrow ? `translate(${labelW},${pi * panelH})` : `translate(${pi * (colW + panelGap) + labelW},0)` }, s);
      text(g, -labelW, 18, p.title, { "font-weight": 650, "font-size": 15 });
      text(g, -labelW, 36, p.subtitle, { class: "num", "font-size": 11 });
      const step = (hi - lo) > 6 ? 2 : 1, ticks = [];
      for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t);
      xgrid(g, x, ticks, top - 4, top + 2 * rowH + 4, (t) => t);
      el("line", { x1: x(0), x2: x(0), y1: top - 4, y2: top + 2 * rowH + 4, stroke: css("--axis"), "stroke-width": 1.2 }, g);
      [["harmless", "Harmless"], ["harmful", "Harmful"]].forEach(([k, name], i) => {
        const y = top + 30 + i * rowH, en = p.cells[`${k}_en`], hi_ = p.cells[`${k}_hi`];
        text(g, -12, y + 4, name, { "text-anchor": "end", "font-size": 13.5, "font-weight": 600 });
        whisker(g, x(en.ci[0]), x(en.ci[1]), y, css("--ink-2"));
        whisker(g, x(hi_.ci[0]), x(hi_.ci[1]), y, css("--accent"));
        el("line", { x1: x(en.mean), x2: x(hi_.mean), y1: y, y2: y, stroke: css("--accent"), "stroke-width": 2, opacity: 0.5, "stroke-dasharray": "4 3" }, g);
        // Hindi filled dot first, English as a larger ring on top, so coincident means stay visible as overlap
        el("circle", { cx: x(hi_.mean), cy: y, r: 6, fill: css("--accent"), stroke: "#fff", "stroke-width": 2 }, g);
        el("circle", { cx: x(en.mean), cy: y, r: 9, fill: "none", stroke: css("--ink-2"), "stroke-width": 2 }, g);
        const close = Math.abs(x(en.mean) - x(hi_.mean)) < 34;
        if (close) {
          const mid = (x(en.mean) + x(hi_.mean)) / 2, half = 60;
          text(g, Math.min(Math.max(mid, half), innerW + padR - half), y - 15, `EN ${fmt(en.mean, 2)} · HI ${fmt(hi_.mean, 2)}`, { class: "num", "font-size": 10.5, "text-anchor": "middle" });
        } else {
          text(g, x(en.mean), y - 15, fmt(en.mean, 2), { class: "num", "font-size": 10.5, "text-anchor": "middle" });
          text(g, x(hi_.mean), y - 15, fmt(hi_.mean, 2), { class: "num", "font-size": 10.5, "text-anchor": "middle", fill: css("--accent") });
        }
        const hit = el("rect", { class: "hit", x: -labelW, y: y - rowH / 2, width: colW, height: rowH }, g);
        tooltip(hit, `<b>${p.title}, ${name.toLowerCase()} requests</b><br>English mean ${fmt(en.mean, 2)}<br>Hindi mean ${fmt(hi_.mean, 2)}<br>n = ${en.n} pairs`);
      });
      text(g, 0, top + 2 * rowH + 30, p.note, { "font-size": 13, "font-weight": 600, fill: css("--ink") });
    });
    if (opts.table) table(opts.table, ["Model / set", "English mean", "Hindi mean", "n pairs"],
      panels.flatMap((p) => ["harmless", "harmful"].map((k) => [`${p.title}: ${k}`, fmt(p.cells[`${k}_en`].mean, 2), fmt(p.cells[`${k}_hi`].mean, 2), p.cells[`${k}_en`].n])));
  }


  /* Layer profile: per-layer curves (ablation effect, separation by language), chosen layer highlighted, hover crosshair. */
  function layerProfile(container, panels) {
    const narrow = container.clientWidth < 720;
    const W = narrow ? Math.max(320, container.clientWidth) : 920, gap = 40, padL = 44, padR = narrow ? 56 : 14, top = 74, rowH = 110, rowGap = 48;
    const colW = narrow ? W : (W - gap) / 2, innerW = colW - padL - padR;
    const rows = [
      { key: "ablation", title: "Refusal removed by ablating this layer's direction", lo: 0, hi: 1, fmt: (v) => Math.round(100 * v) + "%" },
      { key: "auroc", title: "Harmful vs harmless separation (AUROC)", lo: 0.5, hi: 1, fmt: (v) => v.toFixed(2) },
    ];
    const panelH = top + rows.length * (rowH + rowGap) + 12, H = narrow ? panelH * panels.length : panelH;
    const s = svg(container, W, H);
    panels.forEach((p, pi) => {
      const g = el("g", { transform: narrow ? `translate(${padL},${pi * panelH})` : `translate(${pi * (colW + gap) + padL},0)` }, s);
      const L = p.layers, x = scale(0, L - 1, 0, innerW);
      text(g, -padL, 18, p.title, { "font-weight": 650, "font-size": 15 });
      text(g, -padL, 36, p.subtitle, { class: "num", "font-size": 11 });
      // chosen-layer band across all rows
      const bandTop = top - 6, bandH = rows.length * (rowH + rowGap) - rowGap + 12;
      el("rect", { x: x(p.chosen) - 7, y: bandTop, width: 14, height: bandH, rx: 4, fill: css("--tint") }, g);
      text(g, x(p.chosen) + 10, top + 12, `layer ${p.chosen}`, { "font-size": 11.5, "font-weight": 650, fill: css("--accent") });
      rows.forEach((r, ri) => {
        const y0 = top + ri * (rowH + rowGap), y = scale(r.lo, r.hi, y0 + rowH, y0);
        text(g, -padL, y0 - 16, r.title, { "font-size": 12, fill: css("--ink-2"), "font-weight": 600 });
        const grid = el("g", { class: "grid" }, g), tk = el("g", { class: "tick" }, g);
        [r.lo, (r.lo + r.hi) / 2, r.hi].forEach((t) => { el("line", { x1: 0, x2: innerW, y1: y(t), y2: y(t) }, grid);
          text(tk, -6, y(t) + 4, r.fmt(t), { "text-anchor": "end" }); });
        for (let l = 0; l < L; l += (L > 30 ? 5 : 4)) text(tk, x(l), y0 + rowH + 14, l, { "text-anchor": "middle" });
        const series = r.key === "ablation" ? [["ablation", css("--ink"), "removed"]] : [["en", css("--ink-2"), "English"], ["hi", css("--accent"), "Hindi"]];
        const ends = [];
        series.forEach(([k, c, name]) => {
          const vals = r.key === "ablation" ? p.ablation : p[`auroc_${k}`];
          if (!vals) return;
          const pts = vals.map((v, l) => v == null ? null : [x(l), y(Math.max(r.lo, Math.min(r.hi, v)))]).filter(Boolean);
          el("path", { d: "M" + pts.map((q) => q.join(",")).join("L"), fill: "none", stroke: c, "stroke-width": 2, "stroke-linejoin": "round",
            "stroke-dasharray": k === "en" ? "0" : "0" }, g);
          if (r.key !== "ablation") { const last = pts[pts.length - 1]; ends.push([last[0], last[1], name, c]); }
        });
        // end labels: keep at least 13px apart vertically (upper label moves up, lower moves down)
        ends.sort((u, v) => u[1] - v[1]);
        for (let i = 1; i < ends.length; i++) if (ends[i][1] - ends[i - 1][1] < 13) {
          const mid = (ends[i][1] + ends[i - 1][1]) / 2; ends[i - 1][1] = mid - 6.5; ends[i][1] = mid + 6.5; }
        ends.forEach(([ex, ey, name, c]) => text(g, ex + 4, ey + 4, name, { "font-size": 11.5, "font-weight": 600, fill: c }));
        if (r.key === "auroc" && !p.auroc_hi) text(g, innerW / 2, y0 + rowH / 2, "Hindi curve: run layer_projections.py", { "text-anchor": "middle", "font-size": 12, fill: css("--muted") });
      });
      text(g, innerW / 2, top + rows.length * (rowH + rowGap) - 18, "layer", { "text-anchor": "middle", "font-size": 11.5, fill: css("--muted") });
      // hover crosshair
      const cross = el("line", { y1: top - 6, y2: top + rows.length * (rowH + rowGap) - rowGap + 6, stroke: css("--ink"), "stroke-width": 1, opacity: 0 }, g);
      const hit = el("rect", { class: "hit", x: 0, y: top - 6, width: innerW, height: rows.length * (rowH + rowGap) }, g);
      hit.addEventListener("mousemove", (e) => {
        const bb = hit.getBoundingClientRect(), l = Math.round(((e.clientX - bb.left) / bb.width) * (L - 1));
        cross.setAttribute("x1", x(l)); cross.setAttribute("x2", x(l)); cross.setAttribute("opacity", 0.35);
        const v = (a) => (a && a[l] != null ? a[l] : null);
        tip.innerHTML = `<b>${p.title}, layer ${l}</b><br>refusal removed by ablation ${v(p.ablation) == null ? "–" : Math.round(100 * v(p.ablation)) + "%"}` +
          `<br>AUROC English ${v(p.auroc_en) == null ? "–" : v(p.auroc_en).toFixed(2)} · Hindi ${v(p.auroc_hi) == null ? "–" : v(p.auroc_hi).toFixed(2)}` +
          (v(p.ratio) != null ? `<br>harmful Hindi / English projection ${Math.round(100 * v(p.ratio))}%` : "");
        tip.style.opacity = 1; tip.style.left = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8) + "px"; tip.style.top = e.clientY + 14 + "px";
      });
      hit.addEventListener("mouseleave", () => { cross.setAttribute("opacity", 0); tip.style.opacity = 0; });
    });
    if (!tip) { tip = document.createElement("div"); tip.className = "tip"; document.body.appendChild(tip); }
  }

  /* Gate distribution: every prompt's gate score as a dot, threshold line with a draggable slider that updates the open shares. */
  function gate(container, panels, opts = {}) {
    const narrow = container.clientWidth < 720;
    const W = narrow ? Math.max(320, container.clientWidth) : 920, gap = 40, labelW = 112, padR = 64, top = 70, rowH = 44;
    const colW = narrow ? W : (W - gap) / 2, innerW = colW - labelW - padR;
    const order = [["harmless_en", "Harmless · EN"], ["harmless_hi", "Harmless · HI"], ["harmful_en", "Harmful · EN"], ["harmful_hi", "Harmful · HI"]];
    const panelH = top + order.length * rowH + 30, H = narrow ? panelH * panels.length : panelH;
    const s = svg(container, W, H);
    const controls = [];
    panels.forEach((p, pi) => {
      const g = el("g", { transform: narrow ? `translate(${labelW},${pi * panelH})` : `translate(${pi * (colW + gap) + labelW},0)` }, s);
      const all = order.flatMap(([k]) => p.cells[k].scores);
      const lo = Math.floor(Math.min(...all)), hi = Math.ceil(Math.max(...all)), x = scale(lo, hi, 0, innerW);
      text(g, -labelW, 18, p.title, { "font-weight": 650, "font-size": 15 });
      text(g, -labelW, 36, p.subtitle, { class: "num", "font-size": 11 });
      const step = hi - lo > 12 ? 4 : hi - lo > 6 ? 2 : 1, ticks = [];
      for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t);
      xgrid(g, x, ticks, top - 4, top + order.length * rowH - 6, (t) => fmt(t, 0));
      const opens = [];
      let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      order.forEach(([k, name], i) => {
        const y = top + 20 + i * rowH, c = k.endsWith("hi") ? css("--accent") : css("--ink-2");
        text(g, -12, y + 4, name, { "text-anchor": "end", "font-size": 12.5, "font-weight": 600 });
        p.cells[k].scores.forEach((v) => el("circle", { cx: x(v), cy: y + (rnd() - 0.5) * 22, r: 2.1, fill: c, opacity: 0.5 }, g));
        opens.push([k, text(g, innerW + 10, y + 4, "", { class: "num", "font-weight": 600, fill: css("--ink") })]);
      });
      const line = el("line", { y1: top - 4, y2: top + order.length * rowH - 6, stroke: css("--c-comply"), "stroke-width": 2 }, g);
      const lab = text(g, 0, top + order.length * rowH + 12, "", { "text-anchor": "middle", "font-size": 11.5, fill: css("--t-comply"), "font-weight": 600 });
      const update = (tau) => {
        line.setAttribute("x1", x(tau)); line.setAttribute("x2", x(tau)); lab.setAttribute("x", x(tau));
        lab.textContent = `gate threshold ${fmt(tau, 2)}` + (Math.abs(tau - p.tau) < 1e-6 ? " (as run)" : "");
        opens.forEach(([k, t]) => { const v = p.cells[k].scores; t.textContent = Math.round((100 * v.filter((z) => z > tau).length) / v.length) + "% open"; });
      };
      update(p.tau);
      controls.push({ p, lo, hi, update });
    });
    if (opts.controls) {
      opts.controls.innerHTML = "";
      controls.forEach(({ p, lo, hi, update }) => {
        const wrap = document.createElement("label"); wrap.className = "slider";
        wrap.innerHTML = `<span>${p.title} threshold</span>`;
        const inp = document.createElement("input"); inp.type = "range"; inp.min = lo; inp.max = hi; inp.step = (hi - lo) / 200; inp.value = p.tau;
        const reset = document.createElement("button"); reset.type = "button"; reset.textContent = "reset";
        inp.addEventListener("input", () => update(+inp.value)); reset.addEventListener("click", () => { inp.value = p.tau; update(p.tau); });
        wrap.appendChild(inp); wrap.appendChild(reset); opts.controls.appendChild(wrap);
      });
    }
  }

  /* Mechanism diagram: residual stream with the gate read-out and the push, one row per model. */
  function mechanism(container, specs) {
    const narrow = container.clientWidth < 720;
    const W = narrow ? Math.max(320, container.clientWidth) : 920, rowH = narrow ? 200 : 150, top = 18;
    const H = top + specs.length * rowH;
    const s = svg(container, W, H);
    specs.forEach((m, mi) => {
      const g = el("g", { transform: `translate(0,${top + mi * rowH})` }, s);
      const x0 = narrow ? 8 : 150, x1 = W - 18, yS = narrow ? 104 : 74, L = m.layers, x = scale(0, L, x0, x1);
      text(g, narrow ? 8 : 0, narrow ? 12 : yS + 4, m.title, { "font-weight": 650, "font-size": 15 });
      // residual stream
      el("line", { x1: x0, x2: x1, y1: yS, y2: yS, stroke: css("--axis"), "stroke-width": 6, "stroke-linecap": "round" }, g);
      for (let l = 0; l < L; l++) el("rect", { x: x(l) + 1, y: yS - 9, width: Math.max(2, x(l + 1) - x(l) - 2), height: 18, rx: 2, fill: "#fff", stroke: css("--rule") }, g);
      text(g, x0, yS + 30, "prompt →", { "font-size": 11.5, fill: css("--muted") });
      text(g, x1, yS + 30, "→ reply", { "font-size": 11.5, fill: css("--muted"), "text-anchor": "end" });
      // gate read-out (callout boxes clamped inside the row)
      const xg = (x(m.gate) + x(m.gate + 1)) / 2, xp = (x(m.push) + x(m.push + 1)) / 2;
      const gW = 210, pW = 250, clamp = (c, w) => Math.min(Math.max(c, x0 + w / 2), x1 - w / 2);
      const cg = clamp(xg, gW), cp = clamp(xp, pW);
      el("rect", { x: x(m.gate) + 1, y: yS - 9, width: Math.max(2, x(m.gate + 1) - x(m.gate) - 2), height: 18, rx: 2, fill: css("--tint"), stroke: css("--accent") }, g);
      el("path", { d: `M${xg},${yS - 10} L${xg},${yS - 40}`, stroke: css("--accent"), "stroke-width": 1.6, fill: "none" }, g);
      el("rect", { x: cg - gW / 2, y: yS - 72, width: gW, height: 32, rx: 8, fill: "#fff", stroke: css("--accent") }, g);
      text(g, cg, yS - 59, "read: score on refusal direction", { "text-anchor": "middle", "font-size": 11, fill: css("--t-explicit"), "font-weight": 600 });
      text(g, cg, yS - 46, `layer ${m.gate} · open if > ${m.tau}`, { "text-anchor": "middle", class: "num", "font-size": 10.5 });
      // push
      el("rect", { x: x(m.push) + 1, y: yS - 9, width: Math.max(2, x(m.push + 1) - x(m.push) - 2), height: 18, rx: 2, fill: "#fbf0e8", stroke: css("--c-comply") }, g);
      el("path", { d: `M${xp},${yS + 44} L${xp},${yS + 14}`, stroke: css("--c-comply"), "stroke-width": 1.8, fill: "none" }, g);
      el("path", { d: `M${xp - 5},${yS + 18} L${xp},${yS + 10} L${xp + 5},${yS + 18} Z`, fill: css("--c-comply") }, g);
      el("rect", { x: cp - pW / 2, y: yS + 44, width: pW, height: 32, rx: 8, fill: "#fff", stroke: css("--c-comply") }, g);
      text(g, cp, yS + 57, `add: ${m.what}`, { "text-anchor": "middle", "font-size": 11, fill: css("--t-comply"), "font-weight": 600 });
      text(g, cp, yS + 70, `at layer ${m.push} input, every position`, { "text-anchor": "middle", class: "num", "font-size": 10.5 });
    });
  }

  /* Dose-response: each candidate setting by Hindi explicit gain (x) and broken-output change (y), with guard lines. */
  function dose(container, panels) {
    const narrow = container.clientWidth < 720;
    const W = narrow ? Math.max(320, container.clientWidth) : 920, gap = 46, padL = 46, padR = 16, top = 72, h = 250;
    const colW = narrow ? W : (W - gap) / 2, innerW = colW - padL - padR;
    const panelH = top + h + 46, H = narrow ? panelH * panels.length : panelH;
    const s = svg(container, W, H);
    panels.forEach((p, pi) => {
      const g = el("g", { transform: narrow ? `translate(${padL},${pi * panelH})` : `translate(${pi * (colW + gap) + padL},0)` }, s);
      const xs = p.points.map((q) => q.explicit), ys = p.points.map((q) => q.broken);
      const xlo = Math.min(-10, Math.floor(Math.min(...xs) / 10) * 10), xhi = Math.max(50, Math.ceil(Math.max(...xs) / 10) * 10);
      const ylo = Math.min(-2, Math.floor(Math.min(...ys))), yhi = Math.max(10, Math.ceil(Math.max(...ys) / 5) * 5);
      const x = scale(xlo, xhi, 0, innerW), y = scale(ylo, yhi, top + h, top);
      text(g, -padL, 18, p.title, { "font-weight": 650, "font-size": 15 });
      text(g, -padL, 36, p.subtitle, { class: "num", "font-size": 11 });
      const grid = el("g", { class: "grid" }, g), tk = el("g", { class: "tick" }, g);
      for (let t = xlo; t <= xhi; t += 10) { el("line", { x1: x(t), x2: x(t), y1: top, y2: top + h }, grid); text(tk, x(t), top + h + 15, (t > 0 ? "+" : t < 0 ? "−" : "") + Math.abs(t), { "text-anchor": "middle" }); }
      for (let t = Math.ceil(ylo / 5) * 5; t <= yhi; t += 5) { el("line", { x1: 0, x2: innerW, y1: y(t), y2: y(t) }, grid); text(tk, -6, y(t) + 4, (t > 0 ? "+" : t < 0 ? "−" : "") + Math.abs(t), { "text-anchor": "end" }); }
      // guard region: broken <= limit, gain >= bar
      const gx = p.guards.gain != null ? x(p.guards.gain) : x(0);
      el("rect", { x: gx, y: y(p.guards.broken), width: innerW - gx, height: y(ylo) - y(p.guards.broken), fill: css("--tint"), opacity: 0.8 }, g);
      el("line", { x1: 0, x2: innerW, y1: y(p.guards.broken), y2: y(p.guards.broken), stroke: css("--c-comply"), "stroke-width": 1.4, "stroke-dasharray": "4 3" }, g);
      text(g, innerW - 4, y(p.guards.broken) - 6, `broken-output guard (+${p.guards.broken})`, { "text-anchor": "end", "font-size": 11, fill: css("--t-comply") });
      if (p.guards.gain != null) {
        el("line", { x1: gx, x2: gx, y1: top, y2: top + h, stroke: css("--accent"), "stroke-width": 1.4, "stroke-dasharray": "4 3" }, g);
        text(g, gx + 4, top + 12, `selection bar (+${p.guards.gain})`, { "font-size": 11, fill: css("--t-explicit") });
      }
      text(g, innerW / 2, top + h + 34, "Hindi explicit refusal, change (pts)", { "text-anchor": "middle", "font-size": 11.5, fill: css("--muted") });
      text(g, -padL + 2, top - 10, "broken replies, change (pts)", { "font-size": 11.5, fill: css("--muted") });
      // direct labels: chosen first, then others only where they do not collide with a placed label
      const placed = [];
      const order = p.points.map((q, i) => i).sort((a, b) => (p.points[b].chosen ? 1 : 0) - (p.points[a].chosen ? 1 : 0));
      const labelOK = new Set();
      order.forEach((i) => {
        const q = p.points[i], lx = x(q.explicit), ly = y(q.broken) - 9;
        const clash = placed.some(([px, py]) => Math.abs(px - lx) < 120 && Math.abs(py - ly) < 16);
        if (q.chosen || (!clash && p.points.length <= 5)) { labelOK.add(i); placed.push([lx, ly]); }
      });
      p.points.forEach((q, qi) => {
        const c = q.qualifies ? css("--accent") : css("--c-broken");
        const dot = el("circle", { cx: x(q.explicit), cy: y(q.broken), r: q.chosen ? 8 : 5.5, fill: q.chosen ? c : "#fff", stroke: c, "stroke-width": 2 }, g);
        if (labelOK.has(qi)) text(g, x(q.explicit) + (q.explicit > xhi - 15 ? -10 : 10), y(q.broken) - 9, q.label + (q.chosen ? " · chosen" : ""),
          { "font-size": 11, "font-weight": q.chosen ? 650 : 400, fill: css("--ink-2"), "text-anchor": q.explicit > xhi - 15 ? "end" : "start" });
        tooltip(dot, `<b>${p.title}: ${q.label}</b><br>Hindi explicit ${sgn(q.explicit)} pts<br>broken ${sgn(q.broken)} pts<br>harmless refusal ${sgn(q.harmless)} pts` +
          (q.gate_harmful != null ? `<br>gate open on ${Math.round(100 * q.gate_harmful)}% harmful, ${Math.round(100 * q.gate_harmless)}% harmless` : "") +
          `<br>${q.qualifies ? "qualifies" : "does not qualify"}${q.chosen ? " · <b>chosen</b>" : ""}`);
      });
    });
  }

  // responsive: redraw every chart when the viewport crosses widths (debounced)
  const registry = [];
  function responsive(fn) {
    return (container, data, opts = {}) => {
      const draw = () => { container.innerHTML = ""; if (opts.table) opts.table.innerHTML = ""; fn(container, data, opts); };
      registry.push(draw); draw();
    };
  }
  let lastW = window.innerWidth, timer;
  window.addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(() => {
    if (Math.abs(window.innerWidth - lastW) > 40) { lastW = window.innerWidth; registry.forEach((d) => d()); } }, 150); });
  window.Charts = { pairedShift: responsive(pairedShift), repairs: responsive(repairs), projections: responsive(projections),
    layerProfile: responsive(layerProfile), gate: responsive(gate), mechanism: responsive(mechanism), dose: responsive(dose) };
  window.Charts.redraw = () => registry.forEach((d) => d());
})();
