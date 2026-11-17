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



  /* Step-through explainer of the generic autoresearch loop (Karpathy's design), replayed on a real two-experiment run of the
     MLX port: workspace (program.md / train.py / terminal) on the left, git history and results.tsv on the right, one caption per scene. */
  function explainer(root, H) {
    const [L1, L2] = H.ar_laps, base = L1.prev;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const STEPS = ["Read state", "Pick an idea", "Edit train.py", "Commit + run", "Keep or reset", "Log", "Repeat"];
    const prog = (best) => `<div class="xp-file"><div class="xp-h"># program.md · the agent’s standing instructions</div>` +
      `<p><b>Goal</b> get the lowest <code>val_bpb</code></p><p><b>Edit</b> <code>train.py</code>, the only file you change</p>` +
      `<p><b>Never edit</b> <code>prepare.py</code> (data and evaluation)</p><p><b>Budget</b> 5 minutes of training per run</p>` +
      `<p><b>Best so far</b> <code>${best.toFixed(3)}</code> <span class="xp-dim">(from results.tsv)</span></p></div>`;
    const idea = (L) => `<div class="xp-think"><span>idea</span>${esc(L.hypothesis)}</div>`;
    const diff = (L) => `<div class="xp-code"><div class="xp-h">train.py</div>` +
      L.old.map((t) => `<div class="del">- ${esc(t)}</div>`).join("") + L.new.map((t, i) => `<div class="add" style="--i:${i}">+ ${esc(t)}</div>`).join("") + `</div>`;
    const term = (L) => `<div class="xp-term">` + [
      `<span class="pr">$</span> git commit -m "experiment: ${esc(L.note)}"`,
      `<span class="pr">$</span> uv run train.py &gt; run.log`,
      `<span class="dim">training for 300 s (fixed budget) · evaluating on held-out text</span>`,
      `<span class="pr">$</span> grep "^val_bpb:" run.log`,
      `<b>val_bpb: ${L.s.toFixed(6)}</b>`].map((t, i) => `<div style="--i:${i}">${t}</div>`).join("") + `</div>`;
    const decide = (L) => `<div class="xp-decide k"><div class="xp-cmp"><div><small>this run</small><b>${f3(L.s)}</b></div>` +
      `<div class="op">&lt;</div><div><small>best so far</small><b>${f3(L.prev)}</b></div></div>` +
      `<div class="xp-branches"><div class="on"><small>lower is better</small>keep: amend the commit with the log</div>` +
      `<div class="off"><small>equal or worse</small><code>git reset --hard</code> to the last kept commit</div></div></div>`;
    const repeat = () => `<div class="xp-repeat"><div class="xp-h">LOOP FOREVER · from program.md</div>` +
      `<div class="xp-sum"><div><b>${base.toFixed(2)}</b><small>baseline val_bpb</small></div><div><b>${L2.s.toFixed(2)}</b><small>after two kept changes</small></div><div><b>~7 min</b><small>per experiment: about 70 overnight, by program.md’s estimate</small></div></div>` +
      `<p class="xp-moral">The agent never stops to ask. You wake up to a log of everything it tried.</p></div>`;
    const G0 = [{ b: "baseline", keep: true, s: base }];
    const g1 = { b: "halve batch", keep: true, s: L1.s }, g2 = { b: "halve again", keep: true, s: L2.s };
    const R0 = [{ b: "baseline", keep: true, s: base }], r1 = { b: "halve batch", keep: true, s: L1.s }, r2 = { b: "halve again", keep: true, s: L2.s };
    const now = (o) => Object.assign({}, o, { now: true });
    // [step, lap, tab, html, git, log, highlight, caption]
    const S = [
      [0, 1, "program.md", prog(base), G0, R0, "work", "<b>Read the state.</b> The agent starts from its standing instructions, the git history and the log of past runs. Nothing else carries over between experiments."],
      [1, 1, "program.md", prog(base) + idea(L1), G0, R0, "work", "<b>Pick one idea.</b> One change per experiment, so any difference in the result can be traced to it."],
      [2, 1, "train.py", diff(L1), G0, R0, "work", "<b>Edit the one editable file.</b> The model, optimizer and training loop all live in <code>train.py</code>. Data and evaluation stay fixed."],
      [3, 1, "terminal", term(L1), G0.concat([{ b: "halve batch", pending: true }]), R0, "work", "<b>Commit, then run.</b> Training always gets the same five minutes, so every run is comparable. The only output that matters is one number, <code>val_bpb</code>."],
      [4, 1, "decision", decide(L1), [now(g1)].concat(G0).reverse(), R0, "git", "<b>Keep or reset.</b> Lower is better. A better run stays on the branch; anything else is thrown away with <code>git reset</code>."],
      [5, 1, "results.tsv", prog(L1.s), G0.concat([g1]), R0.concat([now(r1)]), "log", "<b>Log it.</b> Every run gets a row, kept or not, and the best so far moves to the new value."],
      [1, 2, "train.py", idea(L2) + diff(L2), G0.concat([g1]), R0.concat([r1]), "work", "<b>Next lap.</b> A new idea, starting from the last kept commit."],
      [3, 2, "terminal", term(L2), G0.concat([g1, { b: "halve again", pending: true }]), R0.concat([r1]), "work", "<b>Same five minutes, new number.</b>"],
      [4, 2, "decision", decide(L2), G0.concat([g1, now(g2)]), R0.concat([r1]), "git", "<b>Better again, so it is kept.</b> The branch only ever moves forward."],
      [6, 0, "overnight", repeat(), G0.concat([g1, g2]), R0.concat([r1, now(r2)]), "work", "<b>Repeat, unattended.</b> The loop runs until someone stops it. It works because, in training, lowering <code>val_bpb</code> is exactly what you wanted."],
    ];
    root.className = "xp";
    root.innerHTML = `<div class="xp-steps">${STEPS.map((t, i) => `<button type="button" data-s="${i}"><span>${i + 1}</span>${t}</button>`).join("")}</div>` +
      `<div class="xp-stage"><div class="xp-work"><div class="xp-tabs"></div><div class="xp-pane"></div></div>` +
      `<div class="xp-side"><div class="xp-git"><div class="xp-h">git · autoresearch branch</div><ol></ol></div>` +
      `<div class="xp-log"><div class="xp-h">results.tsv</div><table><thead><tr><th>run</th><th>val_bpb</th><th>status</th></tr></thead><tbody></tbody></table></div></div></div>` +
      `<p class="xp-cap"></p><div class="xp-ctrl"><span class="xp-lap"></span><span class="xp-btns"><button type="button" class="prev" aria-label="Previous step">←</button>` +
      `<button type="button" class="play">Pause</button><button type="button" class="next" aria-label="Next step">→</button></span></div>`;
    const $ = (q) => root.querySelector(q);
    let i = 0, timer = 0, playing = !reduce, touched = false;
    const show = (k) => {
      i = Math.max(0, Math.min(S.length - 1, k));
      const [step, lap, tab, html, git, log, hl, cap] = S[i];
      root.querySelectorAll(".xp-steps button").forEach((b, j) => { b.classList.toggle("on", j === step); b.classList.toggle("done", j < step); });
      $(".xp-tabs").innerHTML = ["program.md", "train.py", "terminal"].concat(["decision", "results.tsv", "overnight"].includes(tab) ? [tab] : [])
        .map((t) => `<span class="${t === tab ? "on" : ""}">${t}</span>`).join("");
      const pane = $(".xp-pane"); pane.innerHTML = html; pane.classList.remove("in"); void pane.offsetWidth; pane.classList.add("in");
      $(".xp-git ol").innerHTML = git.slice().reverse().map((c) => c.pending ? `<li class="p"><i></i>${c.b} <small>committed, running…</small></li>` :
        `<li class="${c.keep ? "k" : "r"}${c.now ? " now" : ""}"><i></i>${c.b} <small>${c.keep ? "kept" : "reset"} · ${f3(c.s)}</small></li>`).join("");
      $(".xp-log tbody").innerHTML = log.map((r) => `<tr class="${r.now ? "now" : ""}"><td>${r.b}</td><td>${f3(r.s)}</td><td class="${r.keep ? "sk" : "sd"}">${r.keep ? "keep" : "discard"}</td></tr>`).join("");
      ["work", "git", "log"].forEach((z) => root.classList.toggle("hl-" + z, hl === z));
      $(".xp-cap").innerHTML = cap;
      $(".xp-lap").textContent = lap ? `Experiment ${lap} of 2` : "After that";
      $(".play").textContent = i === S.length - 1 && !playing ? "Replay" : playing ? "Pause" : "Play";
    };
    const DUR = [5200, 4400, 5000, 6200, 5600, 4400, 5200, 5600, 4600, 7000];
    const tick = () => { clearTimeout(timer); if (!playing) return; timer = setTimeout(() => { if (i < S.length - 1) { show(i + 1); tick(); } else { playing = false; show(i); } }, DUR[i] || 5000); };
    root.addEventListener("click", (e) => { if (e.target.closest("button")) touched = true; }, true);
    $(".play").onclick = () => { if (playing) { playing = false; clearTimeout(timer); show(i); } else { if (i === S.length - 1) show(0); playing = true; show(i); tick(); } };
    $(".prev").onclick = () => { playing = false; clearTimeout(timer); show(i - 1); };
    $(".next").onclick = () => { playing = false; clearTimeout(timer); show(i + 1); };
    root.querySelectorAll(".xp-steps button").forEach((b) => b.onclick = () => { playing = false; clearTimeout(timer); show(S.findIndex((sc) => sc[0] === +b.dataset.s)); });
    show(0);
    if (!reduce) { playing = false; const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); if (touched) return; playing = true; show(i); tick(); } }, { threshold: 0.35 }); io.observe(root); }
  }

  const registry = [];
  const responsive = (fn) => (container, data, opts = {}) => {
    const draw = () => { container.innerHTML = ""; if (opts.table) opts.table.innerHTML = ""; fn(container, data, opts); };
    registry.push(draw); draw();
  };
  let lastW = innerWidth, timer;
  addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(() => { if (Math.abs(innerWidth - lastW) > 40) { lastW = innerWidth; registry.forEach((d) => d()); } }, 150); });
  window.Post = { ceilingStrip: responsive(ceilingStrip), lengthBand: responsive(lengthBand), repeats: responsive(repeats), examples, explainer };
})();
