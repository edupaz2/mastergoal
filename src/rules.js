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
