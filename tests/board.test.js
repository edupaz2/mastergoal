import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inPitch, goalDefender, inSmallArea, inLargeArea, isCorner,
  squareName, neighbors, sqEq, WIDTH, LENGTH,
} from '../src/board.js';

test('dimensions', () => {
  assert.equal(WIDTH, 11);
  assert.equal(LENGTH, 13);
});

test('inPitch', () => {
  assert.equal(inPitch({ x: 0, y: -6 }), true);
  assert.equal(inPitch({ x: 11, y: 0 }), false);
  assert.equal(inPitch({ x: 5, y: 7 }), false);
});

test('goalDefender', () => {
  assert.equal(goalDefender({ x: 5, y: -7 }), 'W');
  assert.equal(goalDefender({ x: 5, y: 7 }), 'R');
  assert.equal(goalDefender({ x: 2, y: 7 }), null);
  assert.equal(goalDefender({ x: 3, y: 7 }), 'R');
  assert.equal(goalDefender({ x: 7, y: 7 }), 'R');
  assert.equal(goalDefender({ x: 5, y: 0 }), null);
});

test('inSmallArea', () => {
  assert.equal(inSmallArea({ x: 2, y: -5 }, 'W'), true);
  assert.equal(inSmallArea({ x: 1, y: -5 }, 'W'), false);
  assert.equal(inSmallArea({ x: 8, y: -6 }, 'W'), true);
  assert.equal(inSmallArea({ x: 5, y: -4 }, 'W'), false);
  assert.equal(inSmallArea({ x: 5, y: 5 }, 'R'), true);
});

test('inLargeArea', () => {
  assert.equal(inLargeArea({ x: 1, y: -3 }, 'W'), true);
  assert.equal(inLargeArea({ x: 0, y: -3 }, 'W'), false);
  assert.equal(inLargeArea({ x: 5, y: -2 }, 'W'), false);
  assert.equal(inLargeArea({ x: 5, y: 3 }, 'R'), true);
});

test('isCorner', () => {
  assert.equal(isCorner({ x: 10, y: 6 }), true);
  assert.equal(isCorner({ x: 5, y: 6 }), false);
});

test('squareName', () => {
  assert.equal(squareName({ x: 2, y: -3 }), '(2,3.)');
  assert.equal(squareName({ x: 10, y: 6 }), '(9,6)');
  assert.equal(squareName({ x: 4, y: 0 }), '(4,0)');
  assert.equal(squareName({ x: 5, y: 0 }), '(B,0)');
});

test('neighbors', () => {
  assert.equal(neighbors({ x: 0, y: -6 }).length, 3);
  assert.equal(neighbors({ x: 5, y: 0 }).length, 8);
});

test('sqEq', () => {
  assert.equal(sqEq({ x: 1, y: 2 }, { x: 1, y: 2 }), true);
  assert.equal(sqEq({ x: 1, y: 2 }, { x: 2, y: 1 }), false);
});
