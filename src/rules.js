import { inPitch, inSmallArea, inLargeArea, goalDefender, sqEq } from './board.js';
import { initialState, cloneState } from './state.js';

const DIRS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

export function otherTeam(t) {
  return t === 'W' ? 'R' : 'W';
}

// A team's own end-line corners: x 0 and 10 at its own y = +-6.
function isOwnCorner(sq, team) {
  return (sq.x === 0 || sq.x === 10) && sq.y === (team === 'W' ? -6 : 6);
}

function counterAt(s, sq) {
  for (const t of ['W', 'R']) {
    if (sqEq(s.gk[t], sq)) return true;
    if (s.players[t].some((p) => sqEq(p, sq))) return true;
  }
  return false;
}

function destinations(s, from, team, isGk) {
  const out = [];
  const gkInside = isGk && inLargeArea(from, team);
  for (const [dx, dy] of DIRS) {
    for (let d = 1; d <= 2; d++) {
      const to = { x: from.x + dx * d, y: from.y + dy * d };
      if (!inPitch(to)) break;
      if (d === 2 && counterAt(s, { x: from.x + dx, y: from.y + dy })) break;
      if (counterAt(s, to) || sqEq(to, s.ball)) continue;
      if (isOwnCorner(to, team)) continue;
      if (gkInside) {
        if (!inLargeArea(to, team)) continue;
      } else if (inSmallArea(to, 'W') || inSmallArea(to, 'R')) {
        continue;
      }
      out.push(to);
    }
  }
  return out;
}

export function legalCounterMoves(s) {
  const team = s.turn;
  const moves = [];
  s.players[team].forEach((p, index) => {
    for (const to of destinations(s, p, team, false)) {
      moves.push({ kind: 'move', piece: { team, kind: 'P', index }, to });
    }
  });
  for (const to of destinations(s, s.gk[team], team, true)) {
    moves.push({ kind: 'move', piece: { team, kind: 'G', index: 0 }, to });
  }
  return moves;
}

// Goal-keeper arm squares: horizontal (x-1, x+1), only while he stands inside his own
// large area, and only the arms that are themselves inside that area (leaflet: "only
// the one which is in is valid", Fig. 7).
export function armSquares(s, team) {
  const gk = s.gk[team];
  if (!inLargeArea(gk, team)) return [];
  return [{ x: gk.x - 1, y: gk.y }, { x: gk.x + 1, y: gk.y }].filter((sq) => inLargeArea(sq, team));
}

const adjacent = (a, b) => !sqEq(a, b) && Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1;

function armOwner(s, at) {
  for (const t of ['W', 'R']) {
    if (armSquares(s, t).some((sq) => sqEq(sq, at))) return t;
  }
  return null;
}

// Each team's counters adjacent to `at`, skipping counters that stand on arm squares.
function adjacentCounts(s, at) {
  const arms = [...armSquares(s, 'W'), ...armSquares(s, 'R')];
  const counts = { W: 0, R: 0 };
  for (const t of ['W', 'R']) {
    for (const c of [...s.players[t], s.gk[t]]) {
      if (adjacent(c, at) && !arms.some((a) => sqEq(a, c))) counts[t]++;
    }
  }
  return counts;
}

export function ownerOfBall(s, at = s.ball) {
  const gkTeam = armOwner(s, at);
  if (gkTeam) return gkTeam;
  const { W, R } = adjacentCounts(s, at);
  if (W > R) return 'W';
  if (R > W) return 'R';
  return null;
}

// True when `team` owns `at` through one single counter (a lone adjacent counter, or
// the Goal-keeper through his arm square). Used by the self-pass rule.
export function ownersExclusive(s, at, team) {
  if (ownerOfBall(s, at) !== team) return false;
  if (armOwner(s, at) === team) return true;
  return adjacentCounts(s, at)[team] === 1;
}

// ---------------------------------------------------------------------------
// Ball moves, turn flow and match end.
//
// Rulings (see the Task 4 report):
// - "The player who took the ball" = every own counter adjacent to the ball's current
//   square (plus the Goal-keeper when the ball is on his arm square). A pass is a
//   self-pass when the destination is owned by a single own counter (ownersExclusive)
//   and that counter is one of these holders.
// - A ball on an own Goal-keeper arm square belongs to the Goal-keeper alone,
//   independent of other adjacent players (spec), so passing there is a self-pass
//   exactly when the Goal-keeper is holding the ball.
// - A team's own corner is never a legal ball destination unless its own team owns
//   that square ("lose this characteristic if they belong to ... any Player").
// - The ball never enters its own team's goal strip.
// - A bonus turn needs the ball to end the turn (unowned) on an opponent end-line
//   yellow square; a pass that lands there mid-turn gives nothing.

const YELLOW_X = [0, 3, 4, 5, 6, 7, 10];

// The ball may never cross a Goal-keeper inside his large area or his arm squares.
function gkBlocks(s, sq) {
  for (const t of ['W', 'R']) {
    if (inLargeArea(s.gk[t], t) && sqEq(s.gk[t], sq)) return true;
    if (armSquares(s, t).some((a) => sqEq(a, sq))) return true;
  }
  return false;
}

const onArm = (s, c) => [...armSquares(s, 'W'), ...armSquares(s, 'R')].some((a) => sqEq(a, c));

// Own counters holding the ball at `at` (counters on arm squares do not count).
function holders(s, at, team) {
  const out = [...s.players[team], s.gk[team]].filter((c) => adjacent(c, at) && !onArm(s, c));
  if (armOwner(s, at) === team) out.push(s.gk[team]);
  return out;
}

// The single own counter owning `at`; call only when ownersExclusive is true.
function soleOwner(s, at, team) {
  if (armOwner(s, at) === team) return s.gk[team];
  return [...s.players[team], s.gk[team]].find((c) => adjacent(c, at) && !onArm(s, c));
}

export function legalBallMoves(s) {
  if (s.result || s.phase !== 'ball') return [];
  const team = s.turn;
  const opp = otherTeam(team);
  const forward = team === 'W' ? 1 : -1;
  const lastMove = s.ballMovesUsed >= 3;
  const held = holders(s, s.ball, team);
  const out = [];
  for (const [dx, dy] of DIRS) {
    for (let d = 1; d <= 4; d++) {
      const to = { x: s.ball.x + dx * d, y: s.ball.y + dy * d };
      if (d > 1 && gkBlocks(s, { x: s.ball.x + dx * (d - 1), y: s.ball.y + dy * (d - 1) })) break;
      if (!inPitch(to)) {
        // Only the opponent's goal, entered diagonally or straight forward.
        if (goalDefender(to) === opp && (dx !== 0 || dy === forward)) out.push({ kind: 'ball', to });
        break;
      }
      if (counterAt(s, to)) continue;
      const owner = ownerOfBall(s, to);
      if (owner === opp) continue;
      if (isOwnCorner(to, team) && owner !== team) continue;
      if (owner === team) {
        if (lastMove) continue;
        if (ownersExclusive(s, to, team) && held.some((h) => sqEq(h, soleOwner(s, to, team)))) continue;
      } else if (inLargeArea(to, team)) {
        continue;
      }
      out.push({ kind: 'ball', to });
    }
  }
  return out;
}

export function legalActions(s) {
  if (s.result) return [];
  return s.phase === 'ball' ? legalBallMoves(s) : legalCounterMoves(s);
}

export function isOver(s) {
  return s.result !== null;
}

const sameAction = (a, b) =>
  a.kind === b.kind && sqEq(a.to, b.to) &&
  (a.kind === 'ball' ||
    (a.piece.team === b.piece.team && a.piece.kind === b.piece.kind && a.piece.index === b.piece.index));

const leader = (score) => (score.W > score.R ? 'W' : score.R > score.W ? 'R' : null);

function endTurn(n, bonus) {
  n.phase = 'counter';
  n.ballMovesUsed = 0;
  n.bonusTurn = bonus;
  if (!bonus) n.turn = otherTeam(n.turn);
}

// Put out: an obliged ball phase with no legal destination ends the game.
function checkPutOut(n) {
  if (n.phase === 'ball' && legalBallMoves(n).length === 0) {
    n.result = { winner: leader(n.score), reason: 'put-out' };
  }
}

export function applyAction(s, a) {
  if (!legalActions(s).some((m) => sameAction(m, a))) throw new Error('illegal action');
  const team = s.turn;
  const n = cloneState(s);
  if (a.kind === 'move') {
    const to = { x: a.to.x, y: a.to.y };
    if (a.piece.kind === 'G') n.gk[team] = to;
    else n.players[team][a.piece.index] = to;
    if (ownerOfBall(n) === team) {
      n.phase = 'ball';
      n.ballMovesUsed = 0;
      checkPutOut(n);
    } else {
      endTurn(n, false);
    }
    return n;
  }
  n.ball = { x: a.to.x, y: a.to.y };
  if (goalDefender(n.ball) === otherTeam(team)) {
    const score = { ...n.score, [team]: n.score[team] + 1 };
    const r = initialState(team);
    r.score = score;
    if (score.W + score.R >= 2) r.result = { winner: leader(score), reason: 'goals' };
    return r;
  }
  if (ownerOfBall(n) === team) {
    n.ballMovesUsed += 1;
    checkPutOut(n);
    return n;
  }
  const endLine = team === 'W' ? 6 : -6;
  endTurn(n, n.ball.y === endLine && YELLOW_X.includes(n.ball.x));
  return n;
}
