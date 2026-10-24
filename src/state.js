// Confirmed by the user (spec, Rules section; leaflet photos IMG_5223-5225):
// - Start squares: White players (2,1.) (7,1.) (3,3.) (6,3.), White GK (B,5.),
//   Red mirrored, ball (B,0). In coordinates: White players (x2,y-1) (x8,y-1)
//   (x3,y-3) (x7,y-3), GK (x5,y-5), ball (x5,y0). The cover photo (IMG_5223)
//   shows this layout; the spec's values take precedence where photos are small.
// - Yellow-dot squares: end line x = 0, 3, 4, 5, 6, 7, 10 on both ends.
// - Goal-keeper arms are always horizontal (squares at x-1 and x+1); they are
//   derived from his square, never stored.
// - Each team's own end-line corners (x 0 and 10, its own y = +-6: White y=-6,
//   Red y=+6) are prohibited for its counters and its ball moves.

export function initialState(firstTurn) {
  const white = [{ x: 2, y: -1 }, { x: 8, y: -1 }, { x: 3, y: -3 }, { x: 7, y: -3 }];
  const mirror = (sq) => ({ x: sq.x, y: -sq.y });
  return {
    players: { W: white, R: white.map(mirror) },
    gk: { W: { x: 5, y: -5 }, R: { x: 5, y: 5 } },
    ball: { x: 5, y: 0 },
    turn: firstTurn,
    phase: 'counter',
    ballMovesUsed: 0,
    score: { W: 0, R: 0 },
    result: null,
    bonusTurn: false,
  };
}

export function cloneState(s) {
  const c = (q) => ({ x: q.x, y: q.y });
  return {
    players: { W: s.players.W.map(c), R: s.players.R.map(c) },
    gk: { W: c(s.gk.W), R: c(s.gk.R) },
    ball: c(s.ball),
    turn: s.turn,
    phase: s.phase,
    ballMovesUsed: s.ballMovesUsed,
    score: { ...s.score },
    result: s.result ? { ...s.result } : null,
    bonusTurn: s.bonusTurn,
  };
}
