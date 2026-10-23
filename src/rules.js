import { inPitch, inSmallArea, inLargeArea, sqEq } from './board.js';

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
