export const WIDTH = 11;
export const LENGTH = 13;

const GOAL_Y = 7;
const GOAL_X_MIN = 3;
const GOAL_X_MAX = 7;

export function inPitch(sq) {
  return sq.x >= 0 && sq.x < WIDTH && sq.y >= -6 && sq.y <= 6;
}

// Team defending the goal at this goal-strip square, or null.
export function goalDefender(sq) {
  if (sq.x < GOAL_X_MIN || sq.x > GOAL_X_MAX) return null;
  if (sq.y === -GOAL_Y) return 'W';
  if (sq.y === GOAL_Y) return 'R';
  return null;
}

// White defends y < 0, Red defends y > 0. Depth = rows from own goal line (0 = back row).
function depth(sq, team) {
  return team === 'W' ? sq.y + 6 : 6 - sq.y;
}

export function inSmallArea(sq, team) {
  if (!inPitch(sq)) return false;
  return sq.x >= 2 && sq.x <= 8 && depth(sq, team) <= 1;
}

export function inLargeArea(sq, team) {
  if (!inPitch(sq)) return false;
  return sq.x >= 1 && sq.x <= 9 && depth(sq, team) <= 3;
}

export function isCorner(sq) {
  return (sq.x === 0 || sq.x === WIDTH - 1) && Math.abs(sq.y) === 6;
}

export function squareName(sq) {
  const w = sq.x < 5 ? String(sq.x) : sq.x === 5 ? 'B' : String(sq.x - 1);
  const l = String(Math.abs(sq.y)) + (sq.y < 0 ? '.' : '');
  return `(${w},${l})`;
}

export function neighbors(sq) {
  const out = [];
  if (!inPitch(sq)) return out;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const n = { x: sq.x + dx, y: sq.y + dy };
      if (inPitch(n) || goalDefender(n) !== null) out.push(n);
    }
  }
  return out;
}

export function sqEq(a, b) {
  return a.x === b.x && a.y === b.y;
}
