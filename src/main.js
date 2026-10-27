// Game controller: wires the engine, the computer opponent and the board view.
// The user plays White, the computer Red. A coin toss decides who starts.
//
// Input rule (Review Focus 1): board taps are honoured only while it is White's turn,
// the game is running and the controller is not busy (computer thinking or its moves
// being played back). Every async step carries the game id it started in and stops
// as soon as a New game replaced it, so stale replies never touch the current state.
import { createBoardView } from './ui.js';
import { initialState } from './state.js';
import { legalActions, applyAction } from './rules.js';
import { chooseTurn } from './ai.js';
import { describeTurn, createHistory } from './history.js';
import { sqEq } from './board.js';
import { initAnalytics, track } from './analytics.js';
import { language, pickLanguage, setLanguage, t, teamName, translatePage } from './i18n.js';

const USER = 'W';
const CPU = 'R';
const STEP_MS = 3000;          // each computer action stays on screen this long
const MIN_THINK_MS = 400;      // the "thinking" state stays visible at least this long
const FALLBACK_TIME_MS = 1500; // main-thread search budget when the worker is unusable
const WORKER_TIMEOUT_MS = 12000;

const $ = (id) => document.getElementById(id);
const LANG_KEY = 'mastergoal-language';
// A language picked in the selector wins over the browser's languages.
function savedLanguage() {
  try { return localStorage.getItem(LANG_KEY); } catch { return null; }
}
setLanguage(savedLanguage() ?? pickLanguage(navigator.languages ?? [navigator.language]));
translatePage(document);
const levelSelect = $('level');
const languageSelect = $('language');
languageSelect.value = language();
const history = createHistory($('history'));
const view = createBoardView($('board'), { onSquare });

let gameId = 0;
let state = null;
let level = 'medium';
let busy = false;       // computer thinking or playing back its moves
let thinking = false;
let selected = null;    // PieceRef of the user's selected counter
let lastMove = [];      // actions of the latest turn, each with a `from` square
let turnBefore = null;  // state at the start of the turn in progress
let turnActions = [];
let turnNo = 0;
let note = '';          // string key of the controller message under the status line
let endTeam = null;     // the side left with no legal move, if that ended the game
let first = null;       // the coin-toss winner
let goalView = null;    // the computer's goal kept on screen, before the kick-off reset

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const samePiece = (a, b) => !!a && !!b && a.team === b.team && a.kind === b.kind && a.index === b.index;
const leader = (score) => (score.W > score.R ? 'W' : score.R > score.W ? 'R' : null);

// ---- Worker -----------------------------------------------------------------------
// One request at a time. Any failure (creation throws, load/runtime `error` event,
// `{error}` or empty reply, timeout) resolves to null and the caller falls back to
// chooseTurn on the main thread.
let worker = null;
let workerBroken = false;
let pending = null;

function dropWorker() {
  if (worker) worker.terminate();
  worker = null;
}

function failPending() {
  const p = pending;
  pending = null;
  if (p) p(null);
}

function getWorker() {
  if (worker || workerBroken) return worker;
  try {
    const w = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' });
    w.onmessage = (e) => {
      const p = pending;
      pending = null;
      if (p) p(e.data);
    };
    w.onerror = w.onmessageerror = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      console.warn('AI worker failed; using the main thread', e && e.message);
      workerBroken = true;
      if (worker === w) dropWorker();
      failPending();
    };
    worker = w;
  } catch (err) {
    console.warn('AI worker unavailable; using the main thread', err);
    workerBroken = true;
  }
  return worker;
}

function askWorker(s, lvl) {
  const w = getWorker();
  if (!w) return Promise.resolve(null);
  return new Promise((resolve) => {
    const done = (data) => {
      clearTimeout(timer);
      const ok = data && !data.error && Array.isArray(data.actions) && data.actions.length > 0;
      if (data && data.error) console.warn('AI worker error:', data.error);
      resolve(ok ? data.actions : null);
    };
    const timer = setTimeout(() => {
      if (pending !== done) return;
      pending = null;
      dropWorker(); // a fresh one is created next time
      done(null);
    }, WORKER_TIMEOUT_MS);
    pending = done;
    w.postMessage({ state: s, level: lvl });
  });
}

// True when `actions` apply in order from `s` and only the last one may reach a turn
// boundary (chooseTurn's contract).
function playable(s, actions) {
  if (!Array.isArray(actions) || actions.length === 0) return false;
  try {
    let t = s;
    for (let i = 0; i < actions.length; i++) {
      if (i > 0 && atBoundary(t)) return false;
      t = applyAction(t, actions[i]);
    }
    return true;
  } catch {
    return false;
  }
}

// ---- Turn bookkeeping ---------------------------------------------------------------
// A turn ends when the phase returns to 'counter' (turn passed, bonus turn or goal reset)
// or the game ended (put-out keeps the 'ball' phase).
const atBoundary = (s) => s.phase === 'counter' || s.result !== null;

function fromSquare(s, a) {
  if (a.kind === 'ball') return s.ball;
  return a.piece.kind === 'G' ? s.gk[a.piece.team] : s.players[a.piece.team][a.piece.index];
}

// Applies one action of the side to move, records the turn in the history when it
// ends there. Returns true at a turn boundary.
function play(a) {
  if (turnActions.length === 0) {
    turnBefore = state;
    lastMove = [];
  }
  const team = state.turn;
  const prev = state;
  const from = fromSquare(state, a);
  const scoreBefore = state.score[team];
  state = applyAction(state, a);
  turnActions.push(a);
  lastMove.push({ ...a, from });
  if (!atBoundary(state)) return false;

  const scored = state.score[team] > scoreBefore;
  let text = describeTurn(team, turnActions, turnBefore, t('ball'));
  if (scored) text += ` — ${t('hGoal')}`;
  else if (state.result && state.result.reason === 'put-out') text += ` — ${t('hPutOut')}`;
  else if (state.bonusTurn) text += ` — ${t('hBonus')}`;
  history.add(++turnNo, text);
  turnActions = [];
  turnBefore = null;
  if (scored) {
    // Shown during the pause that follows: the ball in the goal, new score.
    if (team === CPU) goalView = { state: { ...state, players: prev.players, gk: prev.gk, ball: a.to }, lastMove };
    lastMove = []; // counters are back on their start squares
    note = team === USER ? 'goalYou' : 'goalCpu';
  } else if (state.bonusTurn) {
    note = team === USER ? 'bonusYou' : 'bonusCpu';
  } else {
    note = '';
  }
  return true;
}

// The side to move has no legal action and no result (should not happen): end the game
// like a put-out instead of hanging.
function endStuck() {
  const team = state.turn;
  if (turnActions.length) {
    history.add(++turnNo, `${describeTurn(team, turnActions, turnBefore, t('ball'))} — ${t('hNoMove')}`);
    turnActions = [];
    turnBefore = null;
  }
  state = { ...state, result: { winner: leader(state.score), reason: 'put-out' } };
  endTeam = team;
  busy = false;
  thinking = false;
  next();
}

// ---- Flow -----------------------------------------------------------------------------
function next() {
  selected = null;
  if (state.result) {
    busy = false;
    redraw();
    showBanner();
    return;
  }
  if (legalActions(state).length === 0) {
    endStuck();
    return;
  }
  if (state.turn === CPU) {
    computerTurn();
    return;
  }
  redraw();
}

async function computerTurn() {
  const id = gameId;
  const s = state;
  busy = true;
  thinking = true;
  redraw();
  const started = performance.now();
  let actions = await askWorker(s, level);
  if (id !== gameId) return;
  if (!playable(s, actions)) {
    await delay(30); // let the thinking state paint before blocking the main thread
    if (id !== gameId) return;
    try {
      actions = chooseTurn(s, level, { timeMs: FALLBACK_TIME_MS });
    } catch (err) {
      console.error('chooseTurn failed', err);
      actions = null;
    }
    if (!playable(s, actions)) actions = null;
  }
  await delay(Math.max(0, MIN_THINK_MS - (performance.now() - started)));
  if (id !== gameId) return;
  thinking = false;
  if (!actions) {
    endStuck();
    return;
  }
  for (let i = 0; i < actions.length; i++) {
    play(actions[i]);
    redraw();
    if (state.result) break;
    // No wait once the turn is the user's (the last move stays highlighted), except to
    // keep Red's goal on screen before the user kicks off.
    if (state.turn === USER && !goalView) break;
    await delay(STEP_MS);
    if (id !== gameId) return;
    goalView = null;
  }
  busy = false;
  next(); // asks again while it is still Red's turn (after a bonus square)
}

function onSquare(sq) {
  if (busy || !state || state.result || state.turn !== USER) return;
  const legal = legalActions(state);
  if (state.phase === 'ball') {
    const a = legal.find((m) => sqEq(m.to, sq));
    if (a) userPlay(a);
    return;
  }
  if (selected) {
    const a = legal.find((m) => samePiece(m.piece, selected) && sqEq(m.to, sq));
    if (a) {
      userPlay(a);
      return;
    }
  }
  const p = pieceAt(sq);
  const reselect = p && !samePiece(p, selected) && legal.some((m) => samePiece(m.piece, p));
  selected = reselect ? p : null;
  redraw();
}

function pieceAt(sq) {
  if (sqEq(state.gk[USER], sq)) return { team: USER, kind: 'G', index: 0 };
  const i = state.players[USER].findIndex((p) => sqEq(p, sq));
  return i >= 0 ? { team: USER, kind: 'P', index: i } : null;
}

function userPlay(a) {
  selected = null;
  note = '';
  if (play(a)) next();
  else redraw();
}

// ---- Rendering ------------------------------------------------------------------------
function redraw() {
  let targets = [];
  if (!busy && !state.result && state.turn === USER) {
    const legal = legalActions(state);
    if (state.phase === 'ball') targets = legal.map((m) => m.to);
    else if (selected) targets = legal.filter((m) => samePiece(m.piece, selected)).map((m) => m.to);
  }
  const shown = goalView ?? { state, lastMove };
  view.render(shown.state, { selected, targets, lastMove: shown.lastMove, thinking });
  let msg = note && t(note);
  if (!state.result) {
    if (busy && !thinking && !goalView) msg = t('cpuMoving');
    else if (!busy && state.turn === USER) {
      const hint = t(state.phase === 'ball' ? 'hintBall' : 'hintCounter');
      msg = note ? `${t(note)} ${hint}` : hint;
    }
  }
  $('message').textContent = msg;
}

function showBanner() {
  const r = state.result;
  track(r.winner === USER ? 'game-won' : r.winner === CPU ? 'game-lost' : 'game-drawn');
  bannerText();
  $('banner').hidden = false;
  $('message').textContent = '';
}

function bannerText() {
  const r = state.result;
  const score = `${state.score.W}:${state.score.R}`;
  const reason = t(r.reason === 'goals' ? 'finalScore' : 'putOutAt', { score });
  $('banner-title').textContent = t(r.winner === USER ? 'youWin' : r.winner === CPU ? 'youLose' : 'draw');
  $('banner-reason').textContent = endTeam ? `${t('noLegalMove', { team: teamName(endTeam) })} ${reason}` : reason;
}

function tossText() {
  $('toss').textContent = t(first === USER ? 'tossYou' : 'tossCpu', { level: t(level) });
}

// Moves already in the history keep the language they were written in.
function onLanguage() {
  setLanguage(languageSelect.value);
  try { localStorage.setItem(LANG_KEY, language()); } catch { /* not saved: still applies now */ }
  translatePage(document);
  $('board').querySelector('svg')?.setAttribute('aria-label', t('board'));
  tossText();
  $('level-note').textContent = levelSelect.value === level ? '' : t('levelNote');
  redraw();
  if (state.result) {
    $('message').textContent = '';
    bannerText();
  }
}

function newGame() {
  gameId++;
  failPending();
  dropWorker(); // stops a search of the abandoned game
  level = levelSelect.value;
  busy = false;
  thinking = false;
  selected = null;
  lastMove = [];
  turnBefore = null;
  turnActions = [];
  turnNo = 0;
  note = '';
  endTeam = null;
  goalView = null;
  history.clear();
  $('banner').hidden = true;
  first = Math.random() < 0.5 ? USER : CPU;
  state = initialState(first);
  tossText();
  $('level-note').textContent = '';
  next();
}

levelSelect.addEventListener('change', () => {
  track(`level-${levelSelect.value}`);
  $('level-note').textContent = levelSelect.value === level ? '' : t('levelNote');
});
// Only the buttons count as new-game; the first game starts on page load.
const onNewGame = () => {
  track('new-game');
  newGame();
};
$('new-game').addEventListener('click', onNewGame);
$('rules-open').addEventListener('click', () => $('rules').showModal());
languageSelect.addEventListener('change', onLanguage);
$('banner-new').addEventListener('click', onNewGame);

initAnalytics();
newGame();
