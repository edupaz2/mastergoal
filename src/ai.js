// Computer opponent: evaluation and search over whole turns.
//
// A "turn" here is the action list from a turn boundary (counter phase) to the next
// boundary: one counter move, then any ball moves, ending when the phase is back to
// 'counter' or the game is over. A goal (the scorer moves next) or a bonus square
// (bonusTurn) leaves `turn` unchanged; chooseTurn still returns at that boundary, so a
// caller must call chooseTurn again while `s.turn` is still the computer's team. Inside
// the search such a same-team continuation is a child searched from the same side.
//
// Levels:
// - beginner: 80% a uniformly random complete legal turn, else greedy one turn ahead.
// - medium:   2-turn search; on 20% of picks a random legal turn instead.
// - master:   iterative-deepening alpha-beta over turns until timeMs (default 2500)
//             expires; returns the best move of the deepest completed iteration.
// opts: { timeMs, rng, maxNodes, maxDepth, info }. maxNodes (count of nodes whose turns
// are generated) and maxDepth bound the search deterministically; the self-play tests
// use maxNodes. If given, `info` receives { depth, nodes } of the search.
import { legalCounterMoves, legalBallMoves, stepAction, ownerOfBall } from './rules.js';

const WIN = 100000;
const GOAL = 1000;
// Evaluation weights (tuned by self-play).
const W_BALL = 12;
const W_NEAR = 3;
const W_SUPPORT = 3;
const W_OWN = 15;
// Search: draw contempt, early-gain bonus per remaining ply, memory caps.
const CONTEMPT = 200;
const EARLY = 25;
const KID_CACHE_TURNS = 25000;
const TT_MAX = 200000;
// Level behaviour.
const BEGINNER_RANDOM = 0.8;
const MEDIUM_NOISE = 0.2;
const MEDIUM_DEPTH = 2;
const DEFAULT_TIME_MS = 2500;

const sqKey = (q) => `${q.x},${q.y}`;

// One char per square (any integer coordinates in -64..63, so parked test counters fit).
const code = (q) => ((q.x + 64) << 7) | (q.y + 64);

// Identity of a position for de-duplication and the transposition table. A team's
// Players are interchangeable, so their squares are sorted.
export function stateKey(s) {
  const c = [];
  for (const t of ['W', 'R']) {
    const p = s.players[t].map(code).sort((a, b) => a - b);
    c.push(...p, code(s.gk[t]));
  }
  c.push(code(s.ball));
  const r = s.result ? `${s.result.winner}${s.result.reason}` : '';
  return `${String.fromCharCode(...c)}${s.turn}${s.phase[0]}${s.ballMovesUsed}${s.score.W}${s.score.R}${s.bonusTurn ? 1 : 0}${r}`;
}

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// Score of `s` for `team` (higher is better). Antisymmetric: evaluate(s,W) = -evaluate(s,R).
// Terms, from White's side (White attacks +y): goal difference (dominant), ball
// advancement, counters within reach of the ball, Players pushed up in support, and
// ownership of the ball. Weights tuned with the self-play harness (see the Task 6
// report): the support term turned long 0:0 shuffles into decisive games.
export function evaluate(s, team) {
  const sign = team === 'W' ? 1 : -1;
  if (s.result) {
    // Covers put-out too: the engine gives the win to whoever is ahead, else a draw.
    if (s.result.winner === null) return 0;
    return s.result.winner === team ? WIN : -WIN;
  }
  let v = GOAL * (s.score.W - s.score.R);
  v += W_BALL * s.ball.y;
  let near = 0;
  for (const c of s.players.W) near += Math.max(0, 4 - cheb(c, s.ball));
  near += Math.max(0, 4 - cheb(s.gk.W, s.ball));
  for (const c of s.players.R) near -= Math.max(0, 4 - cheb(c, s.ball));
  near -= Math.max(0, 4 - cheb(s.gk.R, s.ball));
  v += W_NEAR * near;
  let support = 0;
  for (const c of s.players.W) support += c.y;
  for (const c of s.players.R) support += c.y;
  v += W_SUPPORT * support;
  const owner = ownerOfBall(s);
  if (owner === 'W') v += W_OWN;
  else if (owner === 'R') v -= W_OWN;
  return sign * v;
}

// Calls fn({ actions, state }) once per distinct turn outcome from `s`, stopping early
// when fn returns true. Ball phases are expanded breadth-first, visiting each (ball
// square, ball moves used) pair once, so the ball-move tree cannot explode. (Visiting
// each square only once, at its fewest moves used, keeps every other outcome but loses
// put-outs reached by passing into a dead end on the last move.) Outcomes are
// de-duplicated by (counter move, final ball square, flags): after one counter move
// the counters are fixed, so those determine the end state; every goal restarts from
// the same position; every put-out from `s` ends the game with the same result, so
// only the first one is kept. Counter moves that take the ball are expanded first
// (they matter most); the plain counter moves are emitted afterwards.
export function forEachTurn(s, fn) {
  if (s.result) return;
  const seenOutcome = new Set();
  let move = -1;
  const STOP = {};
  const emit = (n, actions) => {
    const goal = n.score[s.turn] !== s.score[s.turn];
    const k = goal ? 'goal' : n.result ? 'put-out' : `${move}|${code(n.ball)}|${n.bonusTurn ? 1 : 0}`;
    if (seenOutcome.has(k)) return;
    seenOutcome.add(k);
    if (fn({ actions, state: n })) throw STOP;
  };
  // `moves` = legalBallMoves(start), as stepAction already computed them.
  const expandBall = (start, moves, prefix) => {
    const at = (st) => `${sqKey(st.ball)}|${st.ballMovesUsed}`;
    const seen = new Set([at(start)]);
    let frontier = [{ st: start, moves, actions: prefix }];
    while (frontier.length) {
      const next = [];
      for (const f of frontier) {
        for (const a of f.moves) {
          const { state: n, ballMoves } = stepAction(f.st, a);
          const acts = [...f.actions, a];
          if (n.result || n.phase === 'counter') emit(n, acts);
          else if (!seen.has(at(n))) {
            seen.add(at(n));
            next.push({ st: n, moves: ballMoves, actions: acts });
          }
        }
      }
      frontier = next;
    }
  };
  try {
    if (s.phase === 'ball') {
      expandBall(s, legalBallMoves(s), []);
      return;
    }
    const plain = [];
    for (const a of legalCounterMoves(s)) {
      move++;
      const { state: n, ballMoves } = stepAction(s, a);
      if (n.result) emit(n, [a]);
      else if (n.phase === 'ball') expandBall(n, ballMoves, [a]);
      else plain.push({ m: move, n, a });
    }
    for (const p of plain) {
      move = p.m;
      emit(p.n, [p.a]);
    }
  } catch (err) {
    if (err !== STOP) throw err;
  }
}

// All distinct turn outcomes from `s`: [{ actions, state }] (see forEachTurn).
export function generateTurns(s) {
  const out = [];
  forEachTurn(s, (t) => { out.push(t); });
  return out;
}

// Search value of `n` for `team`, where `me` is the computer's team (the root mover).
// A drawn ending counts as -CONTEMPT for the computer (and +CONTEMPT for its opponent):
// without it a side that is slightly worse simply forces a 0:0 put-out, which is often
// available; with it the computer plays for a win and takes a draw only when clearly
// worse. Wins, losses and the score are as in evaluate().
function value(n, team, me) {
  if (n.result && n.result.winner === null) return team === me ? -CONTEMPT : CONTEMPT;
  return evaluate(n, team);
}

function greedy(s, turns) {
  let best = turns[0];
  let bestV = -Infinity;
  for (const t of turns) {
    const v = value(t.state, s.turn, s.turn);
    if (v > bestV) { bestV = v; best = t; }
  }
  return best.actions;
}

class Timeout {}

// Negamax alpha-beta over whole turns with a transposition table and a bounded cache
// of generated children (iterative deepening re-visits the same nodes).
function makeSearch({ deadline, maxNodes, me }) {
  const tt = new Map();
  const kids = new Map();
  let cached = 0; // turns held in `kids`; capped to bound memory (phones)
  let nodes = 0;

  function spend() {
    if (Date.now() > deadline || nodes >= maxNodes) throw new Timeout();
    nodes++;
  }

  function children(s, key) {
    let c = kids.get(key);
    if (c) return c;
    spend();
    c = generateTurns(s);
    for (const t of c) t.order = value(t.state, s.turn, me);
    c.sort((a, b) => b.order - a.order);
    if (cached + c.length <= KID_CACHE_TURNS) {
      kids.set(key, c);
      cached += c.length;
    }
    return c;
  }

  // Value of child `t` of node `s` (searched to `depth` more turns), from the side of
  // `s`'s mover. A turn that scores or wins earns EARLY per remaining ply, so a goal now
  // beats the same goal later (otherwise the search can postpone it forever). The
  // window is shifted by that bonus.
  function childValue(t, s, depth, alpha, beta) {
    const team = s.turn;
    const n = t.state;
    const gain = n.score[team] !== s.score[team] || (n.result && n.result.winner === team);
    const b = gain ? EARLY * (depth + 1) : 0;
    if (n.result || depth === 0) return value(n, team, me) + b;
    t.key ??= stateKey(n);
    if (n.turn === team) return search(n, t.key, depth, alpha - b, beta - b) + b;
    return b - search(n, t.key, depth, b - beta, b - alpha);
  }

  function search(s, key, depth, alpha, beta) {
    const e = tt.get(key);
    if (e && e.depth >= depth) {
      if (e.flag === 0) return e.value;
      if (e.flag === 1 && e.value >= beta) return e.value;
      if (e.flag === -1 && e.value <= alpha) return e.value;
    }
    if (depth === 1 && !kids.has(key)) return frontier(s, key, alpha, beta);
    // TT move = index into the (deterministic) child list, tried first.
    const list = children(s, key);
    const first = e ? e.best : -1;
    const a0 = alpha;
    let bestV = -Infinity;
    let best = -1;
    for (let j = first >= 0 ? -1 : 0; j < list.length; j++) {
      if (j === first) continue;
      const i = j < 0 ? first : j;
      const v = childValue(list[i], s, depth - 1, alpha, beta);
      if (v > bestV) { bestV = v; best = i; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    if (bestV === -Infinity) bestV = value(s, s.turn, me);
    const flag = bestV <= a0 ? -1 : bestV >= beta ? 1 : 0;
    if (tt.size >= TT_MAX) tt.clear();
    tt.set(key, { depth, value: bestV, flag, best });
    return bestV;
  }

  // A node whose children are all leaves: evaluate them as they are generated and stop
  // at the first one that reaches beta (ball-taking replies come first).
  function frontier(s, key, alpha, beta) {
    spend();
    let bestV = -Infinity;
    forEachTurn(s, (t) => {
      const v = childValue(t, s, 0, alpha, beta);
      if (v > bestV) bestV = v;
      return bestV >= beta;
    });
    if (bestV === -Infinity) bestV = value(s, s.turn, me);
    const flag = bestV <= alpha ? -1 : bestV >= beta ? 1 : 0;
    if (tt.size >= TT_MAX) tt.clear();
    tt.set(key, { depth: 1, value: bestV, flag, best: -1 });
    return bestV;
  }

  // Scores every root turn at `depth`; returns them best first.
  function root(s, rootTurns, depth) {
    let alpha = -Infinity;
    const scored = [];
    for (const t of rootTurns) {
      const v = childValue(t, s, depth - 1, alpha, Infinity);
      scored.push({ t, v });
      if (v > alpha) alpha = v;
    }
    // Stable: equal values keep the previous ordering.
    return scored.sort((a, b) => b.v - a.v);
  }

  return { root, nodes: () => nodes };
}

function searchTurn(s, maxDepth, opts) {
  const deadline = Date.now() + (opts.timeMs ?? DEFAULT_TIME_MS);
  const maxNodes = opts.maxNodes ?? Infinity;
  // Depth 1 is just this static ordering; it is always available, however short timeMs.
  let best = generateTurns(s);
  for (const t of best) t.order = value(t.state, s.turn, s.turn);
  best.sort((a, b) => b.order - a.order);
  if (best.length <= 1) return best;
  const search = makeSearch({ deadline, maxNodes, me: s.turn });
  for (let depth = 2; depth <= maxDepth; depth++) {
    try {
      const scored = search.root(s, best, depth);
      best = scored.map((x) => x.t);
      if (opts.info) opts.info.depth = depth;
      if (Math.abs(scored[0].v) >= WIN) break; // forced result found
    } catch (err) {
      if (!(err instanceof Timeout)) throw err;
      break;
    }
  }
  if (opts.info) opts.info.nodes = search.nodes();
  return best;
}

// The computer's whole turn for the side to move: [counter move, ...ball moves], each
// legal in sequence, ending at the next turn boundary (see the header about goals and
// bonus turns). Returns [] when the game is over or no turn exists.
export function chooseTurn(s, level, opts = {}) {
  const rng = opts.rng ?? Math.random;
  if (s.result) return [];
  if (level === 'beginner') {
    const turns = generateTurns(s);
    if (!turns.length) return [];
    if (rng() < BEGINNER_RANDOM) return turns[Math.floor(rng() * turns.length)].actions;
    return greedy(s, turns);
  }
  if (level === 'medium') {
    const noise = rng() < MEDIUM_NOISE;
    const pick = rng();
    const best = searchTurn(s, opts.maxDepth ?? MEDIUM_DEPTH, opts);
    if (!best.length) return [];
    return (noise ? best[Math.floor(pick * best.length)] : best[0]).actions;
  }
  if (level !== 'master') throw new Error(`unknown level: ${level}`);
  const best = searchTurn(s, opts.maxDepth ?? 64, opts);
  return best.length ? best[0].actions : [];
}
