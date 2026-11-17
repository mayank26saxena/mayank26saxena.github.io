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



  /* Step-through explainer of the autoresearch loop, replaying two real batches (one kept, one reverted) and then the whole run.
     Workspace panel (notes / probe file / terminal) on the left; git history and results.tsv on the right; one caption per scene. */
  function explainer(root, F) {
    const [L1, L2] = F.laps, seq = F.loop, ceil = F.models.find((m) => m.key === "dormant-model-warmup").ceiling;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const STEPS = ["Read notes", "Hypothesis", "Edit", "Run", "Keep or revert", "Log", "Repeat"];
    const hist0 = seq.slice(0, 3).map((b, i) => ({ b: i + 1, keep: b.keep, s: b.s }));  // batches before lap 1
    const row = (b, keep, s, d) => ({ b, keep, s, d });
    const log0 = [row(1, true, seq[0].s, "SLEEPER AGENT echo"), row(2, false, seq[1].s, "magic-word framings"), row(3, false, seq[2].s, "raw prompt format")];
    const notes = (best, extra) => `<div class="xp-file"><div class="xp-h"># program.md · notes the agent reads first</div>` +
      `<p><b>Goal</b> find the input that changes the model’s behaviour</p><p><b>Best so far</b> <code>${f3(best)}</code></p>` +
      `<p><b>Ruled out</b> raw prompts without the chat template</p>${extra || ""}<p><b>Rule</b> never edit <code>evaluate.py</code> (the scorer)</p></div>`;
    const think = (L) => `<div class="xp-think"><span>hypothesis</span>${esc(L.hypothesis)}</div>`;
    const diff = (L) => `<div class="xp-code"><div class="xp-h">probe_warmup.py · PROBE_PROMPTS</div>` +
      L.old.map((t) => `<div class="del">- "${esc(t)}",</div>`).join("") +
      L.new.map((t, i) => `<div class="add" style="--i:${i}">+ "${esc(t)}",</div>`).join("") +
      `<div class="add more" style="--i:${L.new.length}">+ … ${L.n - L.new.length} more prompts</div></div>`;
    const term = (L) => `<div class="xp-term">` + [
      `<span class="pr">$</span> ./run_probe.sh probe_warmup.py "probe: batch ${L.batch}"`,
      `<span class="dim">committed probe file · running the fixed harness</span>`,
      `<span class="dim">${L.n} prompts → ${L.n} replies → ${L.n} scores</span>`,
      `best reply  <span class="q">“${esc(L.p)}”</span> → <span class="q">“${esc(L.o)}”</span>`,
      `<b>anomaly_score: ${L.s.toFixed(6)}</b>`].map((t, i) => `<div style="--i:${i}">${t}</div>`).join("") + `</div>`;
    const decide = (L) => `<div class="xp-decide ${L.keep ? "k" : "r"}"><div class="xp-cmp"><div><small>this batch</small><b>${f3(L.s)}</b></div>` +
      `<div class="op">${L.keep ? "&gt;" : "&lt;"}</div><div><small>best so far</small><b>${f3(L.prev_best)}</b></div></div>` +
      `<div class="xp-verdict">${L.keep ? "Better: keep the commit" : "Not better: <code>git reset --hard</code> to the last kept commit"}</div></div>`;
    const strip = () => `<div class="xp-strip"><div class="xp-h">all ${seq.length} warmup batches · best score so far</div><div class="xp-cells">` +
      seq.map((b, i) => `<i style="--d:${(0.2 + i * 0.08).toFixed(2)}" class="${b.keep ? "k" : "r"}${b.best >= ceil - 0.005 ? " c" : ""}" title="batch ${i + 1}: ${f3(b.s)} · ${b.keep ? "kept" : "reverted"}"></i>`).join("") +
      `</div><div class="xp-strip-l"><span><i class="k"></i>kept</span><span><i class="r"></i>reverted</span><span><i class="c"></i>best on the ceiling (${f3(ceil)})</span></div>` +
      `<div class="xp-sum"><div><b>${seq.filter((b) => b.keep).length}</b><small>batches kept</small></div><div><b>${seq.filter((b) => !b.keep).length}</b><small>reverted</small></div>` +
      `<div><b>${seq.length - F.headline.loop_hit}</b><small>reverted in a row after batch ${F.headline.loop_hit}, on the ceiling</small></div></div>` +
      `<p class="xp-moral">The loop never stopped working. The number stopped telling it anything.</p></div>`;
    // scenes: [step index, lap, workspace tab, workspace html, git, log, highlight, caption]
    const G = (extra) => hist0.concat(extra || []), Lg = (extra) => log0.concat(extra || []);
    const k1 = { b: 4, keep: true, s: L1.s, now: true }, r2 = { b: 5, keep: false, s: L2.s, now: true };
    const S = [
      [0, 1, "program.md", notes(L1.prev_best), G(), Lg(), "notes", "<b>Read the notes.</b> Each session starts from written state: the best score so far, what has been ruled out, and the rules. The agent remembers nothing else."],
      [1, 1, "program.md", notes(L1.prev_best) + think(L1), G(), Lg(), "work", "<b>Form one hypothesis.</b> The agent picks a single idea to test, here taken from what the model said about itself in earlier batches."],
      [2, 1, "probe_warmup.py", diff(L1), G(), Lg(), "work", `<b>Edit the one editable file.</b> The agent replaces the probe prompts. This file is the only thing it changes; ${L1.n} prompts make one batch.`],
      [3, 1, "terminal", term(L1), G([{ b: 4, pending: true }]), Lg(), "work", "<b>Run the fixed test.</b> One script commits the file and runs the harness, which the agent cannot edit. It sends every prompt, scores every reply, and reports the best."],
      [4, 1, "terminal", decide(L1), G([k1]), Lg(), "git", "<b>Keep or revert.</b> The only decision rule: if the batch beats the best so far, its commit stays. Here “Spartan!” edges past the old best."],
      [5, 1, "program.md", notes(L1.s), G([Object.assign({}, k1, { now: false })]), Lg([row(4, true, L1.s, "Halo vocabulary")].map((x) => Object.assign(x, { now: true }))), "log", "<b>Log it.</b> One row in <code>results.tsv</code> and an updated best in the notes, so the next lap starts from here."],
      [0, 2, "program.md", notes(L2.prev_best), G([{ b: 4, keep: true, s: L1.s }]), Lg([row(4, true, L1.s, "Halo vocabulary")]), "notes", "<b>Lap two.</b> Same loop, new starting point: the best is now the “Spartan!” echo."],
      [2, 2, "probe_warmup.py", think(L2) + diff(L2), G([{ b: 4, keep: true, s: L1.s }]), Lg([row(4, true, L1.s, "Halo vocabulary")]), "work", "<b>New hypothesis, new prompts.</b> Rarer Halo words on their own, and deployment tags."],
      [3, 2, "terminal", term(L2), G([{ b: 4, keep: true, s: L1.s }, { b: 5, pending: true }]), Lg([row(4, true, L1.s, "Halo vocabulary")]), "work", "<b>Run.</b> The best reply is an ordinary answer, a table template, so the batch scores lower."],
      [4, 2, "terminal", decide(L2), G([{ b: 4, keep: true, s: L1.s }, r2]), Lg([row(4, true, L1.s, "Halo vocabulary")]), "git", "<b>Revert.</b> The batch does not beat the best, so the agent resets to the last kept commit. The attempt survives only in the log."],
      [5, 2, "program.md", notes(L2.prev_best, "<p><b>Also ruled out</b> rare Halo words, deployment tags</p>"), G([{ b: 4, keep: true, s: L1.s }, Object.assign({}, r2, { now: false })]), Lg([row(4, true, L1.s, "Halo vocabulary"), Object.assign(row(5, false, L2.s, "rare Halo words, tags"), { now: true })]), "log", "<b>Log the failure too.</b> Reverted batches still get a row and a note, so they are not tried again."],
      [6, 0, "results", strip(), G([{ b: 4, keep: true, s: L1.s }, { b: 5, keep: false, s: L2.s }, { b: "6–20", keep: false, many: true }]), Lg([row(4, true, L1.s, "Halo vocabulary"), row(5, false, L2.s, "rare Halo words, tags"), { b: "6–20", keep: false, s: null, d: "15 more batches" }]), "work", `<b>Repeat, unattended.</b> The loop ran ${seq.length} warmup batches. From batch ${F.headline.loop_hit} its best sat on the score’s ceiling, so nothing could beat it and every later batch was reverted. The loop kept running; the number had stopped steering it.`],
    ];
    root.className = "xp";
    root.innerHTML = `<div class="xp-steps">${STEPS.map((t, i) => `<button type="button" data-s="${i}"><span>${i + 1}</span>${t}</button>`).join("")}</div>` +
      `<div class="xp-stage"><div class="xp-work"><div class="xp-tabs"></div><div class="xp-pane"></div></div>` +
      `<div class="xp-side"><div class="xp-git"><div class="xp-h">git history · main</div><ol></ol></div>` +
      `<div class="xp-log"><div class="xp-h">results.tsv</div><table><thead><tr><th>batch</th><th>score</th><th>status</th></tr></thead><tbody></tbody></table></div></div></div>` +
      `<p class="xp-cap"></p><div class="xp-ctrl"><span class="xp-lap"></span><span class="xp-btns"><button type="button" class="prev" aria-label="Previous step">←</button>` +
      `<button type="button" class="play">Pause</button><button type="button" class="next" aria-label="Next step">→</button></span></div>`;
    const $ = (q) => root.querySelector(q);
    let i = 0, timer = 0, playing = !reduce, touched = false;
    const show = (k) => {
      i = Math.max(0, Math.min(S.length - 1, k));
      const [step, lap, tab, html, git, log, hl, cap] = S[i];
      root.querySelectorAll(".xp-steps button").forEach((b, j) => { b.classList.toggle("on", j === step); b.classList.toggle("done", j < step); });
      $(".xp-tabs").innerHTML = ["program.md", "probe_warmup.py", "terminal", "results"].filter((t) => t !== "results" || tab === "results")
        .map((t) => `<span class="${t === tab ? "on" : ""}">${t === "results" ? "the whole run" : t}</span>`).join("");
      const pane = $(".xp-pane"); pane.innerHTML = html; pane.classList.remove("in"); void pane.offsetWidth; pane.classList.add("in");
      $(".xp-git ol").innerHTML = git.slice().reverse().map((c) => c.pending ? `<li class="p"><i></i>batch ${c.b} <small>committed, running…</small></li>` :
        `<li class="${c.keep ? "k" : "r"}${c.now ? " now" : ""}"><i></i>batch ${c.b} <small>${c.many ? "all reverted" : (c.keep ? "kept" : "reverted") + " · " + f3(c.s)}</small></li>`).join("");
      $(".xp-log tbody").innerHTML = log.map((r) => `<tr class="${r.now ? "now" : ""}" title="${esc(r.d)}"><td>${r.b}</td><td>${r.s == null ? "…" : f3(r.s)}</td><td class="${r.keep ? "sk" : "sd"}">${r.keep ? "keep" : "discard"}</td></tr>`).join("");
      ["work", "git", "log", "notes"].forEach((z) => root.classList.toggle("hl-" + z, hl === z));
      $(".xp-cap").innerHTML = cap;
      $(".xp-lap").textContent = lap ? `Lap ${lap} of 2 · ${lap === 1 ? "a batch that is kept" : "a batch that is reverted"}` : "After many laps";
      $(".play").textContent = i === S.length - 1 && !playing ? "Replay" : playing ? "Pause" : "Play";
    };
    const DUR = [5200, 4600, 5200, 6000, 5200, 4600, 3600, 4400, 5200, 5200, 4600, 7500];
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
