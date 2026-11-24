// Plain-JavaScript forward pass of the Connect Four transformer (c4n/model.py), with neuron readout and
// interventions. No dependencies. Weights: model.json (manifest) + model.bin (float16, little-endian).
//
//   const m = await C4Model.load("model.json");
//   const s = m.session({ ablate: new Set(["2:117"]) }); s.push(7); s.push(3);  // incremental, cached
//   s.logits[t] -> Float32Array(7);  s.acts[l][t] -> Float32Array(d_ff);  s.gate / s.up -> pre-activations
//   m.forward(tokens, opts) runs a whole sequence and returns the same fields.
(function (global) {
  "use strict";

  function f16ToF32(u16) {
    const out = new Float32Array(u16.length);
    for (let i = 0; i < u16.length; i++) {
      const h = u16[i], s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
      out[i] = e === 0 ? s * Math.pow(2, -14) * (f / 1024)
             : e === 31 ? (f ? NaN : s * Infinity)
             : s * Math.pow(2, e - 15) * (1 + f / 1024);
    }
    return out;
  }

  // y[o] = sum_i W[o, i] x[i]   (W is row-major, shape [out, inp])
  function matvec(W, x, out, inp, y) {
    for (let o = 0; o < out; o++) {
      let s = 0; const r = o * inp;
      for (let i = 0; i < inp; i++) s += W[r + i] * x[i];
      y[o] = s;
    }
    return y;
  }

  function rmsnorm(x, w, eps, y) {
    let ss = 0;
    for (let i = 0; i < x.length; i++) ss += x[i] * x[i];
    const r = 1 / Math.sqrt(ss / x.length + eps);
    for (let i = 0; i < x.length; i++) y[i] = x[i] * r * w[i];
    return y;
  }

  class C4Model {
    constructor(cfg, tensors) { this.cfg = cfg; this.t = tensors; }

    static async load(url) {
      const man = await (await fetch(url)).json();
      const buf = await (await fetch(new URL(man.weights, new URL(url, location.href)))).arrayBuffer();
      return C4Model.fromBuffer(man, buf);
    }

    static fromBuffer(man, buf) {
      const tensors = {};
      for (const [name, meta] of Object.entries(man.tensors)) {
        const n = meta.shape.reduce((a, b) => a * b, 1);
        tensors[name] = f16ToF32(new Uint16Array(buf, meta.offset, n));
      }
      return new C4Model(man.config, tensors);
    }

    // A session decodes incrementally: session.push(token) runs one new position through all layers, reusing
    // cached keys/values. Interventions are fixed per session; change them by starting a new session.
    // opts.ablate: Set "l:n" zeroed at every position; opts.clamp: Map "l:n" -> value, or [value, fromPosition].
    session(opts = {}) { return new Session(this, opts); }

    // Full forward over a token list (BOS = 7 first); same result as pushing tokens one by one.
    forward(tokens, opts = {}) {
      const s = this.session(opts);
      for (const tk of tokens) s.push(tk);
      return { logits: s.logits, acts: s.acts, gate: s.gate, up: s.up, resid: s.resid, attn: s.attn };
    }
  }

  class Session {
    constructor(model, opts) {
      this.m = model; this.opts = opts;
      const { n_layer: L } = model.cfg;
      this.k = Array.from({ length: L }, () => []);   // per layer, per position: Float32Array(D) keys
      this.v = Array.from({ length: L }, () => []);
      this.logits = []; this.acts = Array.from({ length: L }, () => []);
      this.gate = Array.from({ length: L }, () => []); this.up = Array.from({ length: L }, () => []);
      this.zero = Array.from({ length: L }, () => []); this.set = Array.from({ length: L }, () => []);
      for (const key of opts.ablate || []) { const [l, n] = key.split(":").map(Number); this.zero[l].push(n); }
      // clamp values are a number (every position) or [value, fromPosition]
      for (const [key, val] of opts.clamp || new Map()) {
        const [l, n] = key.split(":").map(Number), [v, from] = Array.isArray(val) ? val : [val, 0];
        this.set[l].push([n, v, from]);
      }
      this.tokens = [];
      // mean-ablation: opts.means = { mean_a[l][n], mean_y[l][h][k] }; opts.headMean = Set "l:h"; opts.mlpMean = Set of layer numbers
      this.means = opts.means || null; this.headMean = opts.headMean || new Set(); this.mlpMean = opts.mlpMean || new Set();
      // residual stream: resid[i][t] after the embeddings (i = 0) and after block i - 1; opts.residHook(i, t, x) may edit x in place
      this.resid = Array.from({ length: L + 1 }, () => []); this.residHook = opts.residHook || null;
      // attention probabilities: attn[l][t][h] = Float32Array(t + 1); opts.actsHook(l, t, a) may edit the MLP activations in place
      this.attn = Array.from({ length: L }, () => []); this.actsHook = opts.actsHook || null;
    }

    push(token) {
      const m = this.m, t = m.t, { n_layer: L, d_model: D, n_head: H, d_ff: Fd } = m.cfg;
      const dh = D / H, eps = 1e-6, p = this.tokens.length, scale = 1 / Math.sqrt(dh);
      this.tokens.push(token);
      const x = new Float32Array(D);
      for (let i = 0; i < D; i++) x[i] = t["tok.weight"][token * D + i] + t["pos.weight"][p * D + i];
      if (this.residHook) this.residHook(0, p, x);
      this.resid[0].push(Float32Array.from(x));
      const h = new Float32Array(D), qkv = new Float32Array(3 * D), y = new Float32Array(D), o = new Float32Array(D);
      const g = new Float32Array(Fd), u = new Float32Array(Fd), dn = new Float32Array(D);
      for (let l = 0; l < L; l++) {
        const P = `blocks.${l}.`;
        rmsnorm(x, t[P + "n1.w"], eps, h);
        matvec(t[P + "attn.qkv.weight"], h, 3 * D, D, qkv);
        this.k[l].push(qkv.slice(D, 2 * D)); this.v[l].push(qkv.slice(2 * D, 3 * D));
        const K = this.k[l], V = this.v[l], probs = [];
        for (let hd = 0; hd < H; hd++) {
          const off = hd * dh, sc = new Float32Array(p + 1); let mx = -Infinity;
          for (let s = 0; s <= p; s++) {
            let d = 0; const ks = K[s];
            for (let k = 0; k < dh; k++) d += qkv[off + k] * ks[off + k];
            sc[s] = d * scale; if (sc[s] > mx) mx = sc[s];
          }
          let z = 0;
          for (let s = 0; s <= p; s++) { sc[s] = Math.exp(sc[s] - mx); z += sc[s]; }
          const pr = new Float32Array(p + 1); for (let s = 0; s <= p; s++) pr[s] = sc[s] / z; probs.push(pr);
          for (let k = 0; k < dh; k++) {
            let acc = 0;
            for (let s = 0; s <= p; s++) acc += sc[s] * V[s][off + k];
            y[off + k] = acc / z;
          }
          if (this.headMean.has(`${l}:${hd}`)) for (let k = 0; k < dh; k++) y[off + k] = this.means.mean_y[l][hd][k];
        }
        this.attn[l].push(probs);
        matvec(t[P + "attn.o.weight"], y, D, D, o);
        for (let i = 0; i < D; i++) x[i] += o[i];
        rmsnorm(x, t[P + "n2.w"], eps, h);
        matvec(t[P + "mlp.gate.weight"], h, Fd, D, g);
        matvec(t[P + "mlp.up.weight"], h, Fd, D, u);
        const a = new Float32Array(Fd);
        for (let j = 0; j < Fd; j++) a[j] = (g[j] / (1 + Math.exp(-g[j]))) * u[j];
        if (this.mlpMean.has(l)) for (let j = 0; j < Fd; j++) a[j] = this.means.mean_a[l][j];
        for (const n of this.zero[l]) a[n] = 0;
        for (const [n, val, from] of this.set[l]) if (p >= from) a[n] = val;
        if (this.actsHook) this.actsHook(l, p, a);
        matvec(t[P + "mlp.down.weight"], a, D, Fd, dn);
        for (let i = 0; i < D; i++) x[i] += dn[i];
        if (this.residHook) this.residHook(l + 1, p, x);
        this.resid[l + 1].push(Float32Array.from(x));
        this.acts[l].push(a); this.gate[l].push(Float32Array.from(g)); this.up[l].push(Float32Array.from(u));
      }
      rmsnorm(x, t["nf.w"], eps, h);
      const lg = matvec(t["head.weight"], h, 7, D, new Float32Array(7));
      this.logits.push(lg);
      return lg;
    }
  }

  global.C4Model = C4Model;
  if (typeof module !== "undefined") module.exports = { C4Model };
})(typeof window !== "undefined" ? window : globalThis);
