// Vertical-blocker demo (PLAN addendum u). Model: c4model.js (same fp16 weights as the analysis); switches: switches.js;
// every number shown comes from window.VDATA (scripts/41_vertical_demo_export.py).
(function () {
  "use strict";
  // elements this page lacks (the demo is also embedded in the blog post) are written to a detached node
  const VD = window.VDATA, D = VD.demo, SINK = document.createElement("div"), $ = (s) => document.querySelector(s) || SINK;
  const PH0 = VD.map.posthoc;
  const pc = (x) => (x == null ? "–" : Math.round(100 * x) + "%");
  const pts = (x) => { const n = Math.round(100 * x); return n + (Math.abs(n) === 1 ? " point" : " points"); };  // a difference between two accuracies
  const W = 7, H = 6, CW = 52, CH = 48, TOP = 34;
  let model = null, moves = [], active = new Set(), preset = null;
  const listeners = [];  // window.VDemo.on(f): f({out, base, S, p, p0, moves, active}) after every render

  // ---------- board logic (absolute players: move i is played by player i % 2)
  function grid(ms) {
    const g = Array.from({ length: H }, () => Array(W).fill(-1)), h = Array(W).fill(0), who = [];
    ms.forEach((c, i) => { g[h[c]][c] = i % 2; who.push([h[c], c]); h[c]++; });
    return { g, h, who };
  }
  function fourAt(g, r, c, p) {
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      let n = 1;
      for (const s of [1, -1]) { let rr = r + s * dr, cc = c + s * dc; while (rr >= 0 && rr < H && cc >= 0 && cc < W && g[rr][cc] === p) { n++; rr += s * dr; cc += s * dc; } }
      if (n >= 4) return true;
    }
    return false;
  }
  function state(ms) {
    const { g, h, who } = grid(ms), me = ms.length % 2, op = 1 - me;
    const over = ms.length > 0 && fourAt(g, who[ms.length - 1][0], who[ms.length - 1][1], op);
    const legal = h.map((x) => x < H), win = [], block = [];
    for (let c = 0; c < W; c++) if (legal[c]) { if (fourAt(g, h[c], c, me)) win.push(c); if (fourAt(g, h[c], c, op)) block.push(c); }
    return { g, h, who, me, op, over, legal, win, block, full: ms.length >= 42 };
  }

  // ---------- model run with the active switches
  function opts(names) {
    const os = [...names].map((n) => VSwitches.switchOpts(D, n));
    const o = { headMean: new Set(), means: { mean_y: {} } }, hooks = [];
    for (const x of os) {
      if (x.headMean) { x.headMean.forEach((k) => o.headMean.add(k)); Object.assign(o.means.mean_y, x.means.mean_y); }
      if (x.actsHook) hooks.push(x.actsHook);
    }
    if (hooks.length) o.actsHook = (l, t, a) => hooks.forEach((f) => f(l, t, a));
    return o;
  }
  function softmax(lg, legal) {
    const xs = Array.from(lg, (v, c) => (legal[c] ? v : -Infinity)), m = Math.max(...xs);  // plain array: lg is a Float32Array
    const e = xs.map((v) => (v === -Infinity ? 0 : Math.exp(v - m))), z = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / z);
  }

  // ---------- drawing
  function render() {
    const S = state(moves), toks = [7, ...moves], T = toks.length;
    const out = model.forward(toks, opts(active));
    const base = active.size ? model.forward(toks, {}) : out;
    const p = softmax(out.logits[T - 1], S.legal), p0 = softmax(base.logits[T - 1], S.legal);
    // 1. attention of the head from the last position (the intact run, so the arrows show what the head looks at)
    const att = base.attn[D.head[0]][T - 1][D.head[1]];
    // 2. direction meters (first direction of each layer, oriented so up = more like a vertical threat)
    const lv = [0, 1, 2, 3, 4].map((l) => {
      const d = D.directions[l], u = d.U[0], a = out.acts[l][T - 1];
      let s = 0; for (let j = 0; j < a.length; j++) s += a[j] * u[j];
      const [lo, hi] = D.dir_p1_p99[l], r = Math.max(0, Math.min(1, (s - lo) / (hi - lo)));
      return d.sign > 0 ? r : 1 - r;
    });
    // 3. column alarms: strongest readout neuron per promoted column, as a share of its own dev p99
    const lamp = Array(W).fill(0), nper = Array(W).fill(0);
    for (const r of D.readout) {
      const a = out.acts[5][T - 1][r.neuron] * (r.pole === "+" ? 1 : -1);
      lamp[r.promotes] = Math.max(lamp[r.promotes], Math.max(0, Math.min(1, a / r.p99))); nper[r.promotes]++;
    }
    drawBoard(S, att, lamp, nper);
    listeners.forEach((f) => f({ out, base, S, p, p0, moves: [...moves], active: new Set(active) }));
    // step texts
    const last = moves.length ? moves[moves.length - 1] : null;
    if (last == null) $("#head-text").textContent = "Drop a stone: the head looks back from the newest move.";
    else {
      let opp = 0, same = 0; const t = moves.length;
      moves.slice(0, -1).forEach((c, i) => { if ((i % 2) === ((t - 1) % 2)) { opp += att[i + 1]; if (c === last) same += att[i + 1]; } });
      $("#head-text").innerHTML = `From the newest stone (column ${last}), <b>${pc(opp)}</b> of its attention goes to the earlier moves of the player who just moved (rings), ${pc(same)} to those in column ${last}. Across test positions with a vertical threat: ${pc(PH0.attention.last_mover_any)} and ${pc(PH0.attention.last_mover_same_col)}.`;
    }
    $("#meters").innerHTML = lv.map((v, l) => `<div class="meter"><div class="tube"><i style="height:${Math.round(v * 100)}%"></i></div>L${l}</div>`).join("");
    const bc = new Set(S.block);
    $("#probs").innerHTML = p.map((v, c) => `<div class="pc${bc.has(c) ? " block" : ""}" title="column ${c}: ${pc(v)}${active.size ? " (intact " + pc(p0[c]) + ")" : ""}">` +
      (active.size ? `<span class="ghost" style="bottom:${Math.round(p0[c] * 46) + 14}px"></span>` : "") +
      `<i style="height:${Math.max(1, Math.round(v * 46))}px"></i>${c}</div>`).join("");
    let mt = "";
    if (S.over) mt = "Game over: the last move made four.";
    else if (S.win.length) mt = `The player to move can win in column ${S.win.join(", ")}; that comes before blocking.`;
    else if (S.block.length === 1) mt = `Must block column ${S.block[0]}: the model puts <b>${pc(p[S.block[0]])}</b> on it${active.size ? ` (intact model: ${pc(p0[S.block[0]])})` : ""}.`;
    else if (S.block.length > 1) mt = `Two threats at once (columns ${S.block.join(", ")}): no single move blocks both.`;
    else mt = "No threat to block right now.";
    $("#move-text").innerHTML = mt;
    $("#status").textContent = `${moves.length} stones`;
    ["head", "dirs", "alarm"].forEach((k, i) => $("#st-" + k).classList.toggle("off", active.has(["head", "directions", "readout"][i])));
  }

  function drawBoard(S, att, lamp, nper) {
    let s = `<rect x="0" y="${TOP}" width="${W * CW}" height="${H * CH}" rx="4" fill="#dfe4e3"/>`;
    for (let c = 0; c < W; c++) {
      const cx = c * CW + CW / 2;
      s += `<circle cx="${cx}" cy="16" r="11" fill="var(--lamp)" fill-opacity="${(0.08 + 0.92 * lamp[c]).toFixed(2)}" stroke="var(--lamp)" stroke-width="1"><title>column ${c} alarm: ${pc(lamp[c])} of its usual top level (${nper[c]} neurons)</title></circle>`;
      for (let r = 0; r < H; r++) {
        const cy = TOP + (H - 1 - r) * CH + CH / 2, v = S.g[r][c];
        // default: drawn from the side of the player to move; VDEMO_FIXED: the first player (the reader) is always ochre, the model blue
        const mine = window.VDEMO_FIXED ? v === 1 : v === S.me;
        const fill = v < 0 ? "#fafbfb" : mine ? "var(--me)" : "var(--op)";
        s += `<circle cx="${cx}" cy="${cy}" r="19" fill="${fill}"/>`;
      }
      s += `<rect class="colhit" data-c="${c}" x="${c * CW}" y="0" width="${CW}" height="${TOP + H * CH}" fill="transparent"/>`;
    }
    // attention rings on earlier stones and a dot on the newest
    S.who.forEach(([r, c], i) => {
      const cx = c * CW + CW / 2, cy = TOP + (H - 1 - r) * CH + CH / 2;
      if (i === S.who.length - 1) s += `<circle cx="${cx}" cy="${cy}" r="6" fill="#fff" pointer-events="none"/>`;
      else { const a = att[i + 1]; if (a > 0.02) s += `<circle cx="${cx}" cy="${cy}" r="21" fill="none" stroke="var(--ink)" stroke-opacity="${Math.min(1, 0.25 + a * 1.5).toFixed(2)}" stroke-width="${(1 + 7 * a).toFixed(1)}" pointer-events="none"><title>attention ${pc(a)}</title></circle>`; }
    });
    const svg = $("#board"); svg.innerHTML = s;
    svg.querySelectorAll(".colhit").forEach((el) => el.addEventListener("click", () => drop(+el.dataset.c)));
  }

  function drop(c) {
    const S = state(moves);
    if (S.over || S.full || !S.legal[c]) return;
    moves.push(c); preset = null; markPreset(); render();
  }

  // ---------- presets and switches
  // a hand-made starter (the opponent stacks three in column 3 in five moves), then positions from held-out games
  const PRE = [["starter: three in column 3", [3, 0, 3, 6, 3]], ["no threat yet", [3, 0, 3, 6]]].concat(
    Object.entries(D.examples).map(([k, mv]) => [k.startsWith("vertical_c") ? `game · col ${k.slice(-1)}` : `game · ${k}`, mv]));
  function markPreset() { document.querySelectorAll("#presets button").forEach((b) => b.classList.toggle("on", b.dataset.k === preset)); }
  $("#presets").innerHTML = PRE.map(([k]) => `<button type="button" data-k="${k}">${k}</button>`).join("");
  document.querySelectorAll("#presets button").forEach((b) => b.addEventListener("click", () => { preset = b.dataset.k; moves = [...PRE.find(([k]) => k === preset)[1]]; markPreset(); render(); }));
  $("#undo").addEventListener("click", () => { moves.pop(); preset = null; markPreset(); render(); });
  $("#reset").addEventListener("click", () => { moves = []; preset = null; markPreset(); render(); });

  const A = D.switch_accuracy, N = D.n_positions;
  const SW = [["head", "Switch off head L0·H2", "the head that gathers the opponent's recent moves"],
    ["directions", "Switch off the 15 directions", "3 per layer, layers 0–4 (set to their average)"],
    ["readout", `Switch off the ${D.readout_size} column alarms`, "the layer-5 neurons of the vertical circuit"]];
  $("#switches").innerHTML = SW.map(([k, t, s]) => `<button type="button" class="switch" data-k="${k}"><b>${t}</b>${s}<span class="m">vertical blocks ${pc(A.none.vertical)} → ${pc(A[k].vertical)}; other play ${pc(A.none.control)} → ${pc(A[k].control)}</span></button>`).join("");
  document.querySelectorAll(".switch").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.k; active.has(k) ? active.delete(k) : active.add(k); b.classList.toggle("on", active.has(k)); render();
  }));

  // ---------- text and tables from the data
  const M = VD.map, Tt = VD.orient, PH = VD.map.posthoc;
  $("#meta-n").textContent = `${N.vertical.toLocaleString()} vertical-threat test positions`;
  $("#demo-cap").innerHTML = `<b>Figure ${document.body.dataset.demoFig || 1}:</b> the live model, with its four steps for the position on the board. Rings show where head L0·H2 looks from the newest stone; tubes show the first direction of layers 0–4; lamps above the columns are the layer-5 alarms; bars are the model's move probabilities (dashed: the intact model when parts are switched off). The numbers on each switch are measured on ${N.vertical.toLocaleString()} vertical-threat positions from held-out games, and ${N.control.toLocaleString()} ordinary positions for "other play".`;
  $("#demo-setup").innerHTML = `Switches replace a part's output with its average over all positions of the analysis games, at every position, so they work while you play. Random controls of the same size change vertical blocking by ${pts(A.none.vertical - D.random_directions_median.vertical)} (random directions) and ${pts(A.none.vertical - D.random_readout_median.vertical)} (random layer-5 neurons). The browser model matches PyTorch under every switch (tests/check_vertical_port.js).`;
  $("#p-head").innerHTML = `We expected head 2 of layer 0 to look up the earlier stones in the newest stone's column (the tokens are column numbers, so that is an easy match). It does not: only ${pc(M.u1.same_column_share)} of its attention goes there (prediction u-1 failed). Looked at afterwards, it is a head for <i>the opponent's recent moves</i>: ${pc(PH.attention.last_mover_any)} of its attention goes to earlier moves of the player who just moved, in any column, most of it to their latest two (${pc(PH.attention.last_mover_prev1)}, ${pc(PH.attention.last_mover_prev2)}). A vertical three is usually built from those same recent moves, which is why the share on the threat column rises from ${pc(PH.attention_all.last_mover_same_col)} on ordinary positions to ${pc(PH.attention.last_mover_same_col)} when there is a threat. Switching the head off costs vertical blocks ${pts(A.none.vertical - A.head.vertical)}, horizontal blocks ${pts(A.none.horizontal - A.head.horizontal)}, diagonal blocks ${pts(A.none.diagonal - A.head.diagonal)}, and other play ${pts(A.none.control - A.head.control)}.`;
  $("#p-dirs").innerHTML = `Between the head and the last layer, the threat is not stored in a few neurons: ${Tt.vertical.n80.toLocaleString()} neurons of layers 0–4 are needed to carry 80% of it, but ${Tt.vertical.d80} directions (3 per layer) carry ${pc(Tt.vertical.d80_confirm)}. These 15 directions feed the last step: patching them moves the layer-5 alarms by ${pc(M.u2.weighted_mean)} of their full change (u-2 held). What a single direction means is less tidy: we predicted the first one would track the height of the opponent's stack, and it does not (u-4 failed, |ρ| ≤ ${Math.max(...Object.values(M.u4.spearman).map(Math.abs)).toFixed(2)}). Looked at afterwards, in layers 1, 2 and 4 it separates "a vertical threat on the newest column" from the rest moderately well (AUROC ${["1", "2", "4"].map((l) => PH.auroc_threat[l].toFixed(2)).join(", ")}; such threats are ${pc(PH.threat_base_rate)} of positions); the tubes show it.`;
  const AD = M.alarm_descriptions;
  const adText = AD.length ? ` ${AD.length} of them happened to be among the neurons an AI agent described, blind, in an earlier study; it wrote, for example, "${AD[0].description.split(/(?<=\.)\s(?=[A-Z])/)[0]}"` : "";
  $("#p-alarm").innerHTML = `The last step is neat. The vertical circuit has ${M.circuit.size} neurons; ${D.readout_size} of them are in layer 5, and ${pc(M.u3.share)} of those raise exactly the column whose threat they respond to: one alarm per column. Switching only these off removes ${pc(M.readout_confirm_effect)} of the threat signal.${adText}`;
  const P = [["u-1", "Head L0·H2 puts ≥ 50% of its attention on earlier moves in the same column", pc(M.u1.same_column_share), M.u1.holds],
    ["u-2", "The 15 directions account for ≥ 70% of the layer-5 alarms' change", pc(M.u2.weighted_mean), M.u2.holds],
    ["u-3", "≥ 80% of layer-5 circuit neurons raise the column they respond to", pc(M.u3.share), M.u3.holds],
    ["u-4", "The first direction tracks the opponent's stack (|ρ| ≥ 0.5 in ≥ 3 of 5 layers)", Object.values(M.u4.spearman).map((v) => v.toFixed(2)).join(" / "), M.u4.holds],
    ["u-5 (i)", "Head switch hurts vertical blocking ≥ 20 points more than other play", `−${Math.round(100 * (A.none.vertical - A.head.vertical))} vs −${Math.round(100 * (A.none.control - A.head.control))} pts`, M.u5.i],
    ["u-5 (ii)", "Direction switch: vertical −30 points, other play ≤ −10, random ≤ −5", `−${Math.round(100 * (A.none.vertical - A.directions.vertical))} / −${Math.round(100 * (A.none.control - A.directions.control))} pts`, M.u5.ii],
    ["u-5 (iii)", "Alarm switch: vertical −30 points, other play ≤ −5, random ≤ −5", `−${Math.round(100 * (A.none.vertical - A.readout.vertical))} / −${Math.round(100 * (A.none.control - A.readout.control))} pts`, M.u5.iii]];
  $("#preds").innerHTML = `<thead><tr><th></th><th>Prediction</th><th>Measured</th><th></th></tr></thead><tbody>` +
    P.map(([id, t, v, h]) => `<tr><td class="n">${id}</td><td>${t}</td><td class="n">${v}</td><td class="${h ? "held" : "failed"}">${h ? "held" : "failed"}</td></tr>`).join("") + "</tbody>";
  const rows = [["none", "intact model"], ["head", "head L0·H2 off"], ["directions", "15 directions off"], ["readout", `${D.readout_size} alarms off`]];
  $("#sw-table").innerHTML = `<thead><tr><th>Block accuracy</th><th>vertical</th><th>horizontal</th><th>diagonal</th><th>other play</th></tr></thead><tbody>` +
    rows.map(([k, t]) => `<tr><td>${t}</td>${["vertical", "horizontal", "diagonal", "control"].map((o) => `<td class="n">${pc(A[k][o])}</td>`).join("")}</tr>`).join("") + "</tbody>";
  $("#sw-note").textContent = `Positions: ${["vertical", "horizontal", "diagonal"].map((o) => `${N[o].toLocaleString()} ${o}`).join(", ")} threats and ${N.control.toLocaleString()} ordinary positions ("other play": the move the search engine rates best), from held-out games.`;
  $("#limits-list").innerHTML = [
    `This method suits vertical threats because, at the last step, a few neurons do most of the work. For horizontal and diagonal threats it does not: no set of 200 neurons carries 80% of them, and the computation is spread over ${Tt.horizontal.d80} and ${Tt.diagonal.d80} directions instead of ${Tt.vertical.d80}.`,
    "Switches use averages, not the matched position without the threat, so they also remove whatever else a part does; the \"other play\" column shows how much.",
    "One model, one tactic. The attention and direction readings explain what carries the threat, not every step of how the head's output is turned into the alarm.",
    "The 15 directions were fitted to the difference between threat and no-threat positions, so they are the best case for directions; the neuron counts are upper bounds from one ranking method.",
  ].map((t) => `<li>${t}</li>`).join("");

  function setSwitch(k, on) { on ? active.add(k) : active.delete(k); document.querySelectorAll(".switch").forEach((b) => b.classList.toggle("on", active.has(b.dataset.k))); if (model) render(); }
  // driver API for pages that embed the demo (the blog post's scrolling story)
  window.VDemo = {
    on: (f) => listeners.push(f),
    load: (mv) => { moves = [...mv]; preset = null; markPreset(); if (model) render(); },
    preset: (k) => { const e = PRE.find(([kk]) => kk === k); if (e) { moves = [...e[1]]; preset = k; markPreset(); if (model) render(); } },
    setSwitch, switchesOff: () => { [...active].forEach((k) => setSwitch(k, false)); },
    moves: () => [...moves], ready: null,
  };
  const start = window.VDEMO_START || PRE[0][1];
  window.VDemo.ready = C4Model.load(window.VDEMO_MODEL || "../demo/model.json").then((m) => { model = m; moves = [...start]; preset = window.VDEMO_START ? null : PRE[0][0]; markPreset(); render(); });
})();
