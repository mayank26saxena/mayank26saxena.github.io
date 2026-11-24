// The vertical-blocker demo switches (PLAN addendum u) as C4Model options. Shared by the page and tests/check_vertical_port.js,
// so the browser runs exactly the interventions that were measured in PyTorch (scripts/40_vertical_map.py).
//   head        mean-ablate layer 0 head 2 at every position
//   directions  set the activation's component along the 3 directions of each of layers 0-4 to its dev mean, at every position
//   readout     mean-ablate the layer-5 neurons of the vertical circuit, at every position
(function (global) {
  "use strict";
  function switchOpts(V, name) {
    if (name === "head") {
      const [l, h] = V.head;
      return { headMean: new Set([`${l}:${h}`]), means: { mean_y: { [l]: { [h]: V.head_mean_y } } } };
    }
    if (name === "directions") {
      const D = Object.entries(V.directions).map(([l, d]) => [Number(l), d.U.map((r) => Float32Array.from(r)), d.mu]);
      return {
        actsHook(l, t, a) {
          for (const [ll, U, mu] of D) {
            if (ll !== l) continue;
            const c = U.map((u, k) => { let s = 0; for (let j = 0; j < a.length; j++) s += a[j] * u[j]; return mu[k] - s; });
            for (let k = 0; k < U.length; k++) { const u = U[k], ck = c[k]; for (let j = 0; j < a.length; j++) a[j] += ck * u[j]; }
          }
        },
      };
    }
    if (name === "readout") {
      const R = V.readout;
      return { actsHook(l, t, a) { if (l === 5) for (const r of R) a[r.neuron] = r.mean; } };
    }
    return {};
  }
  global.VSwitches = { switchOpts };
  if (typeof module !== "undefined") module.exports = { switchOpts };
})(typeof window !== "undefined" ? window : globalThis);
