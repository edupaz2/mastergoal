import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/state.js';
import { legalCounterMoves } from '../src/rules.js';
import { inPitch } from '../src/board.js';
import { stateFromAscii, emptyRows, put } from './helpers.js';

const dests = (s) => legalCounterMoves(s).map((m) => `${m.to.x},${m.to.y}`);
const has = (s, x, y) => dests(s).includes(`${x},${y}`);

test('initial state', () => {
  const s = initialState('W');
  assert.equal(s.players.W.length, 4);
  assert.equal(s.players.R.length, 4);
  assert.deepEqual(s.gk.W, { x: 5, y: -5 });
  assert.deepEqual(s.gk.R, { x: 5, y: 5 });
  assert.deepEqual(s.ball, { x: 5, y: 0 });
  assert.deepEqual(s.score, { W: 0, R: 0 });
  assert.equal(s.result, null);
  assert.equal(s.phase, 'counter');
  assert.deepEqual(s.players.R[0], { x: 2, y: 1 });
});

test('lone player has 16 destinations', () => {
  const s = stateFromAscii(put(emptyRows(), 5, -2, 'W'));
  const m = legalCounterMoves(s);
  assert.equal(m.length, 16);
  assert.equal(new Set(dests(s)).size, 16);
});

test('no occupied squares, no jumping over a counter', () => {
  const s = stateFromAscii(put(put(emptyRows(), 5, -2, 'W'), 5, -1, 'R'));
  assert.ok(!has(s, 5, -1));
  assert.ok(!has(s, 5, 0));
  assert.ok(has(s, 7, 0));
});

test('no player enters a small area', () => {
  const s = stateFromAscii(put(emptyRows(), 5, -3, 'W'));
  assert.ok(!has(s, 5, -5));
  assert.ok(!has(s, 5, -6));
  assert.ok(!has(s, 4, -5));
  assert.ok(has(s, 5, -4));
});

test('own corners prohibited, opposite corners fine, mirror for Red', () => {
  let s = stateFromAscii(put(put(emptyRows(), 0, -4, 'W'), 10, -4, 'W'));
  assert.ok(!has(s, 0, -6));
  assert.ok(!has(s, 10, -6));
  s = stateFromAscii(put(emptyRows(), 0, 4, 'W'));
  assert.ok(has(s, 0, 6));
  s = stateFromAscii(put(put(emptyRows(), 0, 4, 'R'), 10, 4, 'R'), { turn: 'R' });
  assert.ok(!has(s, 0, 6));
  assert.ok(!has(s, 10, 6));
  s = stateFromAscii(put(emptyRows(), 0, -4, 'R'), { turn: 'R' });
  assert.ok(has(s, 0, -6));
});

test('never off pitch; goal-keeper rules', () => {
  assert.ok(legalCounterMoves(initialState('W')).every((m) => inPitch(m.to)));
  const g = stateFromAscii(put(emptyRows(), 5, -5, 'G'));
  const gm = legalCounterMoves(g);
  assert.ok(gm.length > 0 && gm.every((m) => m.piece.kind === 'G'));
  assert.ok(gm.every((m) => m.to.y <= -3 && m.to.x >= 1 && m.to.x <= 9));
  assert.ok(has(g, 5, -6));
  const o = stateFromAscii(put(emptyRows(), 5, -1, 'G'));
  assert.equal(legalCounterMoves(o).length, 16);
});
