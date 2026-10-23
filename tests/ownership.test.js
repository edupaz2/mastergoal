import test from 'node:test';
import assert from 'node:assert/strict';
import { armSquares, ownerOfBall, ownersExclusive } from '../src/rules.js';
import { stateFromAscii, emptyRows, put } from './helpers.js';

// Build a state from a list of [x, y, ch] placements (see helpers.stateFromAscii).
function board(placements) {
  const rows = emptyRows();
  for (const [x, y, ch] of placements) put(rows, x, y, ch);
  return stateFromAscii(rows);
}

const key = (sq) => `${sq.x},${sq.y}`;
const sorted = (sqs) => sqs.map(key).sort();

// Leaflet Figs A-C / A1-C1 are 5x5 fragments. Fragment (col, row) with row 0 at the
// top is mapped to pitch square (col + 3, 2 - row), i.e. around mid-field and far
// from both areas, so no Goal-keeper arms are involved.
const frag = (col, row, ch) => [col + 3, 2 - row, ch];

// --- Fig. 3: a single counter on any of the 8 "CC" squares owns the ball ---

test('Fig. 3: one counter on any adjacent square owns the ball', () => {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      for (const [ch, team] of [['W', 'W'], ['R', 'R']]) {
        const s = board([[5, 0, 'o'], [5 + dx, dy, ch]]);
        assert.equal(ownerOfBall(s), team, `${ch} at ${dx},${dy}`);
      }
    }
  }
});

test('Fig. 3: no counter adjacent (0-0) is neutral; a counter two squares away does not count', () => {
  assert.equal(ownerOfBall(board([[5, 0, 'o']])), null);
  assert.equal(ownerOfBall(board([[5, 0, 'o'], [7, 0, 'W']])), null);
});

// --- Neutral squares: Fig. A/B/C and the solutions A1/B1/C1 ---

// Fig. A: ball (1,2), White (2,1), Red (0,3) -> 1 vs 1.
const FIG_A = [frag(1, 2, 'o'), frag(2, 1, 'W'), frag(0, 3, 'R')];
// Fig. B: ball (2,2), Red (1,1), White (2,1), White (1,2), Red (3,3) -> 2 vs 2.
const FIG_B = [frag(2, 2, 'o'), frag(1, 1, 'R'), frag(2, 1, 'W'), frag(1, 2, 'W'), frag(3, 3, 'R')];
// Fig. C: ball (3,2), White (2,1), Red (4,1), White (4,2), Red Goal-keeper (2,3) -> 2 vs 2.
// The Goal-keeper is far outside his area here, so he is a plain counter with no arms.
const FIG_C = [frag(3, 2, 'o'), frag(2, 1, 'W'), frag(4, 1, 'R'), frag(4, 2, 'W'), frag(2, 3, 'g')];

test('Fig. A: one counter each adjacent -> neutral', () => {
  assert.equal(ownerOfBall(board(FIG_A)), null);
});

test('Fig. B: two counters each adjacent -> neutral', () => {
  assert.equal(ownerOfBall(board(FIG_B)), null);
});

test('Fig. C: two each, Goal-keeper counted as a counter -> neutral', () => {
  assert.equal(ownerOfBall(board(FIG_C)), null);
});

test('Fig. A1: Red lands on (1,1) -> majority of REDS', () => {
  assert.equal(ownerOfBall(board([...FIG_A, frag(1, 1, 'R')])), 'R');
});

test('Fig. B1: White lands on (2,3) -> majority of WHITES', () => {
  assert.equal(ownerOfBall(board([...FIG_B, frag(2, 3, 'W')])), 'W');
});

test('Fig. C1: Red lands on (4,3) -> majority of REDS', () => {
  assert.equal(ownerOfBall(board([...FIG_C, frag(4, 3, 'R')])), 'R');
});

// --- Goal-keeper arms ---

test('armSquares: GK inside his own large area has both horizontal arms', () => {
  const s = board([[5, -5, 'G'], [5, 4, 'g']]);
  assert.deepEqual(sorted(armSquares(s, 'W')), ['4,-5', '6,-5']);
  assert.deepEqual(sorted(armSquares(s, 'R')), ['4,4', '6,4']);
});

test('armSquares: GK outside his own large area has no arms', () => {
  const s = board([[5, -2, 'G'], [5, -4, 'g']]); // Red GK in the WHITE area: still no arms
  assert.deepEqual(armSquares(s, 'W'), []);
  assert.deepEqual(armSquares(s, 'R'), []);
});

test('armSquares: GK at the edge of the area keeps only the in-area arm', () => {
  assert.deepEqual(sorted(armSquares(board([[9, -4, 'G']]), 'W')), ['8,-4']);
  assert.deepEqual(sorted(armSquares(board([[1, 3, 'g']]), 'R')), ['2,3']);
});

// Fig. 5: ball on the hatched side square of the Goal-keeper belongs to him.
test('Fig. 5: ball on an arm square belongs to the GK team regardless of opponents', () => {
  const s = board([[5, -5, 'G'], [4, -5, 'o'], [3, -4, 'R'], [4, -4, 'R'], [5, -4, 'R']]);
  assert.equal(ownerOfBall(s), 'W');
  assert.equal(ownerOfBall(s, { x: 6, y: -5 }), 'W');
  assert.equal(ownersExclusive(s, s.ball, 'W'), true);
  assert.equal(ownersExclusive(s, s.ball, 'R'), false);
});

// Fig. 7: Red's end, right-hand corner. Fragment columns are x 6..10 (goal strip under
// x 6,7; yellow dots at x 6,7,10), rows are y 1..6 (end line y 6). Red GK on the area
// edge (9,3) has one valid arm (8,3); arm (10,3) is outside the area. Ball (7,2),
// White (8,1), Red (6,3). The arm square (8,3) is adjacent to the ball but does not
// count, so it is 1 vs 1: neutral.
const FIG_7 = [[9, 3, 'g'], [7, 2, 'o'], [8, 1, 'W'], [6, 3, 'R']];

test('Fig. 7: GK on the area edge has exactly one arm', () => {
  assert.deepEqual(sorted(armSquares(board(FIG_7), 'R')), ['8,3']);
});

test('Fig. 7: arm squares do not form a majority', () => {
  assert.equal(ownerOfBall(board(FIG_7)), null);
});

test('Fig. 7: a White landing on a CC square (7,3) gives White the majority', () => {
  assert.equal(ownerOfBall(board([...FIG_7, [7, 3, 'W']])), 'W');
});

test('a counter standing on an arm square is not counted', () => {
  // White counter left on Red GK arm square (8,3): excluded, so Red (6,3) alone owns.
  const s = board([[9, 3, 'g'], [7, 2, 'o'], [6, 3, 'R'], [8, 3, 'W']]);
  assert.equal(ownerOfBall(s), 'R');
});

// --- ownersExclusive ---

test('ownersExclusive: one player owning alone is exclusive', () => {
  const s = board([[5, 0, 'o'], [4, 1, 'W']]);
  assert.equal(ownersExclusive(s, s.ball, 'W'), true);
  assert.equal(ownersExclusive(s, s.ball, 'R'), false);
});

test('ownersExclusive: ownership by majority of several players is not exclusive', () => {
  const s = board([...FIG_A, frag(1, 1, 'R')]);
  assert.equal(ownersExclusive(s, s.ball, 'R'), false);
  const two = board([[5, 0, 'o'], [4, 1, 'W'], [6, -1, 'W']]);
  assert.equal(ownersExclusive(two, two.ball, 'W'), false);
});

test('ownersExclusive: neutral or opponent-owned square is not exclusive', () => {
  const s = board(FIG_A);
  assert.equal(ownersExclusive(s, s.ball, 'W'), false);
  assert.equal(ownersExclusive(s, s.ball, 'R'), false);
});

test('ownersExclusive: a lone counter in a 1 vs 0 majority over an arbitrary square', () => {
  const s = board([[5, 0, 'o'], [4, 1, 'W'], [2, 1, 'R']]);
  assert.equal(ownersExclusive(s, { x: 3, y: 1 }, 'W'), false); // 1 vs 1 at (3,1)
  assert.equal(ownersExclusive(s, { x: 5, y: 2 }, 'W'), true);
});
