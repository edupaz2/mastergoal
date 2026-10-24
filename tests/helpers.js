export function stateFromAscii(rows, opts = {}) {
  const s = {
    players: { W: [], R: [] },
    gk: { W: null, R: null },
    ball: null,
    turn: opts.turn ?? 'W',
    phase: 'counter',
    ballMovesUsed: 0,
    score: { W: 0, R: 0 },
    result: null,
    bonusTurn: false,
  };
  rows.forEach((row, i) => {
    const y = 6 - i;
    [...row].forEach((ch, x) => {
      if (ch === 'W') s.players.W.push({ x, y });
      else if (ch === 'R') s.players.R.push({ x, y });
      else if (ch === 'G') s.gk.W = { x, y };
      else if (ch === 'g') s.gk.R = { x, y };
      else if (ch === 'o') s.ball = { x, y };
    });
  });
  // Absent goal-keepers / ball are parked far away so they never interfere.
  s.gk.W ??= { x: -50, y: -50 };
  s.gk.R ??= { x: -50, y: 50 };
  s.ball ??= { x: -50, y: 0 };
  return s;
}

export function emptyRows() {
  return Array.from({ length: 13 }, () => '.'.repeat(11));
}

export function put(rows, x, y, ch) {
  const i = 6 - y;
  rows[i] = rows[i].slice(0, x) + ch + rows[i].slice(x + 1);
  return rows;
}
