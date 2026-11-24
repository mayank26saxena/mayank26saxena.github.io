// Figures for the blog post draft. Data: window.FIGURES (scripts/42_build_post.py). Charts draw at the container's width and
// redraw on resize; every mark has a native tooltip with its exact value.
(function () {
  "use strict";
  const F = window.FIGURES, NS = "http://www.w3.org/2000/svg";
  const pc = (x, d = 0) => (100 * x).toFixed(d) + "%";
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  function svg(el, w, h) {
    el.innerHTML = "";
    const s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", `0 0 ${w} ${h}`); s.setAttribute("width", w); s.setAttribute("height", h);
    el.appendChild(s);
    const add = (tag, at, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(at)) e.setAttribute(k, v); if (text != null) e.textContent = text; s.appendChild(e); return e; };
    const tip = (e, t) => { const ti = document.createElementNS(NS, "title"); ti.textContent = t; e.appendChild(ti); return e; };
    return { s, add, tip };
  }
  const W = (el) => Math.max(280, el.clientWidth);

  function axisY(g, x0, x1, y, lo, hi, ticks, fmt) {
    ticks.forEach((t) => { const yy = y(t); g.add("line", { x1: x0, x2: x1, y1: yy, y2: yy, stroke: css("--rule") }); g.add("text", { x: x0 - 6, y: yy + 3.5, "text-anchor": "end", class: "num" }, fmt(t)); });
  }

  // Figure 1: readout accuracy by read point
  function board(el) {
    const d = F.board, w = W(el), h = 230, m = { l: 44, r: 12, t: 10, b: 46 }, g = svg(el, w, h);
    const n = d.points.length, x = (i) => m.l + (i / (n - 1)) * (w - m.l - m.r), y = (v) => m.t + (1 - (v - 0.3) / 0.7) * (h - m.t - m.b);
    axisY(g, m.l, w - m.r, y, 0.3, 1, [0.4, 0.6, 0.8, 1.0], (t) => pc(t));
    g.add("line", { x1: m.l, x2: w - m.r, y1: y(d.ply), y2: y(d.ply), stroke: css("--muted"), "stroke-dasharray": "4 4" });
    const short = (p) => p.replace(" attn", "·a").replace("embed", "emb");
    d.points.forEach((p, i) => { if (w > 520 || i % 2 === 0) g.add("text", { x: x(i), y: h - m.b + 16, "text-anchor": "middle", class: "num" }, short(p)); });
    g.add("text", { x: (m.l + w - m.r) / 2, y: h - 8, "text-anchor": "middle", class: "num" }, "read point (·a = after the layer's attention)");
    [["abs", css("--c-broken")], ["rel", css("--me")]].forEach(([k, col]) => {
      g.add("polyline", { points: d[k].map((v, i) => `${x(i)},${y(v)}`).join(" "), fill: "none", stroke: col, "stroke-width": 2.2 });
      d[k].forEach((v, i) => g.tip(g.add("circle", { cx: x(i), cy: y(v), r: 3.5, fill: col }), `${d.points[i]}: ${k === "rel" ? "mine/theirs" : "red/yellow"} ${pc(v, 1)}`));
    });
  }

  // Figure 3: neurons vs directions, per orientation
  function curves(el) {
    const keys = ["vertical", "horizontal", "diagonal"], w = W(el), stack = w < 640, pw = stack ? w : (w - 24) / 3, ph = 190;
    const g = svg(el, w, stack ? ph * 3 + 30 : ph + 10);
    keys.forEach((k, j) => {
      const d = F.curves[k], ox = stack ? 0 : j * (pw + 12), oy = stack ? j * (ph + 10) : 0, m = { l: 40, r: 14, t: 22, b: 34 };
      const lx = (v) => ox + m.l + (Math.log10(v) / Math.log10(5120)) * (pw - m.l - m.r), y = (v) => oy + m.t + (1 - v) * (ph - m.t - m.b);
      g.add("text", { x: ox + m.l, y: oy + 12, "font-weight": 600, "font-size": 12.5 }, k);
      axisY(g, ox + m.l, ox + pw - m.r, y, 0, 1, [0, 0.5, 1], (t) => pc(t));
      [1, 10, 100, 1000].forEach((t) => g.add("text", { x: lx(t), y: oy + ph - m.b + 14, "text-anchor": "middle", class: "num" }, t));
      g.add("text", { x: ox + (m.l + pw - m.r) / 2, y: oy + ph - 4, "text-anchor": "middle", class: "num" }, "k units");
      g.add("line", { x1: ox + m.l, x2: ox + pw - m.r, y1: y(d.target), y2: y(d.target), stroke: css("--muted"), "stroke-dasharray": "4 4" });
      [["neurons", css("--ink-2")], ["dirs", css("--me")]].forEach(([s, col]) => {
        const pts = d[s].filter(([kk]) => kk >= 1);
        g.add("polyline", { points: pts.map(([kk, e]) => `${lx(kk)},${y(Math.max(0, Math.min(1, e)))}`).join(" "), fill: "none", stroke: col, "stroke-width": 2.2 });
        const [kk, e] = pts[pts.length - 1];
        g.tip(g.add("circle", { cx: lx(kk), cy: y(e), r: 4.5, fill: col }), `${k}: ${kk} ${s === "dirs" ? "directions" : "neurons"} remove ${pc(e)}`);
        g.add("text", { x: lx(kk) + (s === "dirs" ? 6 : -6), y: y(e) + (s === "dirs" ? -8 : 16), "text-anchor": s === "dirs" ? "start" : "end", class: "num", fill: col }, `${kk.toLocaleString()}`);
      });
    });
  }

  // Figure 4: switches, dumbbells
  function switches(el) {
    const A = F.switch.acc, rows = [["vertical", "vertical blocks"], ["horizontal", "horizontal blocks"], ["diagonal", "diagonal blocks"], ["control", "other play"]];
    const groups = [["head", "head L0·H2 off"], ["directions", "15 directions off"], ["readout", "column alarms off"]];
    const w = W(el), m = { l: 118, r: 46, t: 8 }, rh = 19, gh = 22, h = m.t + groups.length * (gh + rows.length * rh) + 26, g = svg(el, w, h);
    const x = (v) => m.l + ((v - 0.5) / 0.5) * (w - m.l - m.r);
    [0.5, 0.75, 1].forEach((t) => { g.add("line", { x1: x(t), x2: x(t), y1: m.t, y2: h - 22, stroke: css("--rule") }); g.add("text", { x: x(t), y: h - 8, "text-anchor": "middle", class: "num" }, pc(t)); });
    let yy = m.t;
    groups.forEach(([gk, gl]) => {
      g.add("text", { x: 0, y: yy + 14, "font-size": 11, "font-weight": 600, "letter-spacing": ".06em", fill: css("--muted") }, gl.toUpperCase());
      yy += gh;
      rows.forEach(([rk, rl]) => {
        const a0 = A.none[rk], a1 = A[gk][rk], cy = yy + rh / 2;
        g.add("text", { x: m.l - 10, y: cy + 4, "text-anchor": "end", "font-size": 12 }, rl);
        g.add("line", { x1: x(a1), x2: x(a0), y1: cy, y2: cy, stroke: css("--me"), "stroke-width": 2 });
        g.add("circle", { cx: x(a0), cy, r: 5, fill: css("--card"), stroke: css("--ink-2"), "stroke-width": 1.6 });
        g.tip(g.add("circle", { cx: x(a1), cy, r: 4.5, fill: css("--me") }), `${gl}, ${rl}: ${pc(a0, 1)} → ${pc(a1, 1)}`);
        g.add("text", { x: x(Math.max(a0, a1)) + 9, y: cy + 4, class: "num" }, `−${Math.round(100 * (a0 - a1))}`);
        yy += rh;
      });
    });
  }

  // Figure 6: ladder scatter
  function ladder(el) {
    const d = F.ladder, w = W(el), h = 240, m = { l: 44, r: 14, t: 10, b: 38 }, g = svg(el, w, h);
    const x = (v) => m.l + ((v - 0.6) / 0.4) * (w - m.l - m.r), y = (v) => m.t + (1 - (v + 0.05) / 0.5) * (h - m.t - m.b);
    axisY(g, m.l, w - m.r, y, 0, 0.45, [0, 0.2, 0.4], (t) => t.toFixed(1));
    [0.6, 0.7, 0.8, 0.9, 1].forEach((t) => g.add("text", { x: x(t), y: h - m.b + 14, "text-anchor": "middle", class: "num" }, pc(t)));
    g.add("text", { x: (m.l + w - m.r) / 2, y: h - 6, "text-anchor": "middle", class: "num" }, w < 480 ? "board readability →" : "board readability (stone colour accuracy) →");
    g.add("text", { x: m.l + 4, y: m.t + 4, class: "num" }, "↑ edit specificity");
    d.forEach((p) => { const main = p.size.startsWith("L6d256"); g.tip(g.add("circle", { cx: x(p.colour), cy: y(p.spec), r: main ? 5 : 3.5, fill: main ? css("--me") : css("--c-broken"), "fill-opacity": main ? 1 : 0.75 }),
      `${p.size.replace(/^L(\d)d(\d+).*/, "$1 × $2")}: board ${pc(p.colour, 1)}, specificity ${p.spec.toFixed(2)}`); });
  }

  // Figure 7: concept coverage
  function coverage(el) {
    const d = F.coverage, rows = [["neuron", "single neuron"], ["rotation", "random direction"], ["probe", "trained readout"]];
    const w = W(el), m = { l: 118, r: 40, t: 6 }, rh = 30, h = m.t + rows.length * rh + 24, g = svg(el, w, h), x = (v) => m.l + v * (w - m.l - m.r);
    [0, 0.25, 0.5].forEach((t) => { g.add("line", { x1: x(t), x2: x(t), y1: m.t, y2: h - 20, stroke: css("--rule") }); g.add("text", { x: x(t), y: h - 6, "text-anchor": "middle", class: "num" }, pc(t)); });
    rows.forEach(([k, l], i) => {
      const cy = m.t + i * rh + rh / 2, v = d[k];
      g.add("text", { x: m.l - 10, y: cy + 4, "text-anchor": "end", "font-size": 12 }, l);
      g.tip(g.add("rect", { x: x(0), y: cy - 8, width: x(v.share) - x(0), height: 16, fill: k === "neuron" ? css("--me") : css("--c-broken"), rx: 2 }), `${l}: ${pc(v.share, 1)} (${pc(v.ci[0], 1)}–${pc(v.ci[1], 1)})`);
      g.add("line", { x1: x(v.ci[0]), x2: x(v.ci[1]), y1: cy, y2: cy, stroke: css("--ink"), "stroke-width": 1.5, "stroke-opacity": 0.55 });
      g.add("text", { x: x(v.ci[1]) + 6, y: cy + 4, class: "num" }, pc(v.share));
    });
  }

  // Figure 2: the vertical-block circuit as four steps, with each step's share of the push and blocks with it switched off
  function circuit(el) {
    const d = F.circuit, w = W(el), narrow = w < 600;
    const steps = [
      { k: "head", n: "1", t: "Your recent moves", s: "attention head 2, layer 0", v: `${pc(d.att_opp)} of attention on the last mover's moves`, e: `carries ${pc(d.head_eff)} of the push alone` },
      { k: "directions", n: "2", t: `${d.d80} directions`, s: "layers 1–4, many neurons each", v: "the threat, as patterns across neurons", e: `carry ${pc(d.dirs_eff)} of the push` },
      { k: "readout", n: "3", t: `${d.n_alarm} column alarms`, s: "single neurons in layer 5", v: `${pc(d.alarm_share)} push towards their own column`, e: `carry ${pc(d.alarm_eff)} of the push` },
      { k: "none", n: "4", t: "The block", s: "the model's move", v: "plays on top of the three", e: "" },
    ];
    const bh = narrow ? 96 : 66, gap = 22, h = steps.length * (bh + gap) - gap + 2, g = svg(el, w, h), rx = w - 14, mx = narrow ? 36 : Math.round(w * 0.40);
    steps.forEach((st, i) => {
      const y0 = i * (bh + gap) + 1, last = st.k === "none", acc = d.acc[st.k];
      g.add("rect", { x: 1, y: y0, width: w - 2, height: bh, rx: 4, fill: last ? "#eef3fa" : css("--card"), stroke: last ? css("--me") : css("--rule"), "stroke-width": last ? 1.5 : 1 });
      g.add("circle", { cx: 18, cy: y0 + 22, r: 9, fill: css("--ink") });
      g.add("text", { x: 18, y: y0 + 26, "text-anchor": "middle", style: "fill:#fff", "font-size": 11, "font-weight": 600 }, st.n);
      g.add("text", { x: 36, y: y0 + 26, "font-size": 14, "font-weight": 600 }, st.t);
      g.add("text", { x: 36, y: y0 + 44, class: "num" }, st.s);
      g.add("text", { x: mx, y: narrow ? y0 + 66 : y0 + 26, "font-size": 12.5, style: `fill:${css("--ink-2")}` }, st.v);
      if (st.e) g.add("text", { x: mx, y: narrow ? y0 + 84 : y0 + 44, "font-size": 12, style: `fill:${css("--muted")}` }, st.e);
      const col = last ? css("--me") : css("--bad");
      g.add("text", { x: rx, y: y0 + 22, "text-anchor": "end", "font-size": 10.5, style: `fill:${css("--muted")}` }, last ? "intact" : "switched off");
      g.tip(g.add("text", { x: rx, y: y0 + 46, "text-anchor": "end", "font-size": 22, "font-weight": 700, style: `fill:${col};font-family:Space Grotesk,sans-serif` }, pc(acc)),
        last ? `intact model: ${pc(acc, 1)} of vertical threats blocked` : `${st.t} switched off: ${pc(acc, 1)} blocked (intact ${pc(d.acc.none, 1)})`);
      if (i < steps.length - 1) { const ax = 18, ay = y0 + bh + 3; g.add("path", { d: `M${ax},${ay} L${ax},${ay + gap - 6} M${ax - 5},${ay + gap - 12} L${ax},${ay + gap - 6} L${ax + 5},${ay + gap - 12}`, stroke: css("--ink-2"), fill: "none", "stroke-width": 1.6 }); }
    });
  }

  // Figure 5: Test B, a strip of tactic agreement per unit, one row per group, with the registered bar
  const clipT = (s, n = 150) => (s.length > n ? s.slice(0, s.lastIndexOf(" ", n - 2)) + " …" : s);
  function testb(el) {
    const d = F.testB, rows = [["circuit", "circuit neurons", css("--me")], ["decoy", "look-alike decoys", css("--op")], ["random", "random directions", "#8a9194"]];
    const w = W(el), narrow = w < 520, m = { l: narrow ? 8 : 128, r: 64, t: 8 }, rh = narrow ? 62 : 48, h = m.t + rows.length * rh + 30, g = svg(el, w, h);
    const x = (v) => m.l + v * (w - m.l - m.r);
    [0, 0.25, 0.5, 0.75, 1].forEach((t) => { g.add("line", { x1: x(t), x2: x(t), y1: m.t, y2: h - 24, stroke: css("--rule") }); g.add("text", { x: x(t), y: h - 10, "text-anchor": "middle", class: "num" }, t.toFixed(2)); });
    g.add("line", { x1: x(0.5), x2: x(0.5), y1: m.t, y2: h - 24, stroke: css("--ink-2"), "stroke-dasharray": "4 3", "stroke-width": 1.4 });
    rows.forEach(([k, lbl, col], i) => {
      const y0 = m.t + i * rh, us = d.filter((r) => r.g === k), cy = y0 + (narrow ? rh * 0.62 : rh / 2);
      g.add("text", narrow ? { x: m.l, y: y0 + 13, "font-size": 11.5, "font-weight": 600 } : { x: m.l - 12, y: cy + 4, "text-anchor": "end", "font-size": 12 }, lbl);
      us.forEach((r, j) => {
        const jy = cy + ((j * 7) % 5 - 2) * (narrow ? 3.4 : 4.2);
        const where = r.n == null ? `L${r.l} random direction` : `L${r.l} N${r.n}${r.pole}`;
        g.tip(g.add("circle", { cx: x(r.ta), cy: jy, r: 5, fill: col, "fill-opacity": 0.85, stroke: css("--card"), "stroke-width": 1 }),
          `${where}: agreement ${r.ta.toFixed(2)} (${r.c === "block_now_any" ? "block in any column" : "block in column " + r.c.slice(-1)}), own-firing F1 ${r.f1.toFixed(2)}, confidence ${r.conf}${r.rb ? ", broke a rule" : ""}\n“${clipT(r.text)}”`);
      });
      const k5 = us.filter((r) => r.ta >= 0.5).length;
      g.add("text", { x: w - m.r + 10, y: cy + 4, class: "num", "font-weight": 600 }, `${k5} of ${us.length}`);
    });
    g.add("text", { x: x(0.5) + 5, y: m.t + 10, class: "num", fill: css("--ink-2") }, "bar");
  }

  const draws = [["#fig-board .chart", board], ["#fig-curves .chart", curves], ["#fig-circuit .chart", circuit], ["#fig-switch .chart", switches], ["#fig-testb .chart", testb], ["#fig-ladder .chart", ladder], ["#fig-coverage .chart", coverage]];
  function drawAll() { draws.forEach(([s, f]) => { const el = document.querySelector(s); if (el && el.offsetParent !== null) f(el); }); }
  drawAll();
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(drawAll, 120); });

  // descriptions the agent wrote for vertical-circuit neurons (Test A)
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const tb = document.getElementById("described");
  if (tb) tb.innerHTML = `<thead><tr><th>Neuron</th><th>Rank in circuit</th><th>The agent's description, written blind</th><th>Score</th></tr></thead><tbody>` +
    F.described.map((r) => `<tr><td class="n">L${r.layer} N${r.neuron}${r.pole}</td><td class="n">${r.rank}</td><td>${esc(r.text)}</td><td class="n">${r.f1.toFixed(2)}</td></tr>`).join("") + "</tbody>";
  // Appendix I: every Test B unit, unblinded
  const tt = document.getElementById("testb-table");
  const G = { circuit: "circuit", decoy: "decoy", random: "random" };
  if (tt) tt.innerHTML = `<thead><tr><th>Unit</th><th>Group</th><th>The agent's description, written blind</th><th>Block agreement</th><th>Own F1</th><th>Text check</th></tr></thead><tbody>` +
    [...F.testB].sort((a, b) => ["circuit", "decoy", "random"].indexOf(a.g) - ["circuit", "decoy", "random"].indexOf(b.g) || b.ta - a.ta).map((r) =>
      `<tr><td class="n">${r.n == null ? `L${r.l} dir.` : `L${r.l} N${r.n}${r.pole}`}${r.rb ? " *" : ""}</td><td>${G[r.g]}</td><td>${esc(r.text)}</td><td class="n">${r.ta.toFixed(2)}</td><td class="n">${r.f1.toFixed(2)}</td><td class="n">${r.txt ? "yes" : "no"}</td></tr>`).join("") +
    `</tbody><caption>* broke the rule against counting a candidate rule locally (kept, as the protocol requires).</caption>`;
  // main text: the three most important described neurons, one clause each
  const clip = (s) => { let t = s.split(/(?<=\.)\s(?=[A-Z])/)[0]; const cut = t.search(/ \(|;|, i\.e\.|:/); if (cut > 40) t = t.slice(0, cut); if (t.length > 110) t = t.slice(0, t.lastIndexOf(" ", 106)) + " …"; return t.replace(/\.$/, ""); };
  const ts = document.getElementById("described-short");
  if (ts) ts.innerHTML = `<thead><tr><th>Neuron</th><th>What the agent wrote</th></tr></thead><tbody>` +
    F.described.slice(0, 3).map((r) => `<tr><td class="n">L${r.layer} N${r.neuron} · #${r.rank}</td><td>“${esc(clip(r.text))}”</td></tr>`).join("") + "</tbody>";

  // contents rail and appendices (as in the house template)
  (function rail() {
    const hs = [...document.querySelectorAll("#story h2[id], main h2[id]")]; if (!hs.length) return;
    const nav = document.createElement("nav"); nav.className = "rail"; nav.innerHTML = "<p>Contents</p>";
    const links = hs.map((h) => { const a = document.createElement("a"); a.href = "#" + h.id; const no = h.querySelector(".no");
      a.innerHTML = (no ? `<span>${no.textContent}</span>` : "") + h.textContent.replace(no ? no.textContent : "", "").trim(); nav.appendChild(a); return a; });
    document.body.appendChild(nav);
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "rail-toggle"; btn.textContent = "Contents";
    btn.onclick = () => nav.classList.toggle("open"); document.body.appendChild(btn);
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) nav.classList.remove("open"); });
    const update = () => { document.body.classList.toggle("scrolled", scrollY > 160); const ft = document.querySelector("footer"); document.body.classList.toggle("at-end", !!ft && ft.getBoundingClientRect().top < innerHeight - 40);
      let cur = -1; hs.forEach((h, i) => { if (h.getBoundingClientRect().top < innerHeight * 0.35) cur = i; }); links.forEach((a, i) => a.classList.toggle("on", i === cur)); };
    addEventListener("scroll", update, { passive: true }); addEventListener("resize", update); update();

    // the demo card is wider than the text column: hide the contents list while it is on screen
    const dc = document.querySelector(".demo-card");
    if (dc) new IntersectionObserver((es) => es.forEach((e) => document.body.classList.toggle("demo-on", e.isIntersecting)), { rootMargin: "0px 0px -10% 0px" }).observe(dc);
  })();
  (function appendices() {
    const open = (hash) => { const d = hash && hash.length > 1 ? document.getElementById(hash.slice(1)) : null; if (d && d.matches("details.appx") && !d.open) d.open = true; };
    document.addEventListener("click", (e) => { const a = e.target.closest('a[href^="#appendix-"]'); if (a) open(a.getAttribute("href")); });
    addEventListener("hashchange", () => open(location.hash)); open(location.hash);
    document.querySelectorAll("details.appx").forEach((d) => d.addEventListener("toggle", () => { if (d.open) drawAll(); }));
  })();
})();
