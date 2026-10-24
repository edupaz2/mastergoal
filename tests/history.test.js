import test from 'node:test';
import assert from 'node:assert/strict';
import { describeAction, describeTurn, createHistory } from '../src/history.js';
import { initialState } from '../src/state.js';

const before = () => {
  const s = initialState();
  s.players.W[0] = { x: 2, y: -1 };
  return s;
};

function fakeEl() {
  const el = {
    children: [],
    appendChild(c) { this.children.push(c); return c; },
    replaceChildren() { this.children = []; },
  };
  el.createElement = () => ({ textContent: '' });
  return el;
}

test('describes a counter move', () => {
  const a = { kind: 'move', piece: { team: 'W', kind: 'P', index: 0 }, to: { x: 3, y: 0 } };
  assert.equal(describeAction(a, before()), 'P (2,1.)→(3,0)');
});

test('describes a goal-keeper move with letter G', () => {
  const a = { kind: 'move', piece: { team: 'W', kind: 'G', index: 0 }, to: { x: 5, y: -4 } };
  assert.equal(describeAction(a, before()), 'G (B,5.)→(B,4.)');
});

test('describes a ball move', () => {
  assert.equal(describeAction({ kind: 'ball', to: { x: 6, y: 2 } }, before()), 'ball →(5,2)');
});

test('describeTurn prefixes team and joins actions', () => {
  const acts = [
    { kind: 'move', piece: { team: 'R', kind: 'P', index: 0 }, to: { x: 3, y: 0 } },
    { kind: 'ball', to: { x: 6, y: 2 } },
  ];
  const t = describeTurn('R', acts, before());
  assert.ok(t.startsWith('R '));
  assert.ok(t.endsWith(' ball →(5,2)'));
  assert.ok(describeTurn('R', [acts[0]], before()).startsWith('R P ('));
});

test('history adds entries in order and clears', () => {
  const el = fakeEl();
  const h = createHistory(el);
  h.add(1, 'a'); h.add(2, 'b'); h.add(3, 'c');
  assert.deepEqual(el.children.map((c) => c.textContent), ['1. a', '2. b', '3. c']);
  h.clear();
  assert.equal(el.children.length, 0);
});

test('history works with a fake lacking createElement and scrolls when supported', () => {
  const el = { children: [], appendChild(c) { this.children.push(c); }, replaceChildren() {}, scrollTop: 0, scrollHeight: 99 };
  createHistory(el).add(1, 'a');
  assert.equal(el.children.length, 1);
  assert.equal(el.scrollTop, 99);
});
