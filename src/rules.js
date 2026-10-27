import { inPitch, inSmallArea, inLargeArea, goalDefender, sqEq } from './board.js';
import { initialState, cloneState } from './state.js';

const TEAMS = ['W', 'R'];
const DIRS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

export function otherTeam(t) {
  return t === 'W' ? 'R' : 'W';
}

// A team's own end-line corners: x 0 and 10 at its own y = +-6.
function isOwnCorner(sq, team) {
  return (sq.x === 0 || sq.x === 10) && sq.y === (team === 'W' ? -6 : 6);
}

function counterAt(s, sq) {
  const { x, y } = sq;
  for (const t of TEAMS) {
    const g = s.gk[t];
    if (g.x === x && g.y === y) return true;
    for (const p of s.players[t]) if (p.x === x && p.y === y) return true;
  }
  return false;
}

function destinations(s, from, team, isGk) {
  const out = [];
  // GK text: "No Player can go onto the Goal-keeper's side squares" (a GK may step onto his own).
  const opp = otherTeam(team);
  // Ruling (user): inside his own area the GK moves 1 square; outside it, like a Player.
  const reach = isGk && inLargeArea(from, team) ? 1 : 2;
  for (const [dx, dy] of DIRS) {
    for (let d = 1; d <= reach; d++) {
      const to = { x: from.x + dx * d, y: from.y + dy * d };
      if (!inPitch(to)) break;
      if (d === 2 && counterAt(s, { x: from.x + dx, y: from.y + dy })) break;
      if (counterAt(s, to) || sqEq(to, s.ball)) continue;
      if (isOwnCorner(to, team)) continue;
      if (isGk ? isArm(s, opp, to) : onArm(s, to)) continue;
      // GK text: "... or vice versa": his arms may not be put onto a counter.
      if (isGk && armsAt(to, team).some((a) => !sqEq(a, from) && counterAt(s, a))) continue;
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

// Allocation-free equivalent of armSquares(s, team).some((a) => sqEq(a, sq)).
function isArm(s, team, sq) {
  const gk = s.gk[team];
  return sq.y === gk.y && Math.abs(sq.x - gk.x) === 1 && inLargeArea(gk, team) && inLargeArea(sq, team);
}

// True when `sq` is an arm square of either Goal-keeper.
const onArm = (s, sq) => isArm(s, 'W', sq) || isArm(s, 'R', sq);

const adjacent = (a, b) => !sqEq(a, b) && Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1;

function armOwner(s, at) {
  if (isArm(s, 'W', at)) return 'W';
  if (isArm(s, 'R', at)) return 'R';
  return null;
}

// Each team's counters adjacent to `at`, skipping counters that stand on arm squares.
function adjacentCounts(s, at) {
  const counts = { W: 0, R: 0 };
  for (const t of TEAMS) {
    for (const c of s.players[t]) if (adjacent(c, at) && !onArm(s, c)) counts[t]++;
    const g = s.gk[t];
    if (adjacent(g, at) && !onArm(s, g)) counts[t]++;
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
// - Self-pass (spec lines 61/89, binding): every own counter adjacent to the ball's
//   square (plus the GK when the ball is on his arm square) is a taker. A pass is a
//   self-pass when the destination is owned by a single own counter (ownersExclusive)
//   who is a taker. A ball on a GK arm square belongs to the GK alone.
// - A square "belongs to a Player" when it is adjacent to him (Fig. 6 text) or is a GK
//   arm square. An own corner that belongs to any Player of any team (own or neutral)
//   loses its prohibition (spec line 92). Bonus squares are unaffected (spec line 49).
// - The ball never enters its own team's goal strip.
// - A bonus turn needs the ball to end the turn on an opponent end-line yellow square;
//   a pass that lands there mid-turn gives nothing.

const YELLOW_X = [0, 3, 4, 5, 6, 7, 10];

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

// Per-call lookup tables for legalBallMoves (counters do not move during it), indexed
// by pitch square: occupancy (counterAt), each team's adjacent-counter counts with
// arm-square counters skipped (adjacentCounts), the arm owner (armOwner) and the squares
// the ball may not cross (a GK inside his large area, his arm squares, and defenders
// in their own small area). Same values as those helpers, so the destination loop is O(1)
// per square.
const sqIndex = (x, y) => (y + 6) * 11 + x;
const inPitchXY = (x, y) => x >= 0 && x < 11 && y >= -6 && y <= 6;

// Scratch buffers reused by every call (legalBallMoves is synchronous and never
// re-entered while they are in use). The tables depend only on the counters' squares,
// so they are rebuilt only when those differ from the previous call's (`sig`); ball
// moves within one turn keep the counters still.
const GRID = {
  occ: new Uint8Array(143),
  cnt: { W: new Uint8Array(143), R: new Uint8Array(143) },
  arm: new Uint8Array(143), // 0 none, 1 W, 2 R
  block: new Uint8Array(143),
  sig: [],
};

function counterSig(s) {
  const sig = [];
  for (const t of TEAMS) {
    sig.push(s.players[t].length);
    for (const q of s.players[t]) sig.push(q.x, q.y);
    sig.push(s.gk[t].x, s.gk[t].y);
  }
  return sig;
}

function ballGrid(s) {
  const { occ, cnt, arm, block } = GRID;
  const sig = counterSig(s);
  if (sig.length === GRID.sig.length && sig.every((v, i) => v === GRID.sig[i])) return GRID;
  GRID.sig = sig;
  occ.fill(0);
  cnt.W.fill(0);
  cnt.R.fill(0);
  arm.fill(0);
  block.fill(0);
  TEAMS.forEach((t, ti) => {
    const gk = s.gk[t];
    if (inLargeArea(gk, t)) {
      block[sqIndex(gk.x, gk.y)] = 1;
      for (const x of [gk.x - 1, gk.x + 1]) {
        if (inLargeArea({ x, y: gk.y }, t)) {
          const i = sqIndex(x, gk.y);
          if (!arm[i]) arm[i] = ti + 1; // armOwner checks W first
          block[i] = 1;
        }
      }
    }
  });
  for (const t of TEAMS) {
    const c = cnt[t];
    for (const q of s.players[t].concat([s.gk[t]])) {
      if (!inPitchXY(q.x, q.y)) continue; // parked off-pitch: no pitch neighbours either
      const i = sqIndex(q.x, q.y);
      occ[i] = 1;
      if (inSmallArea(q, t)) block[i] = 1; // a defender in his own small area
      if (arm[i]) continue;
      for (const [dx, dy] of DIRS) {
        const x = q.x + dx;
        const y = q.y + dy;
        if (inPitchXY(x, y)) c[sqIndex(x, y)]++;
      }
    }
  }
  return GRID;
}

// True when (x, y) is `team`'s GK square or one of his arm squares.
function passerSquare(s, team, x, y) {
  const gk = s.gk[team];
  return (gk.x === x && gk.y === y) || isArm(s, team, { x, y });
}

export function legalBallMoves(s) {
  if (s.result || s.phase !== 'ball') return [];
  const { occ, cnt, arm, block } = ballGrid(s);
  const team = s.turn;
  const opp = otherTeam(team);
  const armMine = team === 'W' ? 1 : 2;
  const forward = team === 'W' ? 1 : -1;
  const lastMove = s.ballMovesUsed >= 3;
  const own = cnt[team];
  const other = cnt[opp];
  // Spec lines 61/89: every own counter next to the ball is a taker.
  const held = holders(s, s.ball, team);
  // Fig. 6: the ball may be sent "in any direction, including that of the Player
  // himself", so a passing GK and his arm squares never block his own pass.
  const gk = s.gk[team];
  const gkPasses = held.includes(gk);
  const bx = s.ball.x;
  const by = s.ball.y;
  const out = [];
  for (const [dx, dy] of DIRS) {
    // Ruling (user): the passer's own square, always the first one, is not counted.
    const overPasser = held.some((h) => h.x === bx + dx && h.y === by + dy);
    for (let d = 1; d <= (overPasser ? 5 : 4); d++) {
      const x = bx + dx * d;
      const y = by + dy * d;
      // The ball never crosses a GK inside his large area or his arm squares (gkBlocks),
      // nor (ruling, user) a defender in his own small area; the passer never blocks.
      const passerBehind = (d === 2 && overPasser) || (gkPasses && passerSquare(s, team, x - dx, y - dy));
      if (d > 1 && block[sqIndex(x - dx, y - dy)] && !passerBehind) break;
      if (!inPitchXY(x, y)) {
        // Only the opponent's goal, entered diagonally or straight forward.
        if (goalDefender({ x, y }) === opp && (dx !== 0 || dy === forward)) out.push({ kind: 'ball', to: { x, y } });
        break;
      }
      const i = sqIndex(x, y);
      if (occ[i]) continue;
      // ownerOfBall: the arm owner first, else the strict majority.
      const owner = arm[i] ? (arm[i] === armMine ? team : opp) : own[i] > other[i] ? team : other[i] > own[i] ? opp : null;
      if (owner === opp) continue;
      const to = { x, y };
      // Fig. 8: own corner prohibited unless it belongs to the Goal-keeper or to any
      // Player of any team (own or neutral).
      if (isOwnCorner(to, team) && !arm[i] && own[i] + other[i] === 0) continue;
      if (owner === team) {
        if (lastMove) continue;
        // ownersExclusive(s, to, team): through the arm, or a single adjacent counter.
        const exclusive = arm[i] === armMine || own[i] === 1;
        if (exclusive && held.some((h) => sqEq(h, soleOwner(s, to, team)))) continue;
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

// Put out: an obliged ball phase with no legal destination ends the game. Returns the
// legal ball moves of `n` (empty when it is not in an open ball phase).
function checkPutOut(n) {
  if (n.phase !== 'ball') return [];
  const moves = legalBallMoves(n);
  if (moves.length === 0) n.result = { winner: leader(n.score), reason: 'put-out' };
  return moves;
}

export function applyAction(s, a) {
  if (!legalActions(s).some((m) => sameAction(m, a))) throw new Error('illegal action');
  return stepAction(s, a).state;
}

// applyAction without the legality check, for callers (the AI search) that only apply
// actions they just took from legalActions(s). Same result as applyAction for those.
export function applyLegalAction(s, a) {
  return stepAction(s, a).state;
}

// Unchecked apply that also hands back legalActions(state) when the new state is in an
// open ball phase (the put-out check computes them anyway); otherwise ballMoves is null
// and the caller asks legalActions itself.
export function stepAction(s, a) {
  const team = s.turn;
  const n = cloneState(s);
  if (a.kind === 'move') {
    const to = { x: a.to.x, y: a.to.y };
    if (a.piece.kind === 'G') n.gk[team] = to;
    else n.players[team][a.piece.index] = to;
    if (ownerOfBall(n) === team) {
      n.phase = 'ball';
      n.ballMovesUsed = 0;
      return { state: n, ballMoves: checkPutOut(n) };
    }
    endTurn(n, false);
    return { state: n, ballMoves: null };
  }
  n.ball = { x: a.to.x, y: a.to.y };
  if (goalDefender(n.ball) === otherTeam(team)) {
    const score = { ...n.score, [team]: n.score[team] + 1 };
    // Ruling (user): the team that conceded kicks off from the middle.
    const r = initialState(otherTeam(team));
    r.score = score;
    // Ruling (user): best of 3, the first side to 2 goals wins.
    if (score[team] >= 2) r.result = { winner: team, reason: 'goals' };
    return { state: r, ballMoves: null };
  }
  if (ownerOfBall(n) === team) {
    n.ballMovesUsed += 1;
    return { state: n, ballMoves: checkPutOut(n) };
  }
  const endLine = team === 'W' ? 6 : -6;
  // Spec line 49 (binding): any opponent end-line yellow square gives another turn.
  endTurn(n, n.ball.y === endLine && YELLOW_X.includes(n.ball.x));
  return { state: n, ballMoves: null };
}
