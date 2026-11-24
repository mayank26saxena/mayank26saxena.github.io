// Scrolling story for the blog post: a pinned stage (live model from ../vertical/vertical.js) and a live map of every neuron
// (data/atlas.js). Each story card sets a position, the switches and which neurons the map highlights.
(function () {
  "use strict";
  const AT = window.ATLAS, N = AT.neurons, L = 6, F = 1024, G = 32;   // a layer is a 32 x 32 block
  const idx = (l, n) => l * F + n;
  const byId = new Map(N.map((x) => [idx(x.l, x.n), x]));
  // position of each neuron inside its layer block, by the per-layer order (concept families form regions)
  const slot = new Int32Array(L * F);
  AT.order.forEach((ord, l) => ord.forEach((n, i) => { slot[idx(l, n)] = i; }));
  const FAM = { block_now: "must block now", win_now: "can win now", my_threat: "my threats", opp_threat: "their threats", poison: "poisoned columns",
    line: "lines of four", land: "landing cells", cell: "single cells", full: "full columns", last: "the last move", ply: "game phase", eval: "who is winning",
    other: "other", none: "no clear concept" };
  const HL = {
    none: () => true,
    board: (x) => x.fam === "cell" || x.fam === "land",
    v: (x) => x.v,
    vup: (x) => x.v && x.l < 5,
    a: (x) => x.a !== null && x.a !== undefined,
    d: (x) => !!x.d,
  };
  const MODE = { none: "", board: "highlighted: cells and landing spots", v: "highlighted: the vertical-block circuit", vup: "highlighted: circuit neurons in layers 0–4",
    a: "highlighted: the column alarms", d: "highlighted: neurons the agent described (circuit ones ringed)" };
  const STEPS = {
    play: { hl: "none", moves: [3, 0, 3, 6], sw: [] },
    board: { hl: "board", sw: [] },
    threat: { hl: "v", moves: [3, 0, 3, 6, 3], sw: [] },
    head: { hl: "none", moves: [3, 0, 3, 6, 3], sw: [], focus: "st-head" },
    dirs: { hl: "vup", moves: [3, 0, 3, 6, 3], sw: [], focus: "st-dirs" },
    alarms: { hl: "a", moves: [3, 0, 3, 6, 3], sw: [], focus: "st-alarm" },
    switch: { hl: "a", moves: [3, 0, 3, 6, 3], sw: ["readout"], focus: "st-move" },
    agent: { hl: "d", moves: [3, 0, 3, 6, 3], sw: [] },
    explore: { hl: "none", sw: [] },
  };
  let hl = "none", acts = null, hover = null, pinned = null;

  // ---------- neuron map
  const cv = document.getElementById("atlas"), card = document.getElementById("ncard"), modeEl = document.getElementById("atlas-mode");
  let geo = null;
  function layout() {
    const w = cv.parentElement.clientWidth, cols = 6, gap = w < 520 ? 5 : 8, lab = 14;  // one strip of six layer blocks
    const cell = Math.max(1, Math.min(4.5, (w - gap * (cols - 1)) / cols / G));
    const bw = cell * G, dpr = window.devicePixelRatio || 1, rows = L / cols, h = rows * (bw + lab) + (rows - 1) * gap;
    cv.width = (bw * cols + gap * (cols - 1)) * dpr; cv.height = h * dpr; cv.style.width = bw * cols + gap * (cols - 1) + "px"; cv.style.height = h + "px";
    geo = { cell, bw, gap, lab, dpr, cols };
  }
  function cellXY(l, n) {
    const { cell, bw, gap, lab, cols } = geo, s = slot[idx(l, n)], bx = (l % cols) * (bw + gap), by = Math.floor(l / cols) * (bw + lab + gap) + lab;
    return [bx + (s % G) * cell, by + Math.floor(s / G) * cell];
  }
  function level(x) {
    if (!acts) return 0;
    const a = acts[x.l][x.n]; let v = 0;
    if (x.tp > 0) v = Math.max(v, a / x.tp);
    if (x.tn < 0) v = Math.max(v, a / x.tn);
    return Math.max(0, Math.min(1, v / 1.5));
  }
  function draw() {
    if (!geo) layout();
    const ctx = cv.getContext("2d"), { cell, bw, gap, lab, dpr, cols } = geo, sel = HL[hl];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.font = "500 10px JetBrains Mono, monospace"; ctx.fillStyle = "#6c7470";
    for (let l = 0; l < L; l++) ctx.fillText(geo.bw > 70 ? `layer ${l}` : `L${l}`, (l % cols) * (bw + gap), Math.floor(l / cols) * (bw + lab + gap) + 10);
    const s = cell > 3 ? cell - 1 : cell;
    for (const x of N) {
      const [px, py] = cellXY(x.l, x.n), on = sel(x), v = level(x);
      let col;
      if (x.a !== null && x.a !== undefined && hl === "a") col = `rgba(201,80,58,${0.3 + 0.7 * v})`;
      else col = v > 0.02 ? `rgba(${Math.round(222 - 30 * v)},${Math.round(150 - 60 * v)},${Math.round(30 - 10 * v)},${0.25 + 0.75 * v})` : "rgba(27,31,29,0.08)";
      ctx.globalAlpha = on ? 1 : 0.22; ctx.fillStyle = col; ctx.fillRect(px, py, s, s);
      if (on && hl !== "none" && v <= 0.02) { ctx.globalAlpha = 0.7; ctx.fillStyle = "#2563b0"; ctx.fillRect(px, py, s, s); }
      if (hl === "d" && x.d && x.v && x.d.pole === x.vp) { ctx.globalAlpha = 1; ctx.strokeStyle = "#1b1f1d"; ctx.lineWidth = 1; ctx.strokeRect(px - 1, py - 1, s + 2, s + 2); }
    }
    ctx.globalAlpha = 1;
    const f = pinned || hover;
    if (f) { const [px, py] = cellXY(f.l, f.n); ctx.strokeStyle = "#1b1f1d"; ctx.lineWidth = 1.5; ctx.strokeRect(px - 2, py - 2, s + 4, s + 4); }
    modeEl.textContent = MODE[hl];
  }
  function at(ev) {
    const r = cv.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, { cell, bw, gap, lab, cols } = geo;
    const l = Math.floor(x / (bw + gap)) + cols * Math.floor(y / (bw + lab + gap)); if (l < 0 || l >= L) return null;
    const bx = (l % cols) * (bw + gap), by = Math.floor(l / cols) * (bw + lab + gap) + lab, cx = Math.floor((x - bx) / cell), cy = Math.floor((y - by) / cell);
    if (cx < 0 || cy < 0 || cx >= G || cy >= G) return null;
    return byId.get(idx(l, AT.order[l][cy * G + cx])) || null;
  }
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  // the concept list numbers columns and rows from 1; this post numbers them from 0 (as on the board and in the agent's descriptions)
  const zb = (t) => t.replace(/\b(column|row) (\d)\b/g, (m, w, d) => `${w} ${+d - 1}`);
  function showCard(x) {
    if (!x) { card.innerHTML = "Hover or tap a neuron. Brighter = firing harder on this board. Each block is one layer; neurons are grouped by the concept they match best."; return; }
    const v = acts ? (() => { const a = acts[x.l][x.n]; return Math.max(x.tp > 0 ? a / x.tp : 0, x.tn < 0 ? a / x.tn : 0); })() : 0;
    const concept = x.c ? `${esc(zb(window.C4Concepts ? C4Concepts.describe(x.c).text : x.c))} <span class="dim">(F1 ${x.f1.toFixed(2)})</span>` : `<span class="dim">no concept matches well (best F1 ${x.f1.toFixed(2)})</span>`;
    const role = [x.v ? "vertical-block circuit" : "", x.a !== null && x.a !== undefined ? `column alarm for column ${x.a}` : "", x.b && !x.v ? "one of the 200 most important blocking neurons" : ""].filter(Boolean).join(" · ");
    card.innerHTML = `<b>Layer ${x.l} · neuron ${x.n}</b> <span class="dim">· ${FAM[x.fam]}</span><br>Best match: ${concept}<br>` +
      `On this board: <b>${v >= 1 ? "firing" : v > 0.3 ? "active" : "quiet"}</b> <span class="dim">(${v.toFixed(1)}× its firing threshold)</span>` +
      (role ? `<br><span class="role">${role}</span>` : "") +
      (x.d ? `<br><span class="dim">The agent wrote, about its ${x.d.pole === "+" ? "positive" : "negative"} side (${x.d.group ? `blind test, ${x.d.group === "circuit" ? "circuit neuron" : "decoy"}, ` : ""}held-out F1 ${x.d.f1.toFixed(2)}):</span> “${esc(x.d.text)}”` : "") +
      `<br><a href="${window.ATLAS_URL || "../neuron-atlas/"}#n/${x.l}/${x.n}/${(x.d ? x.d.pole : x.pole) === "-" ? 1 : 0}" target="_blank" rel="noopener">Open in the neuron atlas →</a>`;
  }
  cv.addEventListener("mousemove", (e) => { hover = at(e); showCard(pinned || hover); draw(); });
  cv.addEventListener("mouseleave", () => { hover = null; showCard(pinned); draw(); });
  cv.addEventListener("click", (e) => { const x = at(e); pinned = x && pinned && x === pinned ? null : x; showCard(pinned); draw(); });
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { layout(); draw(); }, 120); });

  // ---------- live updates from the model
  window.VDemo.on(({ out }) => { acts = out.acts.map((layer) => layer[layer.length - 1]); showCard(pinned || hover); draw(); });

  // ---------- story steps
  let current = null;
  function enter(name) {
    if (name === current) return; current = name;
    const st = STEPS[name]; if (!st) return;
    hl = st.hl;
    document.querySelectorAll(".sc").forEach((c) => c.classList.toggle("active", c.dataset.step === name));
    document.querySelectorAll(".step-mini").forEach((e) => e.classList.toggle("focus", e.id === st.focus));
    document.getElementById("stage").classList.toggle("explore", name === "explore" || name === "agent");  // phones: show the neuron card and positions
    window.VDemo.switchesOff(); (st.sw || []).forEach((k) => window.VDemo.setSwitch(k, true));
    if (st.moves && (name !== "play" || window.VDemo.moves().length === 0 || name === "play")) window.VDemo.load(st.moves);
    draw();
  }
  // the active card is the one in the middle of the visible area; on phones the pinned stage covers the top, so the band moves below it
  const band = () => (innerWidth < 960 ? `-${Math.round(document.getElementById("stage").offsetHeight + 0.12 * innerHeight)}px 0px -${Math.round(0.2 * innerHeight)}px 0px` : "-45% 0px -45% 0px");
  let io = null;
  const observe = () => { if (io) io.disconnect(); io = new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) enter(e.target.dataset.step); }); }, { rootMargin: band() });
    document.querySelectorAll(".sc").forEach((c) => io.observe(c)); };
  let ro, lastH = 0; addEventListener("resize", () => { clearTimeout(ro); ro = setTimeout(observe, 200); });
  // the stage grows on the last steps (phones show the neuron card and positions there): move the band with it
  new ResizeObserver(() => { const h = document.getElementById("stage").offsetHeight; if (innerWidth < 960 && Math.abs(h - lastH) > 20) { lastH = h; clearTimeout(ro); ro = setTimeout(observe, 150); } }).observe(document.getElementById("stage"));
  // the floating contents list would sit on top of the stage: hide it while the story is on screen
  new IntersectionObserver((es) => es.forEach((e) => document.body.classList.toggle("story-on", e.isIntersecting)), { rootMargin: "0px 0px -20% 0px" }).observe(document.getElementById("story"));
  window.VDemo.ready.then(() => { layout(); draw(); observe(); });
})();
