import test from 'node:test';
import assert from 'node:assert/strict';
import { legalBallMoves, applyAction } from '../src/rules.js';
import { stateFromAscii, emptyRows, put } from './helpers.js';

// White passer P0 at (3,1) with the ball at (4,1); players P1 (7,0) and P2 (7,2) both
// touch the square (6,1), so a ball landing there needs a receiver.
function setup() {
  const rows = emptyRows();
  for (const [x, y, ch] of [[3, 1, 'W'], [7, 0, 'W'], [7, 2, 'W'], [4, 1, 'o']]) put(rows, x, y, ch);
  const s = stateFromAscii(rows);
  s.phase = 'ball';
  return s;
}

test('a pass to a square shared by several own players offers one move per receiver', () => {
  const s = setup();
  const moves = legalBallMoves(s).filter((m) => m.to.x === 6 && m.to.y === 1);
  assert.equal(moves.length, 2);
  assert.deepEqual(moves.map((m) => m.taker.index).sort(), [0, 2]); // (7,2) and (7,0); the passer (3,1) is index 1
});

test('the chosen receiver becomes the only taker for the next pass', () => {
  const s = setup();
  const land = (index) => applyAction(s, legalBallMoves(s).find((m) => m.to.x === 6 && m.to.y === 1 && m.taker.index === index));
  const toP2Only = (n) => legalBallMoves(n).some((m) => m.to.x === 8 && m.to.y === 3);
  const byP1 = land(2);
  assert.deepEqual(byP1.taker, { kind: 'P', index: 2 });
  assert.ok(toP2Only(byP1), 'the (7,0) receiver may pass to a square only (7,2) owns');
  assert.ok(!toP2Only(land(0)), 'the (7,2) receiver may not pass to his own exclusive square');
  assert.throws(() => applyAction(s, { kind: 'ball', to: { x: 6, y: 1 } }), /illegal/);
});
