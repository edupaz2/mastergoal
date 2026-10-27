// Board view: SVG drawn from code (no external images). White at the bottom, attacking up.
import { WIDTH, squareName } from './board.js';
import { armSquares } from './rules.js';

const NS = 'http://www.w3.org/2000/svg';
const C = 40;            // cell size in viewBox units
const M = 20;           // margin for edge labels
const ROWS = 15;         // y = 7 .. -7 (goal strips included)
const VW = M * 2 + C * WIDTH;
const VH = M * 2 + C * ROWS;
const YELLOW_X = [0, 3, 4, 5, 6, 7, 10];
const WIDTH_LABELS = ['0', '1', '2', '3', '4', '', '5', '6', '7', '8', '9'];

const cx = (x) => M + x * C + C / 2;
const cy = (y) => M + (7 - y) * C + C / 2;
const left = (x) => M + x * C;
const top = (y) => M + (7 - y) * C;

function el(name, attrs, parent, text) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

const inGoal = (x, y) => Math.abs(y) === 7 && x >= 3 && x <= 7;

function defs(svg) {
  const d = el('defs', {}, svg);
  const grad = (id, light, mid, dark) => {
    const g = el('radialGradient', { id, cx: '35%', cy: '30%', r: '70%' }, d);
    el('stop', { offset: '0', 'stop-color': light }, g);
    el('stop', { offset: '0.45', 'stop-color': mid }, g);
    el('stop', { offset: '1', 'stop-color': dark }, g);
  };
  grad('g-W', '#ffffff', '#e8e4da', '#9a968c');
  grad('g-R', '#ff9a8a', '#d3241c', '#6e0a08');
  // Ball shading: a translucent highlight-to-shadow layer over its white and yellow quarters.
  const shade = el('radialGradient', { id: 'g-ball-shade', cx: '35%', cy: '30%', r: '70%' }, d);
  el('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': 0.5 }, shade);
  el('stop', { offset: '0.45', 'stop-color': '#fff', 'stop-opacity': 0 }, shade);
  el('stop', { offset: '1', 'stop-color': '#000', 'stop-opacity': 0.35 }, shade);
}

function buildStatic(svg, onClick) {
  defs(svg);
  el('rect', { x: 0, y: 0, width: VW, height: VH, rx: 10, fill: '#b3201a' }, svg);
  el('rect', { x: M - 4, y: M - 4, width: C * WIDTH + 8, height: C * ROWS + 8, fill: '#8a1511' }, svg);
  const sq = el('g', { class: 'squares' }, svg);
  for (let y = 7; y >= -7; y--) {
    for (let x = 0; x < WIDTH; x++) {
      if (Math.abs(y) === 7 && !inGoal(x, y)) continue;
      const dark = (x + y) % 2 === 0;
      const fill = inGoal(x, y) ? (dark ? '#d9d4c4' : '#ece8da') : dark ? '#6f8a3c' : '#86a24d';
      el('rect', { x: left(x), y: top(y), width: C, height: C, fill }, sq);
    }
  }
  // Large (9x4) and small (7x2) areas at both ends, then the goal posts.
  const lines = el('g', { fill: 'none', stroke: '#f2c832', 'stroke-width': 2.5 }, svg);
  for (const t of ['W', 'R']) {
    const y0 = t === 'W' ? -6 : 6;
    const dir = t === 'W' ? 1 : -1;
    const rect = (x1, x2, rows) => {
      const ya = top(y0), yb = top(y0 + dir * (rows - 1));
      el('rect', { x: left(x1), y: Math.min(ya, yb), width: C * (x2 - x1 + 1), height: C * rows }, lines);
    };
    rect(1, 9, 4);
    rect(2, 8, 2);
  }
  for (const y of [7, -7]) el('rect', { x: left(3), y: top(y), width: C * 5, height: C }, lines);
  // Dots: yellow on the end lines, green on start squares and centre.
  const dots = el('g', {}, svg);
  for (const y of [-6, 6]) for (const x of YELLOW_X) el('circle', { cx: cx(x), cy: cy(y), r: 5, fill: '#f2c832' }, dots);
  // Ball's start square: a yellow ring, larger than the ball so it shows around it.
  el('circle', { cx: cx(5), cy: cy(0), r: 18.5, fill: 'none', stroke: '#f2c832', 'stroke-width': 3 }, dots);
  // Counters' start squares: a green centre dot.
  const start = [[2, -1], [8, -1], [3, -3], [7, -3], [5, -5], [2, 1], [8, 1], [3, 3], [7, 3], [5, 5]];
  for (const [x, y] of start) el('circle', { cx: cx(x), cy: cy(y), r: 6, fill: '#0f5a24', stroke: '#e9f5d0', 'stroke-width': 1.5 }, dots);
  // Edge labels (width: 0 1 2 3 4 _ 5 6 7 8 9; length: 6. .. 1. 0 1 .. 6, dotted half = White's).
  const lab = el('g', { class: 'labels', fill: '#f6e9d0', 'font-size': 16, 'font-weight': 'bold', 'font-family': 'Georgia, serif', 'text-anchor': 'middle' }, svg);
  for (let x = 0; x < WIDTH; x++) {
    if (!WIDTH_LABELS[x]) continue;
    el('text', { x: cx(x), y: M / 2 + 4.5 }, lab, WIDTH_LABELS[x]);
    el('text', { x: cx(x), y: VH - M / 2 + 4.5 }, lab, WIDTH_LABELS[x]);
  }
  for (let y = -6; y <= 6; y++) {
    const t = String(Math.abs(y)) + (y < 0 ? '.' : '');
    el('text', { x: M / 2, y: cy(y) + 4.5 }, lab, t);
    el('text', { x: VW - M / 2, y: cy(y) + 4.5 }, lab, t);
  }
  const hl = el('g', { class: 'highlights' }, svg);
  const pieces = el('g', { class: 'pieces' }, svg);
  const hit = el('g', { class: 'hit', fill: 'transparent' }, svg);
  for (let y = 7; y >= -7; y--) {
    for (let x = 0; x < WIDTH; x++) {
      if (Math.abs(y) === 7 && !inGoal(x, y)) continue;
      const r = el('rect', { x: left(x), y: top(y), width: C, height: C, 'data-x': x, 'data-y': y }, hit);
      r.setAttribute('aria-label', squareName({ x, y }));
    }
  }
  svg.addEventListener('click', (e) => {
    const t = e.target;
    if (!t.getAttribute || t.getAttribute('data-x') === null) return;
    onClick({ x: +t.getAttribute('data-x'), y: +t.getAttribute('data-y') });
  });
  return { hl, pieces };
}

// Top marks of the original counters, by player index (start squares: (2,1.) plain,
// (7,1.) dot, (3,3.) horizontal line, (6,3.) plus; Red mirrors White).
const PLAYER_MARKS = ['plain', 'dot', 'line', 'plus'];

function counter(parent, x, y, team, mark, selected) {
  const g = el('g', { class: 'counter' + (selected ? ' selected' : '') }, parent);
  el('circle', { cx: cx(x) + 1.5, cy: cy(y) + 2.5, r: 15, fill: 'rgba(0,0,0,.35)' }, g);
  el('circle', { class: 'body', cx: cx(x), cy: cy(y), r: 15, fill: `url(#g-${team})`, stroke: team === 'W' ? '#8d887c' : '#4d0605', 'stroke-width': 1 }, g);
  el('ellipse', { cx: cx(x) - 5, cy: cy(y) - 7, rx: 6, ry: 3.5, fill: 'rgba(255,255,255,.55)' }, g);
  const [px, py] = [cx(x), cy(y)];
  const ink = team === 'W' ? 'rgba(60,55,45,.75)' : 'rgba(60,0,0,.8)';
  const stroke = { stroke: ink, 'stroke-width': 2.2, 'stroke-linecap': 'round' };
  if (mark === 'G') el('text', { x: px, y: py + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 'bold', fill: team === 'W' ? '#333' : '#fff', 'font-family': 'Georgia, serif' }, g, 'G');
  if (mark === 'dot') el('circle', { cx: px, cy: py, r: 2.6, fill: ink }, g);
  if (mark === 'line' || mark === 'plus') el('line', { x1: px - 8, y1: py, x2: px + 8, y2: py, ...stroke }, g);
  if (mark === 'plus') el('line', { x1: px, y1: py - 8, x2: px, y2: py + 8, ...stroke }, g);
}

export function createBoardView(root, handlers) {
  root.textContent = '';
  const svg = el('svg', { viewBox: `0 0 ${VW} ${VH}`, class: 'board-svg', role: 'img', 'aria-label': 'Mastergoal board' }, root);
  const { hl, pieces } = buildStatic(svg, (sq) => handlers.onSquare(sq));

  function render(state, opts = {}) {
    const { selected, targets = [], lastMove = [], thinking = false } = opts;
    root.dataset.thinking = thinking ? 'true' : 'false';
    hl.textContent = '';
    pieces.textContent = '';

    for (const a of lastMove) {
      for (const sq of [a.from, a.to]) {
        if (sq) el('rect', { x: left(sq.x) + 2, y: top(sq.y) + 2, width: C - 4, height: C - 4, class: 'last-move' }, hl);
      }
    }
    for (const t of targets) {
      el('rect', { x: left(t.x) + 1, y: top(t.y) + 1, width: C - 2, height: C - 2, class: 'target-ring' }, hl);
      el('circle', { cx: cx(t.x), cy: cy(t.y), r: 9, class: 'target' }, hl);
    }

    // Goal-keeper arms: two horizontal stubs, only while inside his own large area.
    for (const team of ['W', 'R']) {
      const gk = state.gk[team];
      for (const arm of armSquares(state, team)) {
        el('line', { x1: cx(gk.x), y1: cy(gk.y), x2: cx(arm.x), y2: cy(arm.y), class: 'arm', stroke: team === 'W' ? '#f4f1e8' : '#e0342b' }, pieces);
      }
    }
    const isSel = (team, kind, index) => !!selected && selected.team === team && selected.kind === kind && selected.index === index;
    for (const team of ['W', 'R']) {
      state.players[team].forEach((p, i) => counter(pieces, p.x, p.y, team, PLAYER_MARKS[i], isSel(team, 'P', i)));
      const gk = state.gk[team];
      counter(pieces, gk.x, gk.y, team, 'G', isSel(team, 'G', 0));
    }
    const b = state.ball;
    const bg = el('g', { class: 'ball' }, pieces);
    el('circle', { cx: cx(b.x) + 1, cy: cy(b.y) + 2, r: 9, fill: 'rgba(0,0,0,.4)' }, bg);
    // Quartered like the leaflet's ball (Fig. 3): white, with yellow top-right and
    // bottom-left quarters.
    const [bx, by, r] = [cx(b.x), cy(b.y), 9];
    el('circle', { cx: bx, cy: by, r, fill: '#fbfaf5' }, bg);
    el('path', {
      d: `M${bx} ${by}H${bx + r}A${r} ${r} 0 0 0 ${bx} ${by - r}Z M${bx} ${by}H${bx - r}A${r} ${r} 0 0 0 ${bx} ${by + r}Z`,
      fill: '#f5c518',
    }, bg);
    el('circle', { cx: bx, cy: by, r, fill: 'url(#g-ball-shade)' }, bg);
    el('circle', { class: 'body', cx: bx, cy: by, r, fill: 'none', stroke: '#8a7a48', 'stroke-width': 1 }, bg);

    // Side panel (each element optional so the view works without the page shell).
    const set = (id, txt) => { const n = document.getElementById(id); if (n) n.textContent = txt; };
    set('score-w', state.score.W);
    set('score-r', state.score.R);
    const name = (t) => (t === 'W' ? 'White' : 'Red');
    if (state.result) {
      set('turn', 'Game over');
      set('moves-left', '');
      set('status', state.result.winner ? `${name(state.result.winner)} wins` : 'Draw');
    } else {
      set('turn', `${name(state.turn)} to move`);
      set('moves-left', state.phase === 'ball' ? `Ball moves left: ${Math.max(0, 4 - state.ballMovesUsed)}` : 'Move a counter');
      set('status', thinking ? 'Thinking...' : '');
    }
  }
  return { render };
}
