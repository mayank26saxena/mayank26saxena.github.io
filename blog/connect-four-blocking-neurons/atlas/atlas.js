/* Connect Four Neuron Atlas: three views of every neuron (Layers, Map, Library) and a page per neuron pole.
   Data: ../atlas/data/{meta,overview,games,L*}.json (analysis of the trained model), ../post/data/atlas.js (window.ATLAS: firing
   thresholds, circuit roles, agent descriptions), data/map.js (window.ATLASMAP: 2-D layout, scripts/44_atlas_map_layout.py).
   The live board runs the model in the browser (../vertical/c4model.js, weights ../demo/model.*). Columns and rows from 0. */
(function () {
  "use strict";
  const D = "data/", J = (f) => fetch(D + f).then((r) => r.json());
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const MINUS = "−", sg = (v, d = 2) => (v < 0 ? MINUS : "") + Math.abs(v).toFixed(d);
  const zb = (t) => t.replace(/\b(column|row) (\d)\b/g, (m, w, d) => `${w} ${+d - 1}`);   // concept text counts from 1; this atlas from 0
  const L = 6, F = 1024, BAR = 0.3;
  const THEMES = [
    ["block", "Must block now", "#9b2f22", ["block_now"]],
    ["oppthreat", "Opponent's threats", "#c9503a", ["opp_threat_r", "opp_threats_ge1", "opp_threats_ge2", "opp_odd_threat", "opp_even_threat"]],
    ["win", "Can win now", "#d09017", ["win_now"]],
    ["mythreat", "Own threats", "#e3a85a", ["my_threat_r", "my_threats_ge1", "my_threats_ge2", "my_odd_threat", "my_even_threat"]],
    ["line", "Open lines of four", "#7a4fb5", ["line"]],
    ["land", "Landing cells", "#2f8f83", ["land"]],
    ["cell", "Single cells", "#2563b0", ["cell"]],
    ["last", "The last move", "#c4577f", ["last_col", "last_made_threat", "last_blocked", "last_stacked"]],
    ["full", "Full columns", "#5a8a2f", ["full"]],
    ["poison", "Poisoned columns", "#6b4a2b", ["poison"]],
    ["phase", "Game phase", "#6b7fa8", ["ply", "me_first_player"]],
    ["eval", "Who is winning", "#3a4a8a", ["eval_ahead", "eval_behind", "eval_loss", "eval_win", "teacher_best"]],
  ];
  const NONE = ["none", "No clear concept", "#d4d8d6"];
  const TH = new Map(THEMES.map((t) => [t[0], t])); TH.set("none", NONE);
  const famTheme = {}; THEMES.forEach(([k, , , fams]) => fams.forEach((f) => (famTheme[f] = k)));
  const TACNAME = { win: "take a win", block: "block", poison: "avoid a poisoned column", fork: "make a fork" };

  let META, OV, GAMES, NEU = [], POLE = [], LAYERS = {}, AT = window.ATLAS, MP = window.ATLASMAP;
  const concept = (k) => zb(C4Concepts.describe(MP.names[k]).text);   // overview / L*.json concept indices refer to the full list of 681 names
  const poleName = (l, n, s) => `L${l} N${n}${s ? MINUS : "+"}`;
  const layerData = (l) => (LAYERS[l] ? Promise.resolve(LAYERS[l]) : J(`L${l}.json`).then((d) => (LAYERS[l] = d)));

  // ---------- data
  function prepare() {
    const byN = new Map(AT.neurons.map((x) => [x.l * F + x.n, x]));
    for (let l = 0; l < L; l++) NEU.push(Array.from({ length: F }, (_, n) => ({ l, n, best: -1, f1: -1, theme: "none", poles: [-1, -1], at: byN.get(l * F + n) })));
    for (let i = 0; i < OV.layer.length; i++) {
      const o = NEU[OV.layer[i]][OV.neuron[i]], th = OV.f1[i] >= BAR ? famTheme[META.families[OV.fam[i]]] || "eval" : "none";
      POLE.push({ i, l: OV.layer[i], n: OV.neuron[i], s: OV.sign[i], f1: OV.f1[i], c: OV.c[i], theme: th, rate: OV.rate[i], tac: OV.tac[i] });
      o.poles[OV.sign[i]] = i;
      if (OV.f1[i] > o.f1) { o.f1 = OV.f1[i]; o.best = i; o.theme = th; }
    }
    POLE.forEach((p) => { const a = NEU[p.l][p.n].at; p.descs = a ? (a.ds || []).filter((d) => (d.pole === "+" ? 0 : 1) === p.s) : []; p.tb = p.descs.find((d) => d.group) || null; p.desc = p.descs.length ? p.descs.reduce((b, d) => (d.f1 > b.f1 ? d : b)) : null;
      p.vertical = !!(a && a.v && (a.vp === "+" ? 0 : 1) === p.s); p.alarm = p.vertical && a.a !== null && a.a !== undefined ? a.a : null; p.block200 = !!(a && a.b);
      p.text = `${concept(p.c)} ${TH.get(p.theme)[1]} l${p.l} n${p.n} ${poleName(p.l, p.n, p.s)} ${p.descs.map((d) => d.text).join(" ")}${p.descs.some((d) => d.group) ? " blind test" : ""}`.toLowerCase(); });
  }

  // ---------- search (shared by all views)
  let query = [];
  const matches = (p) => !query.length || query.every((w) => p.text.includes(w));
  $("#q").addEventListener("input", () => {
    query = $("#q").value.trim().toLowerCase().replace(/\bl(\d)\s*n(\d+)/g, "l$1 n$2").split(/\s+/).filter(Boolean);
    $("#qcount").textContent = query.length ? `${POLE.filter(matches).length.toLocaleString("en-US")} poles` : "";
    drawGrid(); drawMap(); if (view === "library" && !$("#lib-list").hidden) libList();
  });

  // ---------- themes legend
  let themeSel = null;
  function themes(el) {
    const cnt = {}; for (const row of NEU) for (const o of row) cnt[o.theme] = (cnt[o.theme] || 0) + 1;
    const list = THEMES.concat([NONE]).filter((t) => cnt[t[0]]);
    el.innerHTML = `<p class="th-head">Themes · neurons whose best concept match has F1 ≥ ${BAR}</p>` + list.map(([k, name, col]) =>
      `<button class="th${themeSel === k ? " on" : ""}" data-k="${k}"><i style="background:${col}"></i>${name}<b>${(cnt[k] || 0).toLocaleString("en-US")}</b></button>`).join("");
    el.querySelectorAll(".th").forEach((b) => (b.onclick = () => { themeSel = themeSel === b.dataset.k ? null : b.dataset.k; themes($("#themes")); themes($("#themes2")); drawGrid(); drawMap(); }));
  }

  // ---------- tooltip
  const tip = $("#tip");
  function tipShow(e, html) { tip.innerHTML = html; tip.style.opacity = 1; tip.style.left = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8) + "px"; tip.style.top = Math.min(e.clientY + 14, innerHeight - tip.offsetHeight - 8) + "px"; }
  const tipHide = () => (tip.style.opacity = 0);
  function poleTip(p, extra = "") {
    const th = TH.get(p.theme);
    return `<b>${poleName(p.l, p.n, p.s)}</b> <span class="dim">· ${th[1]}</span><br>${p.f1 >= BAR ? esc(concept(p.c)) + ` <span class="dim">F1 ${p.f1.toFixed(2)}</span>` : `<span class="dim">no concept matches well (best F1 ${p.f1.toFixed(2)})</span>`}` +
      (p.vertical ? `<br><span class="role">vertical-block circuit${p.alarm !== null ? ` · alarm for column ${p.alarm}` : ""}</span>` : "") + (p.desc ? `<br><span class="dim">described by the agent</span>` : "") + extra;
  }

  // ---------- Layers view
  let colorBy = "theme", orderBy = "theme", liveActs = null, model = null, lmoves = [];
  const orders = [];
  function buildOrders() {
    const ti = (k) => THEMES.findIndex((t) => t[0] === k), rank = (o) => (o.theme === "none" ? 99 : ti(o.theme));
    for (let l = 0; l < L; l++) orders[l] = { theme: NEU[l].map((o) => o.n).sort((a, b) => rank(NEU[l][a]) - rank(NEU[l][b]) || NEU[l][b].f1 - NEU[l][a].f1), number: NEU[l].map((o) => o.n) };
  }
  function cellColor(o) {
    if (colorBy === "theme") return [TH.get(o.theme)[2], o.theme === "none" ? 1 : 0.35 + 0.65 * Math.min(1, o.f1 / 0.8)];
    if (colorBy === "agent") { const ds = (o.at && o.at.ds) || []; return ds.length ? ["#2563b0", 0.35 + 0.65 * Math.min(1, Math.max(...ds.map((d) => d.f1)) / 0.8)] : ["#d4d8d6", 0.7]; }
    if (colorBy === "circuit") { const a = o.at; if (a && a.v) return [a.a !== null && a.a !== undefined ? "#c9503a" : "#2563b0", 1]; if (a && a.b) return ["#8fb0d8", 1]; return ["#d4d8d6", 0.6]; }
    if (!liveActs || !o.at) return ["#d4d8d6", 0.6];
    const a = liveActs[o.l][o.n], x = o.at; let v = 0; if (x.tp > 0) v = Math.max(v, a / x.tp); if (x.tn < 0) v = Math.max(v, a / x.tn);
    v = Math.max(0, Math.min(1, (v - 0.3) / 1.2)); return v > 0 ? ["#d0601a", 0.2 + 0.8 * v] : ["#d4d8d6", 0.5];  // colour only above 30% of the firing threshold
  }
  let gridGeo = null;
  function drawGrid() {
    const host = $("#grid"); if (view !== "layers" || !host) return;
    const W = host.clientWidth - 34, cols = W >= 900 ? 128 : W >= 520 ? 64 : 32, cell = Math.max(3, Math.floor(W / cols)), rows = F / cols;
    if (!gridGeo || gridGeo.cols !== cols || gridGeo.cell !== cell) {
      host.innerHTML = Array.from({ length: L }, (_, l) => `<div class="lrow"><span>L${l}</span><canvas data-l="${l}" width="${cols * cell * devicePixelRatio}" height="${rows * cell * devicePixelRatio}" style="width:${cols * cell}px;height:${rows * cell}px"></canvas></div>`).join("");
      gridGeo = { cols, cell, rows };
      host.querySelectorAll("canvas").forEach((cv) => {
        const at = (e) => { const r = cv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / cell), y = Math.floor((e.clientY - r.top) / cell); const i = y * cols + x; return i >= 0 && i < F ? NEU[+cv.dataset.l][orders[+cv.dataset.l][orderBy][i]] : null; };
        cv.onmousemove = (e) => { const o = at(e); if (!o || o.best < 0) return tipHide(); const p = POLE[o.best]; let extra = "";
          if (colorBy === "live" && liveActs && o.at) { const a = liveActs[o.l][o.n]; const v = Math.max(o.at.tp > 0 ? a / o.at.tp : 0, o.at.tn < 0 ? a / o.at.tn : 0); extra = `<br>on this board: <b>${v.toFixed(1)}×</b> its firing threshold`; }
          tipShow(e, poleTip(p, extra)); };
        cv.onmouseleave = tipHide;
        cv.onclick = (e) => { const o = at(e); if (o) go(`#n/${o.l}/${o.n}/${POLE[o.best].s}`); };
      });
    }
    const dpr = devicePixelRatio;
    host.querySelectorAll("canvas").forEach((cv) => {
      const l = +cv.dataset.l, ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      orders[l][orderBy].forEach((n, i) => {
        const o = NEU[l][n], [col, a] = cellColor(o), on = (!themeSel || o.theme === themeSel) && (!query.length || o.poles.some((pi) => pi >= 0 && matches(POLE[pi])));
        ctx.globalAlpha = on ? a : a * 0.15; ctx.fillStyle = col; ctx.fillRect((i % cols) * cell, Math.floor(i / cols) * cell, cell - (cell > 3 ? 1 : 0), cell - (cell > 3 ? 1 : 0));
      });
    });
    const notes = { theme: "Brighter = stronger match. Sorted by theme within each layer, so themes form bands.", agent: `Blue: neurons an AI agent described and tested (${AT.counts.described} descriptions); brighter = its description predicts the neuron better on unseen games.`,
      circuit: "Red: column alarms; blue: the rest of the vertical-block circuit; light blue: the 200 neurons that matter most for blocking of any kind.", live: "Orange = active on this board (above 30% of its own firing threshold; full colour at 1.5×). Drop stones above and watch which neurons respond." };
    $("#gridnote").textContent = notes[colorBy];
  }
  $$("#colorBy button").forEach((b) => (b.onclick = () => { colorBy = b.dataset.c; $$("#colorBy button").forEach((x) => x.classList.toggle("on", x === b)); $("#livebox").hidden = colorBy !== "live"; if (colorBy === "live") liveStart(); drawGrid(); }));
  $$("#orderBy button").forEach((b) => (b.onclick = () => { orderBy = b.dataset.o; $$("#orderBy button").forEach((x) => x.classList.toggle("on", x === b)); drawGrid(); }));

  // live board
  function liveStart() { if (model) return liveRun(); C4Model.load("../lib/model.json").then((m) => { model = m; lmoves = [3, 0, 3, 6, 3]; liveRun(); }); }
  function liveRun() {
    const out = model.forward([7, ...lmoves]), T = lmoves.length; liveActs = out.acts.map((layer) => layer[T]);
    const h = Array(7).fill(0), g = Array.from({ length: 6 }, () => Array(7).fill(-1)); lmoves.forEach((c, i) => { g[h[c]][c] = i % 2; h[c]++; });
    let s = `<rect x="0" y="0" width="364" height="312" rx="4" fill="#dfe4e3"/>`;
    for (let c = 0; c < 7; c++) { for (let r = 0; r < 6; r++) { const v = g[r][c], col = v < 0 ? "#fafbfb" : v === T % 2 ? "var(--me)" : "var(--op)"; s += `<circle cx="${c * 52 + 26}" cy="${(5 - r) * 52 + 26}" r="20" fill="${col}"/>`; }
      s += `<rect class="lc" data-c="${c}" x="${c * 52}" y="0" width="52" height="312" fill="transparent" style="cursor:pointer"/>`; }
    $("#lboard").innerHTML = s; $("#lboard").querySelectorAll(".lc").forEach((r) => (r.onclick = () => { const c = +r.dataset.c; if (h[c] < 6 && lmoves.length < 42) { lmoves.push(c); liveRun(); } }));
    const lg = out.logits[T], legal = h.map((x) => x < 6), mx = Math.max(...Array.from(lg).filter((_, c) => legal[c])), e = Array.from(lg, (v, c) => (legal[c] ? Math.exp(v - mx) : 0)), z = e.reduce((a, b) => a + b, 0);
    $("#lprobs").innerHTML = e.map((v, c) => `<div><i style="height:${Math.round((v / z) * 48)}px"></i>${c}</div>`).join("");
    const best = e.indexOf(Math.max(...e)); $("#lmove").textContent = `The model would play column ${best} (${Math.round((100 * e[best]) / z)}%). ${lmoves.length} stones.`;
    drawGrid();
  }
  $("#lundo").onclick = () => { lmoves.pop(); liveRun(); }; $("#lclear").onclick = () => { lmoves = []; liveRun(); }; $("#lthreat").onclick = () => { lmoves = [3, 0, 3, 6, 3]; liveRun(); };

  // ---------- Map view
  const cam = { s: 1, x: 0, y: 0 }; let mapGeo = null, hoverPole = null, NX = null, NY = null;
  function normLayout() {
    const q = (a, p) => { const b = Float64Array.from(a).sort(); return b[Math.floor(p * (b.length - 1))]; };
    const f = (a) => { const lo = q(a, 0.02), hi = q(a, 0.98); return a.map((v) => Math.max(-0.02, Math.min(1.02, (v - lo) / (hi - lo)))); };
    NX = f(MP.x); NY = f(MP.y);
    const rx = (v) => (v - q(MP.x, 0.02)) / (q(MP.x, 0.98) - q(MP.x, 0.02)), ry = (v) => (v - q(MP.y, 0.02)) / (q(MP.y, 0.98) - q(MP.y, 0.02));
    MP.regions.forEach((g) => { g.nx = rx(g.x); g.ny = ry(g.y); });
  }
  function mapSize() { const cv = $("#map"), w = cv.parentElement.clientWidth, h = Math.max(380, Math.min(680, Math.round(w * 0.72))); cv.width = w * devicePixelRatio; cv.height = h * devicePixelRatio; cv.style.width = w + "px"; cv.style.height = h + "px"; mapGeo = { w, h }; }
  const toScreen = (i) => { const { w, h } = mapGeo, pad = 24, sz = Math.min(w, h) - 2 * pad, ox = (w - sz) / 2, oy = (h - sz) / 2; return [(ox + NX[i] * sz - w / 2) * cam.s + w / 2 + cam.x, (oy + (1 - NY[i]) * sz - h / 2) * cam.s + h / 2 + cam.y]; };
  const rToScreen = (x, y) => { const { w, h } = mapGeo, pad = 24, sz = Math.min(w, h) - 2 * pad, ox = (w - sz) / 2, oy = (h - sz) / 2; return [(ox + x * sz - w / 2) * cam.s + w / 2 + cam.x, (oy + (1 - y) * sz - h / 2) * cam.s + h / 2 + cam.y]; };
  function drawMap() {
    if (view !== "map" || !MP) return; if (!NX) normLayout(); if (!mapGeo) mapSize();
    const cv = $("#map"), ctx = cv.getContext("2d"), { w, h } = mapGeo, dpr = devicePixelRatio, r = Math.max(1.6, Math.min(5, 2 * Math.sqrt(cam.s)));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const order = POLE.map((p) => p.i).sort((a, b) => (POLE[a].theme === "none") - (POLE[b].theme === "none") || 0).reverse();
    for (const i of order) {
      const p = POLE[i], [x, y] = toScreen(i); if (x < -5 || y < -5 || x > w + 5 || y > h + 5) continue;
      const on = (!themeSel || p.theme === themeSel) && matches(p), th = TH.get(p.theme);
      ctx.globalAlpha = on ? (p.theme === "none" ? 0.5 : 0.95) : 0.06; ctx.fillStyle = p.theme === "none" ? "#b9c0bd" : th[2];
      ctx.beginPath(); ctx.arc(x, y, p.theme === "none" ? r * 0.75 : r * 1.25, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (hoverPole !== null) { const [x, y] = toScreen(hoverPole); ctx.strokeStyle = "#1b1f1d"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r + 3, 0, 6.283); ctx.stroke(); }
    ctx.font = "600 12px Inter, sans-serif"; ctx.textAlign = "center";
    MP.regions.forEach((g) => {
      if (g.n_labelled < 25 && cam.s < 2) return;
      const [x, y] = rToScreen(g.nx, g.ny); if (x < 0 || y < 0 || x > w || y > h) return;
      const lab = g.n_labelled >= 25 && g.concept ? regionLabel(g) : "no clear concept";
      ctx.lineWidth = 3.5; ctx.strokeStyle = "rgba(251,251,249,.9)"; ctx.strokeText(lab, x, y); ctx.fillStyle = "#1b1f1d"; ctx.fillText(lab, x, y);
    });
    $("#mapnote").textContent = `zoom ${cam.s.toFixed(1)}× · ${POLE.length.toLocaleString("en-US")} poles · region names: the most common theme among the poles in that region that match a concept`;
  }
  function regionLabel(g) {
    const t = famTheme[g.family], base = t ? TH.get(t)[1] : g.family.replace(/_/g, " ");
    const m = g.concept && zb(C4Concepts.describe(g.concept).text).match(/column (\d)/);
    return m ? `${base} · col ${m[1]}` : base;
  }
  function nearest(e) {
    const rc = $("#map").getBoundingClientRect(), mx = e.clientX - rc.left, my = e.clientY - rc.top; let best = null, bd = 64;
    for (const p of POLE) { if (themeSel && p.theme !== themeSel) continue; if (!matches(p)) continue; const [x, y] = toScreen(p.i), d = (x - mx) ** 2 + (y - my) ** 2; if (d < bd) { bd = d; best = p.i; } }
    return best;
  }
  (function mapEvents() {
    const cv = $("#map"); let drag = null;
    cv.addEventListener("wheel", (e) => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, e); }, { passive: false });
    cv.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", (e) => {
      if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; cam.x = drag.cx + dx; cam.y = drag.cy + dy; drawMap(); return; }
      const i = nearest(e); hoverPole = i; if (i === null) tipHide(); else tipShow(e, poleTip(POLE[i])); drawMap();
    });
    cv.addEventListener("pointerup", (e) => { const d = drag; drag = null; if (d && !d.moved) { const i = nearest(e); if (i !== null) go(`#n/${POLE[i].l}/${POLE[i].n}/${POLE[i].s}`); } });
    cv.addEventListener("pointerleave", () => { hoverPole = null; tipHide(); drawMap(); });
    function zoomAt(f, e) { const rc = cv.getBoundingClientRect(), mx = (e ? e.clientX - rc.left : mapGeo.w / 2) - mapGeo.w / 2, my = (e ? e.clientY - rc.top : mapGeo.h / 2) - mapGeo.h / 2;
      const s2 = Math.max(1, Math.min(14, cam.s * f)), k = s2 / cam.s; cam.x = mx - (mx - cam.x) * k; cam.y = my - (my - cam.y) * k; cam.s = s2; if (cam.s === 1) { cam.x = 0; cam.y = 0; } drawMap(); }
    $("#zin").onclick = () => zoomAt(1.5); $("#zout").onclick = () => zoomAt(1 / 1.5); $("#zfit").onclick = () => { cam.s = 1; cam.x = 0; cam.y = 0; drawMap(); };
  })();

  // ---------- Library
  let libSet = "agent";
  function libList() {
    const layer = $("#liblayer").value;
    let ps = POLE.filter((p) => (layer === "" || p.l === +layer) && matches(p) &&
      (libSet === "all" || (libSet === "agent" && p.desc) || (libSet === "blind" && p.tb) || (libSet === "circuit" && p.vertical) || (libSet === "alarms" && p.alarm !== null)));
    ps.sort(libSet === "agent" ? (a, b) => b.desc.f1 - a.desc.f1 : libSet === "blind" ? (a, b) => (a.tb.group === b.tb.group ? b.tb.ta - a.tb.ta : a.tb.group === "circuit" ? -1 : 1) : (a, b) => b.f1 - a.f1);
    $("#libcount").textContent = `${ps.length.toLocaleString("en-US")} poles${ps.length > 120 ? "; showing the first 120" : ""}.`;
    $("#libcards").innerHTML = ps.slice(0, 120).map((p) => { const th = TH.get(p.theme); const dd = libSet === "blind" ? p.tb : p.desc; const label = dd ? firstSentence(dd.text) : p.f1 >= BAR ? concept(p.c) : "No concept matches well";
      return `<a class="ncard" href="#n/${p.l}/${p.n}/${p.s}"><span class="nid">${poleName(p.l, p.n, p.s)}<i style="background:${th[2]}"></i></span><span class="nl">${esc(label)}</span>` +
        `<span class="nm">${libSet === "blind" ? `${p.tb.group} · block agreement ${p.tb.ta.toFixed(2)} · ` : p.desc ? `agent F1 ${p.desc.f1.toFixed(2)} · ` : ""}concept F1 ${p.f1.toFixed(2)}${p.vertical ? " · vertical circuit" : ""}${p.alarm !== null ? ` · alarm col ${p.alarm}` : ""}</span></a>`; }).join("");
  }
  const firstSentence = (t) => { const s = t.split(/(?<=\.)\s(?=[A-Z])/)[0]; return s.length > 150 ? s.slice(0, s.lastIndexOf(" ", 146)) + " …" : s; };
  $$("#libset button").forEach((b) => (b.onclick = () => { libSet = b.dataset.s; $$("#libset button").forEach((x) => x.classList.toggle("on", x === b)); libList(); }));
  $("#liblayer").insertAdjacentHTML("beforeend", Array.from({ length: L }, (_, l) => `<option value="${l}">layer ${l}</option>`).join(""));
  $("#liblayer").onchange = libList;

  // neuron page
  function replay(str, t) { const g = Array.from({ length: 6 }, () => Array(7).fill(0)), h = Array(7).fill(0); let last = null; for (let i = 0; i < t; i++) { const c = +str[i]; g[h[c]][c] = 1 + (i % 2); last = [h[c], c]; h[c]++; } return { g, last }; }
  function boardSVG(g, last, t) { const mover = 1 + (t % 2); let s = `<svg viewBox="0 0 70 60"><rect x="0" y="0" width="70" height="60" rx="4" fill="#e4e8e7"/>`;
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) { const v = g[r][c], col = v === 0 ? "#fafbfb" : v === mover ? "#2563b0" : "#d09017", ring = last && last[0] === r && last[1] === c; s += `<circle cx="${5 + c * 10}" cy="${5 + (5 - r) * 10}" r="4.2" fill="${col}"${ring ? ' stroke="#1b1f1d" stroke-width="1.4"' : ""}/>`; }
    return s + "</svg>"; }
  function liftSVG(vals, label) { let s = `<svg viewBox="0 0 70 60"><rect x="0" y="0" width="70" height="60" rx="4" fill="#e4e8e7"/>`;
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) { const v = vals[r * 7 + c], a = Math.min(1, Math.abs(v) / 45), col = v >= 0 ? "#2563b0" : "#c9503a";
      s += `<circle cx="${5 + c * 10}" cy="${5 + (5 - r) * 10}" r="4.2" fill="#fafbfb"/><circle cx="${5 + c * 10}" cy="${5 + (5 - r) * 10}" r="4.2" fill="${col}" opacity="${(0.08 + 0.92 * a).toFixed(2)}"><title>${label}, row ${r}, column ${c}: ${v > 0 ? "+" : v < 0 ? MINUS : ""}${Math.abs(v)} points</title></circle>`; }
    return s + "</svg>"; }
  const bar = (label, v, scale) => { const w = Math.min(50, (Math.abs(v) / scale) * 50); return `<div class="hbar"><span>${label}</span><span class="tr"><em></em><i style="${v >= 0 ? `left:50%;width:${w}%;background:#2563b0` : `right:50%;width:${w}%;background:#c9503a`}"></i></span><span class="v">${sg(v, 2)}</span></div>`; };
  function npage(l, n, s) {
    $("#lib-list").hidden = true; const el = $("#npage"); el.hidden = false; el.innerHTML = `<p class="hnote">Loading layer ${l}…</p>`;
    layerData(l).then((recs) => {
      const r = recs[n], P = r.poles[s], other = r.poles[1 - s], pi = NEU[l][n].poles[s], p = POLE[pi], th = TH.get(p.theme);
      const dle = r.dle.map((v) => v * (s === 0 ? 1 : -1)), dmax = Math.max(...dle.map(Math.abs), 1e-6), tmax = META.tactics.map((_, j) => Math.max(...OV.tac.map((a) => Math.abs(a[j]))) || 1);
      const prev = n > 0 ? `#n/${l}/${n - 1}/${NEU[l][n - 1].best >= 0 ? POLE[NEU[l][n - 1].best].s : 0}` : null, next = n < F - 1 ? `#n/${l}/${n + 1}/${NEU[l][n + 1].best >= 0 ? POLE[NEU[l][n + 1].best].s : 0}` : null;
      let h = `<div class="nav"><a href="#library">← Library</a><span>${prev ? `<a href="${prev}">‹ neuron ${n - 1}</a>` : ""}${next ? `<a href="${next}">neuron ${n + 1} ›</a>` : ""}</span></div>`;
      h += `<p class="kick"><i style="background:${th[2]}"></i>${th[1]} · layer ${l} · neuron ${n}</p><h1>${poleName(l, n, s)}</h1>`;
      h += `<div class="poletabs">${[0, 1].map((k) => `<a class="${k === s ? "on" : ""}" href="#n/${l}/${n}/${k}"><b>${k === 0 ? "Positive" : "Negative"} pole</b>${esc(concept(r.poles[k].C[0]))}</a>`).join("")}</div>`;
      h += `<p class="big">${p.f1 >= BAR ? `Fires when ${esc(concept(P.C[0]).replace(/^./, (c) => c.toLowerCase()))}.` : "No game concept describes this pole well; its closest match is below."}</p>`;
      p.descs.forEach((d) => { h += `<div class="agent"><p class="lbl">${d.group ? `Blind test after the circuit was frozen (${d.group === "circuit" ? "one of the 20 key circuit neurons" : "a look-alike decoy"}, hidden among 50 units): rule F1 ${d.f1.toFixed(2)}, block agreement ${d.ta.toFixed(2)}${d.ta >= 0.5 ? " — found as a block detector" : ""}` : `Written by the AI agent, blind, and tested on unseen games (F1 ${d.f1.toFixed(2)}, study ${d.id.slice(0, 1)})`}</p><p>${esc(d.text)}</p></div>`; });
      if (p.vertical) h += `<div class="rolebox">Part of the <b>vertical-block circuit</b>${p.alarm !== null ? `: a <b>column alarm</b> for column ${p.alarm}, pushing the model to play there when the opponent stacks three` : ""}. <a href="../index.html">How we found it →</a></div>`;
      else if (p.block200) h += `<div class="rolebox">One of the <b>200 neurons that matter most for blocking</b> of any kind.</div>`;
      h += `<div class="kv"><span>fires on <b>${(100 * P.rate).toFixed(1)}%</b> of positions</span><span>typical move number <b>${P.ply.toFixed(0)}</b></span><span>firing threshold <b>${sg(P.thr, 2)}</b></span><span>activation range <b>${sg(r.q[0], 1)} to ${sg(r.q[4], 1)}</b></span></div>`;
      h += `<section><h2>Concepts it matches</h2><ol class="cands">${P.C.map((k, i) => `<li>${esc(concept(k))} <b>F1 ${P.F1[i].toFixed(2)}</b></li>`).join("")}</ol></section>`;
      h += `<section><h2>What the board looks like when it fires</h2><div class="boards"><div class="bd">${liftSVG(P.occ.slice(0, 42), "player to move")}player to move's stone</div><div class="bd">${liftSVG(P.occ.slice(42, 84), "opponent")}opponent's stone</div><div class="bd">${liftSVG(P.occ.slice(84, 126), "empty")}empty cell</div></div><p class="note">Blue: more often than usual when this pole fires; red: less often (change in percentage points, full colour at 45).</p></section>`;
      h += `<section><h2>Where it fires most</h2><div class="exg">${P.ex.map(([g, t, a]) => { const b = replay(GAMES[g], t), nx = GAMES[g][t]; return `<div class="ex">${boardSVG(b.g, b.last, t)}<span>${t} stones · ${sg(a, 1)}${nx !== undefined ? ` · played ${nx}` : ""}</span></div>`; }).join("")}</div><p class="note">Blue: the player about to move; ochre: the opponent; ring: the last stone.</p></section>`;
      h += `<section><h2>What it does to the move</h2>${dle.map((v, c) => bar(`column ${c}`, v, dmax)).join("")}<p class="note">Direct effect on each column's score when this pole fires (through the output layer only, centred across columns).</p></section>`;
      h += `<section><h2>Tactics it supports</h2>${META.tactics.map((t, j) => bar(TACNAME[t] || t, r.tac[j], tmax[j])).join("")}<p class="note">Positive: switching this neuron off makes the model less likely to play the tactic. Scaled to the largest value among all neurons.</p></section>`;
      h += `<p class="note">The other pole matches “${esc(concept(other.C[0]))}” (F1 ${other.F1[0].toFixed(2)}).</p>`;
      el.innerHTML = h; scrollTo(0, 0);
    });
  }

  // ---------- routing
  let view = "layers";
  function go(hash) { if (location.hash !== hash) location.hash = hash; else route(); }
  function route() {
    const h = location.hash || "#layers", m = h.match(/^#n\/(\d)\/(\d+)\/([01])$/);
    view = m ? "library" : ["#layers", "#map", "#library"].includes(h) ? h.slice(1) : "layers";
    $$(".view").forEach((v) => (v.hidden = v.id !== "v-" + view)); $$(".tabs a").forEach((a) => a.classList.toggle("on", a.dataset.view === view)); tipHide();
    if (view === "layers") drawGrid();
    if (view === "map") { mapGeo = null; drawMap(); }
    if (view === "library") { if (m) npage(+m[1], +m[2], +m[3]); else { $("#npage").hidden = true; $("#lib-list").hidden = false; libList(); } }
  }
  addEventListener("hashchange", route);
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { gridGeo = null; mapGeo = null; drawGrid(); drawMap(); }, 150); });

  Promise.all([J("meta.json"), J("overview.json"), J("games.json")]).then(([m, o, g]) => {
    META = m; OV = o; GAMES = g; prepare(); buildOrders(); themes($("#themes")); themes($("#themes2")); route();
  }).catch((e) => { document.querySelector("main").insertAdjacentHTML("afterbegin", `<p class="hnote">Could not load the atlas data: ${esc(e.message)}</p>`); });
})();
