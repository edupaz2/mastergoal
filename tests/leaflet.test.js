// Rules sweep against the leaflet (IMG_5223-5225). One test per figure or rule paragraph.
// Figure fragments are mapped onto pitch squares; the mapping is given per test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  legalCounterMoves, legalBallMoves, legalActions, applyAction, ownerOfBall, armSquares,
} from '../src/rules.js';
import { initialState } from '../src/state.js';
import { inSmallArea, inLargeArea, goalDefender, isCorner } from '../src/board.js';
import { stateFromAscii, emptyRows, put } from './helpers.js';

function board(placements, opts = {}) {
  const rows = emptyRows();
  for (const [x, y, ch] of placements) put(rows, x, y, ch);
  const s = stateFromAscii(rows, opts);
  if (opts.phase) s.phase = opts.phase;
  if (opts.ballMovesUsed !== undefined) s.ballMovesUsed = opts.ballMovesUsed;
  return s;
}

const key = (sq) => `${sq.x},${sq.y}`;
const ballTargets = (s) => legalBallMoves(s).map((a) => key(a.to));
const pieceAt = (s, m) => (m.piece.kind === 'G' ? s.gk[s.turn] : s.players[s.turn][m.piece.index]);
const counterTargets = (s, from) =>
  legalCounterMoves(s).filter((m) => key(pieceAt(s, m)) === key(from)).map((m) => key(m.to));

function ball(s, x, y) {
  const a = legalActions(s).find((m) => m.kind === 'ball' && m.to.x === x && m.to.y === y);
  assert.ok(a, `ball move to ${x},${y} should be legal`);
  return applyAction(s, a);
}

function move(s, from, to) {
  const a = legalActions(s).find((m) => m.kind === 'move' && key(pieceAt(s, m)) === key(from) && key(m.to) === key(to));
  assert.ok(a, `counter move ${key(from)} -> ${key(to)} should be legal`);
  return applyAction(s, a);
}

// --- THE BOARD ---

test('Fig. 1: board, goal posts, areas, corners and start squares', () => {
  for (let x = 3; x <= 7; x++) assert.equal(goalDefender({ x, y: 7 }), 'R');
  assert.equal(goalDefender({ x: 2, y: 7 }), null);
  assert.ok(inSmallArea({ x: 2, y: 6 }, 'R') && inSmallArea({ x: 8, y: 5 }, 'R'));
  assert.ok(!inSmallArea({ x: 5, y: 4 }, 'R'));
  assert.ok(inLargeArea({ x: 1, y: 3 }, 'R') && inLargeArea({ x: 9, y: 6 }, 'R'));
  assert.ok(!inLargeArea({ x: 0, y: 6 }, 'R') && !inLargeArea({ x: 5, y: 2 }, 'R'));
  assert.ok(isCorner({ x: 0, y: -6 }) && isCorner({ x: 10, y: 6 }));
  const s = initialState('W');
  assert.deepEqual(s.gk, { W: { x: 5, y: -5 }, R: { x: 5, y: 5 } });
  assert.deepEqual(s.ball, { x: 5, y: 0 });
});

// --- COUNTERS ---

test('Fig. 2: a Player moves 1 or 2 squares in a straight line, any direction', () => {
  const s = board([[5, 1, 'W']]);
  const t = counterTargets(s, { x: 5, y: 1 });
  assert.equal(t.length, 16);
  for (const sq of ['5,3', '7,3', '7,1', '3,-1', '4,0', '6,2']) assert.ok(t.includes(sq), sq);
  for (const sq of ['5,4', '6,3', '8,4']) assert.ok(!t.includes(sq), sq);
});

test('Fig. 2 / Ball text: only the Ball jumps over Players; a Player cannot', () => {
  const s = board([[5, 1, 'W'], [5, 2, 'R']]);
  assert.ok(!counterTargets(s, { x: 5, y: 1 }).includes('5,3'));
});

test('Spec (binding): no Player, nor a GK outside his area, enters either small area', () => {
  // Spec line 75 (user-confirmed) bans it; the leaflet's Ball text suggests otherwise.
  assert.ok(!counterTargets(board([[5, -3, 'W']]), { x: 5, y: -3 }).includes('5,-5'));
  assert.ok(!counterTargets(board([[5, 3, 'W']]), { x: 5, y: 3 }).includes('5,5'));
  assert.ok(!counterTargets(board([[5, 3, 'G']]), { x: 5, y: 3 }).includes('5,5'));
  // A GK outside his own area (x 0) cannot step into his own small area either.
  assert.ok(!counterTargets(board([[0, -5, 'G']]), { x: 0, y: -5 }).includes('2,-5'));
});

test('Goal-keeper: same characteristics as a field Player out of his area; he may leave it', () => {
  // Outside his area he moves 1 or 2 squares, and may step 2 back into it.
  assert.equal(counterTargets(board([[5, -1, 'G']]), { x: 5, y: -1 }).length, 16);
  assert.ok(counterTargets(board([[5, -2, 'G']]), { x: 5, y: -2 }).includes('5,-4'));
});

test('Ruling (user): inside his area the Goal-keeper moves 1 square at a time', () => {
  const t = counterTargets(board([[5, -3, 'G']]), { x: 5, y: -3 });
  assert.ok(t.includes('5,-4'));
  assert.ok(t.includes('5,-2'), 'he may step out of his area');
  assert.ok(!t.includes('5,-5'));
  assert.ok(!t.includes('5,-1'), '1 square even when leaving');
  assert.equal(t.length, 8);
});

test('Goal-keeper: arms stay parallel to the goal line wherever he moves in his area', () => {
  let s = board([[5, -4, 'G']]);
  assert.deepEqual(armSquares(s, 'W').map(key), ['4,-4', '6,-4']);
  s = move(s, { x: 5, y: -4 }, { x: 6, y: -5 });
  assert.deepEqual(armSquares(s, 'W').map(key), ['5,-5', '7,-5']);
});

test('Goal-keeper: no Player can go onto his side squares, although they can pass them', () => {
  // White GK (5,-4), arms (4,-4) and (6,-4).
  const s = board([[5, -4, 'G'], [4, -2, 'R'], [3, -4, 'R'], [7, -5, 'R'], [7, -3, 'R']], { turn: 'R' });
  assert.ok(!counterTargets(s, { x: 4, y: -2 }).includes('4,-4'));
  assert.ok(!counterTargets(s, { x: 3, y: -4 }).includes('4,-4'));
  assert.ok(counterTargets(s, { x: 7, y: -5 }).includes('5,-3'), 'passes over the arm (6,-4)');
  assert.ok(!counterTargets(s, { x: 7, y: -3 }).includes('6,-4'));
  // His own team's Players neither.
  const w = board([[5, -4, 'G'], [4, -2, 'W']]);
  assert.ok(!counterTargets(w, { x: 4, y: -2 }).includes('4,-4'));
});

test('Goal-keeper: "or vice versa" - his arms cannot be put onto a counter', () => {
  const s = board([[5, -4, 'G'], [7, -5, 'R']]);
  const t = counterTargets(s, { x: 5, y: -4 });
  assert.ok(!t.includes('6,-5'), 'arm (7,-5) would land on the Red player');
  assert.ok(t.includes('6,-4'));
  assert.ok(t.includes('4,-4'), 'stepping onto his own current arm square');
});

test('Goal-keeper: the ball never crosses him or his side squares; only his team uses them', () => {
  // White GK (5,-4), arms (4,-4) (6,-4). Red holds the ball at (2,-4) with (1,-3).
  const s = board([[5, -4, 'G'], [2, -4, 'o'], [1, -3, 'R']], { turn: 'R', phase: 'ball' });
  const t = ballTargets(s);
  assert.ok(t.includes('3,-4'));
  assert.ok(!t.includes('4,-4'), 'arm square belongs to the White GK');
  assert.ok(!t.includes('6,-4'), 'cannot cross the arm and the GK');
  // White passes onto its own GK's arm square.
  const w = board([[2, -3, 'o'], [2, -2, 'W'], [5, -5, 'G']], { phase: 'ball' });
  assert.ok(ballTargets(w).includes('4,-5'));
});

// --- BALL ---

test('Fig. 3: landing on a CC square gives possession, and the ball must be moved', () => {
  let s = board([[5, 0, 'o'], [5, -2, 'W']]);
  s = move(s, { x: 5, y: -2 }, { x: 4, y: -1 });
  assert.equal(s.phase, 'ball');
  assert.equal(s.turn, 'W');
  assert.ok(legalActions(s).length > 0 && legalActions(s).every((a) => a.kind === 'ball'));
  let g = board([[5, 0, 'o'], [5, -2, 'G']]);
  g = move(g, { x: 5, y: -2 }, { x: 5, y: -1 });
  assert.equal(g.phase, 'ball');
});

test('Fig. 4: the ball moves 1 to 4 squares in a straight line, any direction', () => {
  const s = board([[5, 0, 'o'], [5, -1, 'W']], { phase: 'ball' });
  const t = ballTargets(s);
  for (const sq of ['5,4', '5,2', '1,4', '9,4', '9,0', '1,0', '8,3']) assert.ok(t.includes(sq), sq);
  for (const sq of ['5,5', '6,2', '0,0', '10,5']) assert.ok(!t.includes(sq), sq);
});

test('Ball text: the ball jumps over Players outside the small area', () => {
  // White owns the ball 2 vs 1; Reds at (5,1) and (7,0) are jumped.
  const s = board([[5, 0, 'o'], [5, -1, 'W'], [4, -1, 'W'], [5, 1, 'R'], [7, 0, 'R']], { phase: 'ball' });
  const t = ballTargets(s);
  assert.ok(t.includes('5,3'));
  assert.ok(t.includes('9,0'));
});

test('Ball text: the ball never jumps over Players in the small area', () => {
  const s = board([[5, 3, 'o'], [4, 2, 'W'], [5, 5, 'R']], { phase: 'ball' });
  assert.ok(!ballTargets(s).includes('5,7'));
  // Control: a Player just outside the small area (5,4) is jumped.
  const c = board([[5, 2, 'o'], [4, 1, 'W'], [5, 4, 'R']], { phase: 'ball' });
  assert.ok(ballTargets(c).includes('5,6'));
  // Own Players in the small area block the ball too.
  const o = board([[5, 3, 'o'], [4, 2, 'W'], [5, 6, 'W']], { phase: 'ball' });
  assert.ok(!ballTargets(o).includes('5,7'));
});

test('Fig. 5: a ball on a side square belongs to the Goal-keeper, whatever else', () => {
  const s = board([[5, -5, 'G'], [4, -5, 'o'], [3, -4, 'R'], [3, -5, 'R'], [3, -6, 'R']]);
  assert.equal(ownerOfBall(s), 'W');
});

// --- PASSES (Fig. 6) and self-pass ---

// Fig. 6 (2 Players), 7x7 fragment mapped x = col + 2, y = 3 - row: Red (3,5) -> (5,-2),
// Red (4,1) -> (6,2), ball (3,4) -> (5,-1) moves 3 squares to (3,1) -> (5,2).
test('Fig. 6: pass between 2 players', () => {
  const s0 = board([[5, -2, 'R'], [6, 2, 'R'], [5, -1, 'o']], { turn: 'R', phase: 'ball' });
  const s = ball(s0, 5, 2);
  assert.equal(s.turn, 'R');
  assert.equal(s.phase, 'ball');
  assert.equal(s.ballMovesUsed, 1);
});

// Fig. 6 (3 Players), 7x6 fragment mapped x = col + 2, y = 2 - row: Reds (4,0) (6,1)
// (0,2) -> (6,2) (8,1) (2,0); ball (6,0) -> (8,2); moves to (5,2) over the Red at (6,2),
// then (3,0), then the turn ends on (6,-3).
test('Fig. 6: passes between 3 players, jumping an own Player', () => {
  let s = board([[6, 2, 'R'], [8, 1, 'R'], [2, 0, 'R'], [8, 2, 'o']], { turn: 'R', phase: 'ball' });
  s = ball(s, 5, 2);
  assert.equal(s.ballMovesUsed, 1);
  s = ball(s, 3, 0);
  assert.equal(s.ballMovesUsed, 2);
  s = ball(s, 6, -3);
  assert.equal(s.turn, 'W');
  assert.equal(s.phase, 'counter');
});

test('Self-pass: from a square exclusively his to another square only his is illegal', () => {
  // Fig. 6 (2 Players) start: the ball (5,-1) belongs only to the Red at (5,-2).
  const s = board([[5, -2, 'R'], [6, 2, 'R'], [5, -1, 'o']], { turn: 'R', phase: 'ball' });
  const t = ballTargets(s);
  assert.ok(!t.includes('4,-1'));
  assert.ok(!t.includes('6,-3'));
});

test('Self-pass (spec, binding): every own counter next to the ball is a taker', () => {
  // Spec lines 61/89: no pass to a square owned only by a counter next to the ball.
  // The ball (5,0) is next to A (4,-1) and B (6,-1); (3,0) belongs to A alone.
  const s = board([[5, 0, 'o'], [4, -1, 'W'], [6, -1, 'W']], { phase: 'ball' });
  assert.ok(!ballTargets(s).includes('3,0'));
  // Same with the Goal-keeper: ball (4,-4) next to the GK and (3,-3); the arm
  // square (4,-5) belongs to the GK alone.
  const g = board([[4, -4, 'o'], [5, -5, 'G'], [3, -3, 'W']], { phase: 'ball' });
  assert.ok(!ballTargets(g).includes('4,-5'));
});

test('Passes: a square owned by a majority of own Players is used like a single-owner one', () => {
  // (3,0): White A (4,-1) and C (2,1) vs Red (3,1) -> 2 vs 1, A among the owners.
  const s = board([[5, 0, 'o'], [4, -1, 'W'], [2, 1, 'W'], [3, 1, 'R']], { phase: 'ball' });
  assert.ok(ballTargets(s).includes('3,0'));
});

// --- NEUTRAL SQUARES (Figs. A-C, A1-C1) ---
// 5x5 fragments mapped x = col + 3, y = 2 - row (mid-field, no Goal-keeper arms).

const FIG_A = [[4, 0, 'o'], [5, 1, 'W'], [3, -1, 'R']];
const FIG_B = [[5, 0, 'o'], [4, 1, 'R'], [5, 1, 'W'], [4, 0, 'W'], [6, -1, 'R']];
const FIG_C = [[6, 0, 'o'], [5, 1, 'W'], [7, 1, 'R'], [7, 0, 'W'], [5, -1, 'g']];

test('Fig. A: one Player of each team adjacent -> neutral', () => {
  assert.equal(ownerOfBall(board(FIG_A)), null);
});

test('Fig. B: two Players of each team adjacent -> neutral', () => {
  assert.equal(ownerOfBall(board(FIG_B)), null);
});

test('Fig. C: two each, the Goal-keeper counting as one -> neutral', () => {
  assert.equal(ownerOfBall(board(FIG_C)), null);
});

test('Fig. A1: Red lands on (1,1) -> majority of REDS, Red must move the ball', () => {
  const s = move(board([...FIG_A, [2, 1, 'R']], { turn: 'R' }), { x: 2, y: 1 }, { x: 4, y: 1 });
  assert.equal(ownerOfBall(s), 'R');
  assert.equal(s.phase, 'ball');
  assert.equal(s.turn, 'R');
});

test('Fig. B1: White lands on (2,3) -> majority of WHITES, White must move the ball', () => {
  const s = move(board([...FIG_B, [5, -2, 'W']]), { x: 5, y: -2 }, { x: 5, y: -1 });
  assert.equal(ownerOfBall(s), 'W');
  assert.equal(s.phase, 'ball');
});

test('Fig. C1: Red lands on (4,3) -> majority of REDS, Red must move the ball', () => {
  const s = move(board([...FIG_C, [6, -2, 'R']], { turn: 'R' }), { x: 6, y: -2 }, { x: 7, y: -1 });
  assert.equal(ownerOfBall(s), 'R');
  assert.equal(s.phase, 'ball');
});

test('Neutral squares: landing next to the ball for a tie does not take it', () => {
  const s = move(board([[4, 0, 'o'], [5, 1, 'W'], [3, -3, 'R']], { turn: 'R' }), { x: 3, y: -3 }, { x: 3, y: -1 });
  assert.equal(s.phase, 'counter');
  assert.equal(s.turn, 'W');
});

test('Fig. 7: side squares do not form a majority (GK on the area edge has one arm)', () => {
  // Fragment = x 6..10, y 1..6 of Red's end. Red GK (9,3), arm (8,3) only.
  const s = board([[9, 3, 'g'], [8, 1, 'W'], [7, 2, 'o'], [6, 3, 'R']]);
  assert.deepEqual(armSquares(s, 'R').map(key), ['8,3']);
  assert.equal(ownerOfBall(s), null);
});

// --- RELATION: PLAYERS WITH THE BALL ---

test('Relation: if no counter takes the ball the turn passes', () => {
  const s = move(initialState('W'), { x: 2, y: -1 }, { x: 2, y: 0 });
  assert.equal(s.turn, 'R');
});

test('Relation: first 3 moves are passes; the last leaves the ball unowned outside own area', () => {
  const s = board([[5, 0, 'o'], [4, -1, 'W'], [6, 2, 'W']], { phase: 'ball', ballMovesUsed: 3 });
  const t = ballTargets(s);
  assert.ok(!t.includes('7,2'), 'no 5th move, so no pass');
  assert.ok(t.includes('5,4'));
  const own = board([[5, -2, 'o'], [4, -1, 'W']], { phase: 'ball' });
  assert.ok(!ballTargets(own).includes('5,-4'), 'unowned inside own area');
});

// --- SPECIAL SQUARES (Fig. 8) ---

test('Fig. 8: a team can neither occupy nor send the ball to its own corners', () => {
  const s = board([[0, -4, 'W'], [2, -4, 'o'], [3, -3, 'W']]);
  assert.ok(!counterTargets(s, { x: 0, y: -4 }).includes('0,-6'));
  const b = board([[2, -4, 'o'], [3, -3, 'W']], { phase: 'ball' });
  assert.ok(!ballTargets(b).includes('0,-6'));
  // The opponent's corners are fine.
  assert.ok(counterTargets(board([[0, 4, 'W']]), { x: 0, y: 4 }).includes('0,6'));
});

test('Fig. 8: a corner belonging to a Player loses its prohibition (own pass)', () => {
  // (0,-5) owns the corner and is not next to the ball, so this is a real pass.
  const s = board([[2, -4, 'o'], [3, -3, 'W'], [0, -5, 'W']], { phase: 'ball' });
  assert.ok(ballTargets(s).includes('0,-6'));
});

test('Fig. 8: a neutral corner (Players of both teams adjacent) loses its prohibition', () => {
  // Corner (0,-6): White (1,-6) and Red (0,-5) adjacent -> 1 vs 1, it belongs to
  // Players of both teams, so the ball may be left there.
  const s0 = board([[2, -4, 'o'], [3, -3, 'W'], [1, -6, 'W'], [0, -5, 'R']], { phase: 'ball' });
  assert.ok(ballTargets(s0).includes('0,-6'));
  const s = ball(s0, 0, -6);
  assert.equal(s.turn, 'R');
});

test('Special squares: an unclaimed yellow end-line square gives another turn', () => {
  const s = ball(board([[5, 2, 'o'], [4, 1, 'W']], { phase: 'ball' }), 5, 6);
  assert.equal(s.turn, 'W');
  assert.equal(s.bonusTurn, true);
});

test('Spec (binding): a neutral yellow end-line square still gives the extra turn', () => {
  // Spec line 49: any opponent end-line yellow square gives the bonus; line 92 only
  // lifts the corner prohibition.
  const s = ball(board([[5, 2, 'o'], [4, 1, 'W'], [4, 6, 'R'], [6, 6, 'W']], { phase: 'ball' }), 5, 6);
  assert.equal(s.turn, 'W');
  assert.equal(s.bonusTurn, true);
});

// --- THE GOAL (Figs. 9 and 10) ---

test('Fig. 9: goal diagonally (4 moves); the scorer moves next from the start squares', () => {
  let s = board([
    [7, -1, 'o'],
    [4, 6, 'g'], [4, 4, 'R'], [2, 0, 'R'], [4, -2, 'R'], [7, -4, 'R'],
    [1, 3, 'W'], [1, 0, 'W'], [7, -3, 'W'], [3, -4, 'W'], [5, -5, 'G'],
  ]);
  s = move(s, { x: 7, y: -3 }, { x: 7, y: -2 });
  s = ball(s, 4, -4);
  s = ball(s, 0, 0);
  s = ball(s, 0, 4);
  s = ball(s, 3, 7);
  assert.equal(s.score.W, 1);
  assert.equal(s.turn, 'W');
  assert.deepEqual(s.players, initialState('W').players);
});

test('Fig. 10: goal from a forward move (3 moves); not sideways along the goal line', () => {
  let s = board([
    [2, 1, 'o'],
    [4, 6, 'g'], [7, 5, 'R'], [2, 3, 'R'], [6, 1, 'R'], [2, -1, 'R'],
    [5, 3, 'W'], [1, 4, 'W'], [4, 0, 'W'], [2, -2, 'W'], [5, -5, 'G'],
  ]);
  s = move(s, { x: 1, y: 4 }, { x: 1, y: 2 });
  s = ball(s, 4, 1);
  s = ball(s, 6, 3);
  s = ball(s, 6, 7);
  assert.equal(s.score.W, 1);
  // Only the opponent's goal, never the own one.
  const own = board([[5, -5, 'o'], [4, -4, 'W']], { phase: 'ball' });
  assert.ok(legalBallMoves(own).every((a) => a.to.y !== -7));
});

// --- Ambiguous; current behaviour kept (see commit message) ---

test('Ruling: a Player may move 2 squares over the ball square (leaflet silent)', () => {
  const s = board([[5, -2, 'W'], [5, -1, 'o'], [9, 5, 'R']]);
  assert.ok(counterTargets(s, { x: 5, y: -2 }).includes('5,0'));
});
