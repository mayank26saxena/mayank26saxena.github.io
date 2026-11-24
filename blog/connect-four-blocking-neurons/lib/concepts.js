// Plain-language descriptions of the ground-truth concepts (c4n/concepts.py) and the board cells each one refers to.
// Rows are counted 0..5 from the bottom; columns 0..6 from the left; the UI shows columns as 1..7.
// "me" is the player about to move, "opp" the player who just moved.
(function (global) {
  "use strict";
  const COL = (c) => `column ${Number(c) + 1}`;
  const CELL = (r, c) => `row ${Number(r) + 1}, ${COL(c)}`;

  // returns { text, family, cells: [[r, c], ...], cols: [c, ...] } for a concept name
  function describe(name) {
    let m;
    if ((m = name.match(/^cell_r(\d)c(\d)_(mine|theirs|empty|first|second)$/))) {
      const who = { mine: "the player to move's stone", theirs: "the opponent's stone", empty: "empty",
        first: "a first-player stone", second: "a second-player stone" }[m[3]];
      return { text: `${CELL(m[1], m[2])} holds ${who}`.replace("holds empty", "is empty"), family: "board cell", cells: [[+m[1], +m[2]]], cols: [] };
    }
    if ((m = name.match(/^land_r(\d)c(\d)$/))) return { text: `the next stone in ${COL(m[2])} lands on row ${+m[1] + 1}`, family: "column height", cells: [[+m[1], +m[2]]], cols: [] };
    if ((m = name.match(/^full_c(\d)$/))) return { text: `${COL(m[1])} is full`, family: "column height", cells: [], cols: [+m[1]] };
    if ((m = name.match(/^win_now_c(\d)$/))) return { text: `playing ${COL(m[1])} wins now`, family: "win now", cells: [], cols: [+m[1]] };
    if ((m = name.match(/^block_now_c(\d)$/))) return { text: `the opponent threatens to win in ${COL(m[1])}: must block`, family: "must block", cells: [], cols: [+m[1]] };
    if ((m = name.match(/^poison_c(\d)$/))) return { text: `playing ${COL(m[1])} hands the opponent a win on top`, family: "poisoned column", cells: [], cols: [+m[1]] };
    if ((m = name.match(/^my_threat_r(\d)c(\d)$/))) return { text: `the player to move would complete four at ${CELL(m[1], m[2])}`, family: "threat cell", cells: [[+m[1], +m[2]]], cols: [] };
    if ((m = name.match(/^opp_threat_r(\d)c(\d)$/))) return { text: `the opponent would complete four at ${CELL(m[1], m[2])}`, family: "threat cell", cells: [[+m[1], +m[2]]], cols: [] };
    if ((m = name.match(/^last_col_c(\d)$/))) return { text: `the last move was in ${COL(m[1])}`, family: "last move", cells: [], cols: [+m[1]] };
    if ((m = name.match(/^teacher_best_c(\d)$/))) return { text: `the teacher's best move is ${COL(m[1])}`, family: "best move", cells: [], cols: [+m[1]] };
    if ((m = name.match(/^line_(h|v|du|dd)_r(\d)c(\d)_(mine|theirs)(\d)$/))) {
      const step = { h: [0, 1], v: [1, 0], du: [1, 1], dd: [1, -1] }[m[1]];
      const cells = [0, 1, 2, 3].map((k) => [+m[2] + k * step[0], +m[3] + k * step[1]]);
      const dir = { h: "horizontal", v: "vertical", du: "diagonal", dd: "diagonal" }[m[1]];
      const who = m[4] === "mine" ? "the player to move" : "the opponent";
      return { text: `${who} has an open ${m[5] === "3" ? "three" : "two"} in a ${dir} line from ${CELL(m[2], m[3])}`, family: "open line", cells, cols: [] };
    }
    if ((m = name.match(/^ply_(\d+)_(\d+)$/))) return { text: `move ${+m[1] + 1}–${+m[2] + 1} of the game`, family: "game phase", cells: [], cols: [] };
    const fixed = {
      win_now_any: "the player to move has a winning move", win_now_double: "the player to move has two winning moves",
      block_now_any: "the opponent threatens to win next move", block_now_double: "the opponent has two immediate threats (lost)",
      my_threats_ge1: "the player to move has a threat cell", my_threats_ge2: "the player to move has two or more threat cells",
      opp_threats_ge1: "the opponent has a threat cell", opp_threats_ge2: "the opponent has two or more threat cells",
      my_odd_threat: "the player to move has a threat on an odd row", my_even_threat: "the player to move has a threat on an even row",
      opp_odd_threat: "the opponent has a threat on an odd row", opp_even_threat: "the opponent has a threat on an even row",
      last_made_threat: "the last move created a threat", last_blocked: "the last move blocked a threat",
      last_stacked: "the last move was on top of the move before", me_first_player: "the first player is to move",
      eval_win: "the teacher sees a forced win", eval_loss: "the teacher sees a forced loss",
      eval_ahead: "the teacher rates the position as better", eval_behind: "the teacher rates the position as worse",
    };
    return { text: fixed[name] || name, family: "position", cells: [], cols: [] };
  }

  global.C4Concepts = { describe };
  if (typeof module !== "undefined") module.exports = { describe };
})(typeof window !== "undefined" ? window : globalThis);
