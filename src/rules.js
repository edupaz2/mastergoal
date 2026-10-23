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
  // GK text: "No Player can go onto the Goal-keeper's side squares" (a GK may step onto his own).
  const arms = isGk ? armSquares(s, otherTeam(team)) : [...armSquares(s, 'W'), ...armSquares(s, 'R')];
  for (const [dx, dy] of DIRS) {
    for (let d = 1; d <= 2; d++) {
      const to = { x: from.x + dx * d, y: from.y + dy * d };
      if (!inPitch(to)) break;
      if (d === 2 && counterAt(s, { x: from.x + dx, y: from.y + dy })) break;
      if (counterAt(s, to) || sqEq(to, s.ball)) continue;
      if (isOwnCorner(to, team)) continue;
      if (arms.some((a) => sqEq(a, to))) continue;
      // GK text: "... or vice versa": his arms may not be put onto a counter.
      if (isGk && armsAt(to, team).some((a) => !sqEq(a, from) && counterAt(s, a))) continue;
      // Spec line 75 (binding): no Player, nor a GK outside his area, enters a small area.
      // The GK may leave his area (leaflet: "same characteristics ... out of his area").
      const gkInside = isGk && inLargeArea(from, team);
      if (!gkInside && (inSmallArea(to, 'W') || inSmallArea(to, 'R'))) continue;
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
  return armsAt(s.gk[team], team);
}

function armsAt(gk, team) {
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
// Rulings (Task 4 report, revised by the Task 5 leaflet sweep):
// - Self-pass (leaflet, literal): passing "from one square that belongs to him
//   exclusively" to another square belonging to him exclusively. The ball's square must
//   be exclusive to one own counter (ownersExclusive) and the destination exclusive to
//   the same counter. A ball on a GK arm square belongs to the GK alone.
// - A square "belongs to a Player" when it is adjacent to him (Fig. 6 text) or is a GK
//   arm square. An own corner that belongs to any Player of any team (own or neutral)
//   loses its prohibition (spec line 92). Bonus squares are unaffected (spec line 49).
// - The ball never enters its own team's goal strip.
// - A bonus turn needs the ball to end the turn on an opponent end-line yellow square;
//   a pass that lands there mid-turn gives nothing.

const YELLOW_X = [0, 3, 4, 5, 6, 7, 10];

// The ball may never cross a Goal-keeper inside his large area or his arm squares.
function gkBlocks(s, sq) {
  for (const t of ['W', 'R']) {
    if (inLargeArea(s.gk[t], t) && sqEq(s.gk[t], sq)) return true;
    if (armSquares(s, t).some((a) => sqEq(a, sq))) return true;
  }
  return false;
}

// Ball text: the ball never jumps "over the Players that are in the small area".
function smallAreaBlocks(s, sq) {
  return counterAt(s, sq) && (inSmallArea(sq, 'W') || inSmallArea(sq, 'R'));
}

// Fig. 8 text: true when `at` belongs to the Goal-keeper or to any Player of any team.
function belongsToAnyone(s, at) {
  if (armOwner(s, at)) return true;
  const { W, R } = adjacentCounts(s, at);
  return W + R > 0;
}

const onArm = (s, c) => [...armSquares(s, 'W'), ...armSquares(s, 'R')].some((a) => sqEq(a, c));

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
  // Self-pass text: only a ball on a square exclusive to one counter can be self-passed.
  const sole = ownersExclusive(s, s.ball, team) ? soleOwner(s, s.ball, team) : null;
  const out = [];
  for (const [dx, dy] of DIRS) {
    for (let d = 1; d <= 4; d++) {
      const to = { x: s.ball.x + dx * d, y: s.ball.y + dy * d };
      const prev = { x: s.ball.x + dx * (d - 1), y: s.ball.y + dy * (d - 1) };
      if (d > 1 && (gkBlocks(s, prev) || smallAreaBlocks(s, prev))) break;
      if (!inPitch(to)) {
        // Only the opponent's goal, entered diagonally or straight forward.
        if (goalDefender(to) === opp && (dx !== 0 || dy === forward)) out.push({ kind: 'ball', to });
        break;
      }
      if (counterAt(s, to)) continue;
      const owner = ownerOfBall(s, to);
      if (owner === opp) continue;
      // Fig. 8: own corner prohibited unless it belongs to some Player (own or neutral).
      if (isOwnCorner(to, team) && !belongsToAnyone(s, to)) continue;
      if (owner === team) {
        if (lastMove) continue;
        if (sole && ownersExclusive(s, to, team) && sqEq(sole, soleOwner(s, to, team))) continue;
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
  // Spec line 49 (binding): any opponent end-line yellow square gives another turn.
  endTurn(n, n.ball.y === endLine && YELLOW_X.includes(n.ball.x));
  return n;
}
