import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseTurn, evaluate, generateTurns, stateKey } from '../src/ai.js';
import { applyAction, isOver, legalActions } from '../src/rules.js';
import { initialState } from '../src/state.js';
import { stateFromAscii, emptyRows, put } from './helpers.js';

function board(placements, opts = {}) {
  const rows = emptyRows();
  for (const [x, y, ch] of placements) put(rows, x, y, ch);
  return stateFromAscii(rows, opts);
}

// Small deterministic PRNG (mulberry32).
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Applies a chosen turn; each action must be legal in sequence and the turn must end
// at a turn boundary (counter phase again, or the game over).
function playOut(s, actions) {
  assert.ok(actions.length > 0, 'non-empty sequence');
  let n = s;
  for (const a of actions) n = applyAction(n, a);
  assert.ok(isOver(n) || n.phase === 'counter', 'sequence completes the turn');
  return n;
}

for (const level of ['beginner', 'medium', 'master']) {
  test(`${level}: returns a legal full turn from the initial position`, () => {
    const s = initialState('R');
    playOut(s, chooseTurn(s, level, { timeMs: 300, rng: seeded(1) }));
  });
}

test('beginner with a seeded rng is deterministic', () => {
  const s = initialState('R');
  for (let seed = 1; seed <= 10; seed++) {
    const a = chooseTurn(s, 'beginner', { rng: seeded(seed) });
    const b = chooseTurn(s, 'beginner', { rng: seeded(seed) });
    assert.deepEqual(a, b);
  }
});

test('master finds a one-turn goal (Fig. 10 position)', () => {
  const s = board([
    [2, 1, 'o'],
    [4, 6, 'g'], [7, 5, 'R'], [2, 3, 'R'], [6, 1, 'R'], [2, -1, 'R'],
    [5, 3, 'W'], [1, 4, 'W'], [4, 0, 'W'], [2, -2, 'W'], [5, -5, 'G'],
  ]);
  const n = playOut(s, chooseTurn(s, 'master', { timeMs: 500 }));
  assert.equal(n.score.W, 1);
});

test('master honours timeMs: 200 on the initial position', () => {
  const s = initialState('R');
  const t0 = Date.now();
  playOut(s, chooseTurn(s, 'master', { timeMs: 200 }));
  assert.ok(Date.now() - t0 < 400, `took ${Date.now() - t0} ms`);
});

test('master always returns a legal full turn, even with timeMs: 1', () => {
  const s = initialState('W');
  playOut(s, chooseTurn(s, 'master', { timeMs: 1 }));
});

test('evaluate: goal difference dominates and is antisymmetric', () => {
  const s = initialState('W');
  s.score = { W: 1, R: 0 };
  assert.ok(evaluate(s, 'W') > 500);
  assert.equal(evaluate(s, 'W'), -evaluate(s, 'R'));
});

test('evaluate: put-out is scored by who is ahead', () => {
  const s = initialState('W');
  s.score = { W: 1, R: 0 };
  const ahead = { ...s, result: { winner: 'W', reason: 'put-out' } };
  const level = { ...s, score: { W: 0, R: 0 }, result: { winner: null, reason: 'put-out' } };
  assert.ok(evaluate(ahead, 'W') > evaluate(s, 'W'), 'ahead: put-out beats playing on');
  assert.ok(evaluate(ahead, 'R') < evaluate(s, 'R'), 'behind: put-out is worst');
  assert.equal(evaluate(level, 'W'), 0);
});

// All whole-turn outcomes by brute force over action sequences. Every put-out ends the
// game with the same result, so they count as one outcome.
function bruteOutcomes(s) {
  const out = new Set();
  (function rec(st) {
    for (const a of legalActions(st)) {
      const n = applyAction(st, a);
      if (n.result || n.phase === 'counter') out.add(n.result?.reason === 'put-out' ? 'put-out' : stateKey(n));
      else rec(n);
    }
  })(s);
  return out;
}

test('generateTurns yields every distinct whole-turn outcome, each replayable', () => {
  const rng = seeded(5);
  let checked = 0;
  for (let g = 0; g < 4; g++) {
    let s = initialState(g % 2 ? 'W' : 'R');
    for (let i = 0; i < 25 && !isOver(s); i++) {
      const turns = generateTurns(s);
      const keys = turns.map((t) => (t.state.result?.reason === 'put-out' ? 'put-out' : stateKey(t.state)));
      assert.equal(new Set(keys).size, keys.length, 'no duplicate outcomes');
      for (const t of turns) assert.deepEqual(playOut(s, t.actions), t.state);
      assert.deepEqual(new Set(keys), bruteOutcomes(s));
      checked++;
      s = turns[Math.floor(rng() * turns.length)].state;
    }
  }
  assert.ok(checked > 50);
});

test('generateTurns finds a put-out reached by passing into a dead end on the last move', () => {
  // From random play: Red can end the game only via a pass sequence whose last pass
  // (ballMovesUsed 3) lands on a square with no legal leave.
  const s = initialState('R');
  s.players.W = [{ x: 0, y: -1 }, { x: 8, y: -1 }, { x: 3, y: -3 }, { x: 7, y: -3 }];
  s.players.R = [{ x: 4, y: -1 }, { x: 8, y: 1 }, { x: 3, y: 3 }, { x: 9, y: 1 }];
  s.gk = { W: { x: 3, y: -5 }, R: { x: 5, y: 5 } };
  s.ball = { x: 6, y: 2 };
  assert.ok(bruteOutcomes(s).has('put-out'));
  assert.ok(generateTurns(s).some((t) => t.state.result?.reason === 'put-out'));
});

test('ai-worker: answers {state, level} with {actions}', async () => {
  const posted = [];
  globalThis.self = { postMessage: (m) => posted.push(m) };
  try {
    await import('../src/ai-worker.js');
    const s = initialState('R');
    // A structured-clone copy, as a real worker receives it.
    self.onmessage({ data: { state: structuredClone(s), level: 'master', opts: { timeMs: 100 } } });
    assert.equal(posted.length, 1);
    playOut(s, posted[0].actions);
  } finally {
    delete globalThis.self;
  }
});

// --- Self-play harness ---------------------------------------------------------------
// Each game: seed g; the stronger level plays White in even games, Red in odd games;
// the first mover alternates every two games. A game is capped at 200 turns (one turn =
// one chooseTurn call); a capped or drawn game is not a win. Search levels get a fixed
// per-move node budget so results are deterministic and the file runs quickly.
const CAP = 200;
const BUDGET = { maxNodes: 1000 };

function playGame(strong, weak, g) {
  const rng = seeded(1000 + g);
  const strongTeam = g % 2 === 0 ? 'W' : 'R';
  let s = initialState(Math.floor(g / 2) % 2 === 0 ? 'W' : 'R');
  for (let turn = 0; turn < CAP && !isOver(s); turn++) {
    const level = s.turn === strongTeam ? strong : weak;
    const actions = chooseTurn(s, level, { rng, timeMs: 60000, ...BUDGET });
    for (const a of actions) s = applyAction(s, a);
  }
  if (!isOver(s)) return 'none';
  if (s.result.winner === null) return 'draw';
  return s.result.winner === strongTeam ? 'strong' : 'weak';
}

function match(strong, weak, games = 20) {
  const tally = { strong: 0, weak: 0, draw: 0, none: 0 };
  for (let g = 0; g < games; g++) tally[playGame(strong, weak, g)]++;
  return tally;
}

test('self-play: master beats beginner in at least 18 of 20', () => {
  const t = match('master', 'beginner');
  console.log('master vs beginner', t);
  assert.ok(t.strong >= 18, JSON.stringify(t));
});

test('self-play: master beats medium in at least 14 of 20', () => {
  const t = match('master', 'medium');
  console.log('master vs medium', t);
  assert.ok(t.strong >= 14, JSON.stringify(t));
});
