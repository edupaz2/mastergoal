import test from 'node:test';
import assert from 'node:assert/strict';
import { legalBallMoves, legalActions, applyAction, isOver } from '../src/rules.js';
import { initialState } from '../src/state.js';
import { stateFromAscii, emptyRows, put } from './helpers.js';

// Build a state from a list of [x, y, ch] placements (see helpers.stateFromAscii).
function board(placements, opts = {}) {
  const rows = emptyRows();
  for (const [x, y, ch] of placements) put(rows, x, y, ch);
  const s = stateFromAscii(rows, opts);
  if (opts.phase) s.phase = opts.phase;
  if (opts.ballMovesUsed !== undefined) s.ballMovesUsed = opts.ballMovesUsed;
  if (opts.score) s.score = { ...opts.score };
  return s;
}

const key = (sq) => `${sq.x},${sq.y}`;
const ballTargets = (s) => legalBallMoves(s).map((a) => key(a.to));

function ball(s, x, y) {
  const a = legalActions(s).find((m) => m.kind === 'ball' && m.to.x === x && m.to.y === y);
  assert.ok(a, `ball move to ${x},${y} should be legal`);
  return applyAction(s, a);
}

function move(s, from, to) {
  const t = s.turn;
  const a = legalActions(s).find((m) => {
    if (m.kind !== 'move') return false;
    const p = m.piece.kind === 'G' ? s.gk[t] : s.players[t][m.piece.index];
    return key(p) === key(from) && key(m.to) === key(to);
  });
  assert.ok(a, `counter move ${key(from)} -> ${key(to)} should be legal`);
  return applyAction(s, a);
}

function assertInitialCounters(s) {
  const init = initialState('W');
  assert.deepEqual(s.players, init.players);
  assert.deepEqual(s.gk, init.gk);
  assert.deepEqual(s.ball, init.ball);
}

// --- Counter moves and turn hand-over ---

test('a counter move that does not reach the ball hands the turn over', () => {
  const s = move(initialState('W'), { x: 2, y: -1 }, { x: 2, y: 0 });
  assert.equal(s.turn, 'R');
  assert.equal(s.phase, 'counter');
  assert.equal(s.ballMovesUsed, 0);
});

test('landing next to the ball gives possession: phase becomes ball', () => {
  const s0 = board([[5, 0, 'o'], [5, -2, 'W'], [0, 3, 'R']]);
  const s = move(s0, { x: 5, y: -2 }, { x: 5, y: -1 });
  assert.equal(s.turn, 'W');
  assert.equal(s.phase, 'ball');
  assert.equal(s.ballMovesUsed, 0);
  assert.ok(legalActions(s).every((a) => a.kind === 'ball'));
});

// --- Ball movement geometry ---

test('a 4-square straight ball move is legal, a 5-square one is not', () => {
  const s = board([[5, 0, 'o'], [5, -1, 'W']], { phase: 'ball' });
  const t = ballTargets(s);
  assert.ok(t.includes('5,4'));
  assert.ok(t.includes('1,4'));
  assert.ok(!t.includes('5,5'));
  assert.ok(!t.includes('0,5'));
});

test('the ball cannot jump a Goal-keeper inside his large area', () => {
  // Red GK at (5,3) is inside Red's large area. (5,5) is unowned and would be a
  // legal turn-ending square if the ball could jump him.
  const s = board([[5, 1, 'o'], [4, 0, 'W'], [5, 3, 'g']], { phase: 'ball' });
  assert.ok(!ballTargets(s).includes('5,5'));
});

test('the ball cannot cross a Goal-keeper arm square', () => {
  // Red GK (5,3), arm (6,3). (6,5) is unowned and 2 squares from the GK.
  const s = board([[6, 1, 'o'], [7, 0, 'W'], [5, 3, 'g']], { phase: 'ball' });
  assert.ok(!ballTargets(s).includes('6,5'));
});

test('a Goal-keeper passing the ball may send it over himself', () => {
  // White GK (5,-4) holds the ball (5,-5); (5,-2) is unowned, outside his large area.
  const s = board([[5, -5, 'o'], [5, -4, 'G']], { phase: 'ball' });
  assert.ok(ballTargets(s).includes('5,-2'));
});

test('a Goal-keeper passing the ball may send it over his own arm square', () => {
  // Ball on the GK's arm (4,-4); it crosses him and his other arm (6,-4) to (7,-4),
  // which belongs to the White Player at (8,-3).
  const s = board([[4, -4, 'o'], [5, -4, 'G'], [8, -3, 'W']], { phase: 'ball' });
  assert.ok(ballTargets(s).includes('7,-4'));
});

test('the passer\'s own square does not count toward the 4 squares', () => {
  // User's example: ball (7,4.), Player (6,3.) passes over himself to (3,1), 5 squares
  // away on the diagonal, the first being his own.
  const s = board([[8, -4, 'o'], [7, -3, 'W']], { phase: 'ball' });
  const t = ballTargets(s);
  assert.ok(t.includes('3,1'));
  assert.ok(!t.includes('2,2'), 'still 4 squares beyond him');
  // Other directions keep the plain 4.
  assert.ok(t.includes('8,0'));
  assert.ok(!t.includes('8,1'));
});

test('a jumped counter that is not the passer still counts toward the 4 squares', () => {
  // White passes from (5,0) held by (4,-1); the Red at (5,1) is jumped, not passing.
  const s = board([[5, 0, 'o'], [4, -1, 'W'], [5, 1, 'R']], { phase: 'ball' });
  const t = ballTargets(s);
  assert.ok(t.includes('5,4'));
  assert.ok(!t.includes('5,5'));
});

test('a passing Goal-keeper\'s own square does not count; his arm squares do', () => {
  // White GK (5,-4) holds the ball (5,-5): over himself up to (5,-1).
  const s = board([[5, -5, 'o'], [5, -4, 'G']], { phase: 'ball' });
  assert.ok(ballTargets(s).includes('5,-1'));
  // Ball on his arm (4,-4): sideways over him and his other arm (6,-4) it reaches
  // (9,-4) at most, owned by the White Player at (9,-3).
  const a = board([[4, -4, 'o'], [5, -4, 'G'], [9, -3, 'W']], { phase: 'ball' });
  assert.ok(ballTargets(a).includes('9,-4'));
  const b = board([[4, -4, 'o'], [5, -4, 'G'], [10, -3, 'W']], { phase: 'ball' });
  assert.ok(!ballTargets(b).includes('10,-4'), 'the arm square counts');
});

test('a Goal-keeper not passing still blocks his own team\'s ball', () => {
  // The White Player (4,-1) passes; (5,-5) is the GK's, but lies beyond him.
  const s = board([[5, -2, 'o'], [4, -1, 'W'], [5, -4, 'G']], { phase: 'ball' });
  const t = ballTargets(s);
  assert.ok(t.includes('5,-3'));
  assert.ok(!t.includes('5,-5'));
});

test('the ball may jump a Goal-keeper outside his area and players', () => {
  const s = board([[5, -1, 'o'], [4, -2, 'W'], [5, 1, 'g'], [5, 0, 'R']], { phase: 'ball' });
  assert.ok(ballTargets(s).includes('5,3'));
});

// --- Destination ownership ---

test('a first ball move to an unowned square ends the turn', () => {
  const s0 = board([[5, 0, 'o'], [5, -1, 'W']], { phase: 'ball' });
  const s = ball(s0, 5, 4);
  assert.equal(s.turn, 'R');
  assert.equal(s.phase, 'counter');
  assert.equal(s.ballMovesUsed, 0);
  assert.equal(s.bonusTurn, false);
  assert.deepEqual(s.ball, { x: 5, y: 4 });
});

test('a ball move to an opponent-owned square is illegal', () => {
  const s = board([[5, 0, 'o'], [4, -1, 'W'], [5, 3, 'R']], { phase: 'ball' });
  const t = ballTargets(s);
  assert.ok(!t.includes('5,2'));
  assert.ok(!t.includes('5,4'));
});

test('an unowned square inside the mover\'s own large area is illegal', () => {
  const s = board([[5, -2, 'o'], [4, -1, 'W']], { phase: 'ball' });
  assert.ok(!ballTargets(s).includes('5,-3'));
  assert.ok(!ballTargets(s).includes('5,-4'));
});

test('self-pass is illegal; a pass to a square owned by another own player is legal', () => {
  // A at (4,-1) took the ball; B at (6,2).
  const s = board([[5, 0, 'o'], [4, -1, 'W'], [6, 2, 'W']], { phase: 'ball' });
  const t = ballTargets(s);
  assert.ok(!t.includes('3,0'), 'square owned only by A');
  assert.ok(!t.includes('4,-2'), 'square owned only by A');
  assert.ok(t.includes('7,2'), 'square owned by B');
  assert.ok(t.includes('5,2'), 'square owned by B');
  const after = ball(s, 7, 2);
  assert.equal(after.phase, 'ball');
  assert.equal(after.turn, 'W');
  assert.equal(after.ballMovesUsed, 1);
});

test('a square adjacent to both the taker and another own player is a legal pass', () => {
  // A (4,-1) takes the ball at (5,0); (3,-1)... (3,0) is adjacent to A and to C (2,1).
  const s = board([[5, 0, 'o'], [4, -1, 'W'], [2, 1, 'W']], { phase: 'ball' });
  assert.ok(ballTargets(s).includes('3,0'));
});

test('a pass into the own GK arm square is a self-pass when the GK holds the ball', () => {
  // Ball (4,-4) is held by the White GK (5,-5) and player (3,-3). The arm square
  // (4,-5) belongs to the GK alone (independent of the player at (3,-5)).
  const s = board([[4, -4, 'o'], [5, -5, 'G'], [3, -3, 'W'], [3, -5, 'W']], { phase: 'ball' });
  assert.ok(!ballTargets(s).includes('4,-5'));
  // From (2,-3), held by (2,-2), the GK did not take the ball: the pass is legal.
  const s2 = board([[2, -3, 'o'], [2, -2, 'W'], [5, -5, 'G']], { phase: 'ball' });
  assert.ok(ballTargets(s2).includes('4,-5'));
});

test('the 4th ball move cannot end on an own-owned square', () => {
  const s = board([[5, 0, 'o'], [4, -1, 'W'], [6, 2, 'W']], { phase: 'ball', ballMovesUsed: 3 });
  const t = ballTargets(s);
  assert.ok(!t.includes('7,2'));
  assert.ok(!t.includes('5,2'));
  assert.ok(t.includes('5,4'));
});

test('the ball never enters its own goal', () => {
  const s = board([[5, -5, 'o'], [4, -4, 'W']], { phase: 'ball' });
  assert.ok(legalBallMoves(s).every((a) => a.to.y !== -7));
});

test('a team cannot leave the ball on its own corner', () => {
  const s = board([[2, -4, 'o'], [3, -3, 'W']], { phase: 'ball' });
  assert.ok(!ballTargets(s).includes('0,-6'));
});

// --- Goals (Figs. 9 and 10) ---

// Fig. 9: White scores diagonally in 4 moves. White (7,-3) steps to (7,-2) next to the
// ball (7,-1), then (7,-1)->(4,-4)->(0,0)->(0,4)->goal (3,7).
const FIG_9 = [
  [7, -1, 'o'],
  [4, 6, 'g'], [4, 4, 'R'], [2, 0, 'R'], [4, -2, 'R'], [7, -4, 'R'],
  [1, 3, 'W'], [1, 0, 'W'], [7, -3, 'W'], [3, -4, 'W'], [5, -5, 'G'],
];

test('Fig. 9: goal scored diagonally in 4 moves', () => {
  let s = board(FIG_9);
  s = move(s, { x: 7, y: -3 }, { x: 7, y: -2 });
  assert.equal(s.phase, 'ball');
  s = ball(s, 4, -4);
  s = ball(s, 0, 0);
  s = ball(s, 0, 4);
  assert.equal(s.ballMovesUsed, 3);
  s = ball(s, 3, 7);
  assert.equal(s.score.W, 1);
  assert.equal(s.score.R, 0);
  assert.equal(s.turn, 'R');
  assert.equal(s.phase, 'counter');
  assert.equal(s.ballMovesUsed, 0);
  assert.equal(s.result, null);
  assertInitialCounters(s);
});

// Fig. 10: White scores with a forward move in 3 moves. White (1,4) steps to (1,2)
// next to the ball (2,1), then (2,1)->(4,1)->(6,3)->goal (6,7).
const FIG_10 = [
  [2, 1, 'o'],
  [4, 6, 'g'], [7, 5, 'R'], [2, 3, 'R'], [6, 1, 'R'], [2, -1, 'R'],
  [5, 3, 'W'], [1, 4, 'W'], [4, 0, 'W'], [2, -2, 'W'], [5, -5, 'G'],
];

test('Fig. 10: goal scored from a forward move in 3 moves', () => {
  let s = board(FIG_10);
  s = move(s, { x: 1, y: 4 }, { x: 1, y: 2 });
  assert.equal(s.phase, 'ball');
  s = ball(s, 4, 1);
  s = ball(s, 6, 3);
  s = ball(s, 6, 7);
  assert.equal(s.score.W, 1);
  assert.equal(s.turn, 'R');
  assert.equal(s.phase, 'counter');
  assertInitialCounters(s);
});

const NEAR_GOAL = [[5, 4, 'o'], [4, 3, 'W']];

test('a second goal ends the match with the right winner', () => {
  const s = ball(board(NEAR_GOAL, { phase: 'ball', score: { W: 1, R: 0 } }), 5, 7);
  assert.deepEqual(s.score, { W: 2, R: 0 });
  assert.deepEqual(s.result, { winner: 'W', reason: 'goals' });
  assert.equal(isOver(s), true);
  assert.deepEqual(legalActions(s), []);
});

// Ruling (user): best of 3, the first side to 2 goals wins (2:0, 2:1, 1:2, 0:2).
test('at 1:1 the match goes on', () => {
  const s = ball(board(NEAR_GOAL, { phase: 'ball', score: { W: 0, R: 1 } }), 5, 7);
  assert.deepEqual(s.score, { W: 1, R: 1 });
  assert.equal(s.result, null);
  assert.equal(isOver(s), false);
  assert.equal(s.turn, 'R', 'the team that conceded kicks off');
  assertInitialCounters(s);
});

test('a goal from 1:1 wins the match 2:1', () => {
  const s = ball(board(NEAR_GOAL, { phase: 'ball', score: { W: 1, R: 1 } }), 5, 7);
  assert.deepEqual(s.score, { W: 2, R: 1 });
  assert.deepEqual(s.result, { winner: 'W', reason: 'goals' });
  const r = ball(board([[5, -4, 'o'], [4, -3, 'R']], { phase: 'ball', turn: 'R', score: { W: 1, R: 1 } }), 5, -7);
  assert.deepEqual(r.score, { W: 1, R: 2 });
  assert.deepEqual(r.result, { winner: 'R', reason: 'goals' });
});

test('Red scores toward y = -7', () => {
  const s0 = board([[5, -4, 'o'], [4, -3, 'R']], { phase: 'ball', turn: 'R' });
  const s = ball(s0, 5, -7);
  assert.equal(s.score.R, 1);
  assert.equal(s.turn, 'W', 'White conceded, White kicks off');
});

// --- Put out ---

// Ball on White's end line (5,-6). The White GK steps from (5,-4) to (5,-5) and takes
// it. He may pass over himself and his arms, but every square is either his alone
// (self-pass), unowned inside White's own large area, or (on row -2, just outside the
// area) owned by the Reds on row -1. The end-line squares are his alone or unowned
// inside the area, and the own goal is closed.
const ROW_MINUS_1_REDS = [[1, -1, 'R'], [5, -1, 'R'], [9, -1, 'R']];
const PUT_OUT = [[5, -6, 'o'], [5, -4, 'G'], ...ROW_MINUS_1_REDS];

test('no legal destination for the obliged ball move ends the game: put out', () => {
  const s = move(board(PUT_OUT, { score: { W: 1, R: 0 } }), { x: 5, y: -4 }, { x: 5, y: -5 });
  assert.deepEqual(s.result, { winner: 'W', reason: 'put-out' });
  assert.equal(isOver(s), true);
  assert.deepEqual(legalActions(s), []);
});

test('put out with a level score is a draw', () => {
  const s = move(board(PUT_OUT), { x: 5, y: -4 }, { x: 5, y: -5 });
  assert.deepEqual(s.result, { winner: null, reason: 'put-out' });
});

test('put out after a pass (move 3 received where move 4 has no legal square)', () => {
  // Ball (9,-6) held by (10,-5); 3rd move along the end line to (5,-6), owned by the
  // GK alone (he did not take the ball, so not a self-pass). The 4th move must end
  // unowned outside White's large area or score, and nothing qualifies.
  const s0 = board([[9, -6, 'o'], [10, -5, 'W'], [5, -5, 'G'], ...ROW_MINUS_1_REDS],
    { phase: 'ball', ballMovesUsed: 2, score: { W: 0, R: 1 } });
  const s = ball(s0, 5, -6);
  assert.deepEqual(s.result, { winner: 'R', reason: 'put-out' });
  assert.deepEqual(legalActions(s), []);
});

// --- Bonus turn ---

test('leaving the ball on an opponent end-line yellow square gives a bonus turn', () => {
  const s0 = board([[5, 2, 'o'], [4, 1, 'W']], { phase: 'ball', ballMovesUsed: 0 });
  const s = ball(s0, 5, 6);
  assert.equal(s.turn, 'W');
  assert.equal(s.phase, 'counter');
  assert.equal(s.ballMovesUsed, 0);
  assert.equal(s.bonusTurn, true);
});

test('a non-yellow end-line square gives no bonus turn', () => {
  const s0 = board([[2, 3, 'o'], [3, 2, 'W']], { phase: 'ball' });
  const s = ball(s0, 2, 6);
  assert.equal(s.turn, 'R');
  assert.equal(s.bonusTurn, false);
});

// --- Purity and guards ---

test('applyAction does not mutate its input state', () => {
  const s0 = board(FIG_9);
  const snapshot = JSON.parse(JSON.stringify(s0));
  const s1 = move(s0, { x: 7, y: -3 }, { x: 7, y: -2 });
  assert.deepEqual(s0, snapshot);
  const snap1 = JSON.parse(JSON.stringify(s1));
  ball(s1, 4, -4);
  assert.deepEqual(s1, snap1);
});

test('applyAction throws on an illegal action', () => {
  const s = initialState('W');
  assert.throws(() => applyAction(s, { kind: 'ball', to: { x: 5, y: 1 } }));
  assert.throws(() => applyAction(s, { kind: 'move', piece: { team: 'W', kind: 'P', index: 0 }, to: { x: 2, y: 4 } }));
});

test('a finished match has no legal actions', () => {
  const s = initialState('W');
  s.result = { winner: 'W', reason: 'goals' };
  assert.equal(isOver(s), true);
  assert.deepEqual(legalActions(s), []);
  assert.equal(isOver(initialState('W')), false);
});
