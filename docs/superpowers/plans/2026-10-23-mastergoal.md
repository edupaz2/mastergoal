# Mastergoal Web Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static web page where the user plays the full leaflet ruleset of Mastergoal against a computer opponent at three levels, in the classic leaflet look, hosted on GitHub Pages.

**Architecture:** A pure, DOM-free rules engine (`src/rules.js`) over an immutable state object, tested with Node's built-in test runner and fixtures taken from the leaflet figures. A search-based AI (`src/ai.js`) runs in a web worker. A thin UI layer (`src/ui.js`, `src/history.js`, `src/main.js`) renders an SVG/CSS board and drives the engine. No framework, no build step.

**Tech Stack:** HTML, CSS, vanilla ES modules (`type="module"`). Dev-only: Node 20+ (`node --test`), not needed to run the site. Serve locally with `python3 -m http.server` (ES modules do not load from `file://`).

**Spec:** `docs/superpowers/specs/2026-10-23-mastergoal-design.md` (approved 2026-10-23). The leaflet photos `IMG_5223.HEIC`, `IMG_5224.HEIC`, `IMG_5225.HEIC` in the project root are the rulebook; executors read both.

## Global Constraints

- Plain HTML, CSS, JavaScript. No framework, no build step, no server, no runtime dependencies.
- Pitch is 11 squares wide and 13 long; goal strip is 5 squares wide; large area 9 wide × 4 deep; small area 7 wide × 2 deep.
- Match ends after 2 goals in total (1:1 is a draw). After a goal the scorer moves next. Ball put out = the team that must move the ball has no legal destination; game ends, higher score wins, level is a draw.
- User is White, computer is Red. Levels: Beginner, Medium, Master. Master replies within about 3 seconds on a phone.
- Classic leaflet look (olive checkerboard, red border, yellow lines and dots, glossy red/white marbles, cream ball). Board edge labels: width `0 1 2 3 4 (blank) 5 6 7 8 9`, length `6. 5. 4. 3. 2. 1. 0 1 2 3 4 5 6`.
- Works on desktop, phone and tablet: no horizontal scroll, no pinch-zoom needed; side panel beside the board when wide, below when narrow.
- Move history panel is the only extra feature. No undo, hints, sound, accounts, persistence.
- Do not copy leaflet images, logo or text into the published site. Do not commit the HEIC photos (`.gitignore` them).
- Never push to the remote without the user saying so.

## Review Focus

1. User taps/clicks while the computer is "thinking": input must be ignored and no state corrupted.
2. A ball landing exactly where ownership is neutral or equal (0 vs 0, 1 vs 1) on moves 1–3: turn must not end silently or leave the user stuck with no legal action; put-out must be detected instead.
3. Goal-keeper on the edge of his area with one arm off the pitch: only the on-pitch arm counts as arm square.
4. Phone in portrait and landscape: the whole board and the side panel stay reachable; tapping a small square is reliable.
5. Master level on a slow device: search is time-boxed and always returns a legal action; the page never freezes.

---

## File Structure

- `index.html`, `style.css` — page shell and classic leaflet styling.
- `src/board.js` — geometry constants, square helpers, square names.
- `src/state.js` — state shape, `initialState`, `cloneState`.
- `src/rules.js` — ownership, legal actions, `applyAction`, turn flow, goals, put-out, match end.
- `src/ai.js` — evaluation and search, three levels. `src/ai-worker.js` — worker wrapper.
- `src/history.js` — move notation and history list.
- `src/ui.js` — board rendering, input, side panel. `src/main.js` — wiring and game controller.
- `tests/helpers.js` — `stateFromAscii`. `tests/*.test.js` — one file per module.
- `.gitignore`, `README.md`.

## Shared types (every task uses these exact shapes)

```js
// Square: x = width index 0..10 (centre file is 5), y = length index -6..6 (centre line 0).
// White defends y = -6 / goal at y = -7 and attacks toward +y. Red is the mirror image.
// Team: 'W' | 'R'
// PieceRef: { team: Team, kind: 'P' | 'G', index: number }   // index 0..3 for 'P', 0 for 'G'
// State: {
//   players: { W: Square[4], R: Square[4] }, gk: { W: Square, R: Square }, ball: Square,
//   turn: Team, phase: 'counter' | 'ball', ballMovesUsed: number,
//   score: { W: number, R: number },
//   result: null | { winner: Team | null, reason: 'goals' | 'put-out' },
//   bonusTurn: boolean
// }
// Action: { kind: 'move', piece: PieceRef, to: Square } | { kind: 'ball', to: Square }
```

---

### Task 1: Project setup and board geometry

**Files:**
- Create: `.gitignore`, `package.json` (`{"type":"module","scripts":{"test":"node --test tests/"}}`), `src/board.js`, `tests/board.test.js`

**Interfaces:**
- Produces (`src/board.js`): `WIDTH = 11`, `LENGTH = 13`, `inPitch(sq): boolean`, `goalDefender(sq): Team | null` (White defends `y = -7`, `x` 3..7; Red `y = 7`), `inSmallArea(sq, team): boolean`, `inLargeArea(sq, team): boolean`, `isCorner(sq): boolean`, `squareName(sq): string`, `neighbors(sq): Square[]` (the 8 adjacent squares, pitch squares only plus goal squares), `sqEq(a, b): boolean`.

- [ ] **Step 1:** Run `node -v`. If missing or below 20, tell the user Node is needed for tests only and ask before running `brew install node`. Create `.gitignore` containing `*.HEIC`, `.superpowers/`, `node_modules/`; run `git init -b main` and set the remote `git@edupaz-github.com:edupaz2/mastergoal.git` (do not push).
- [ ] **Step 2: Write failing tests** in `tests/board.test.js`: `inPitch({x:0,y:-6})` true; `inPitch({x:11,y:0})` false; `goalDefender({x:5,y:-7})` is `'W'` and `{x:5,y:7}` is `'R'`; `goalDefender({x:2,y:7})` is null and `{x:3,y:7}`, `{x:7,y:7}` are `'R'`; `inSmallArea({x:2,y:-5},'W')` true, `{x:1,y:-5}` false, `{x:8,y:-6}` true, `{x:5,y:-4}` false; `inLargeArea({x:1,y:-3},'W')` true, `{x:0,y:-3}` false, `{x:5,y:-2}` false; `isCorner({x:10,y:6})` true, `{x:5,y:6}` false; `squareName({x:2,y:-3})==='23.'`, `squareName({x:10,y:6})==='96'` (width labels after the blank centre file are shifted: x 6..10 are labelled 5..9), `squareName({x:4,y:0})==='40'`; `neighbors({x:0,y:-6}).length===3`; `neighbors({x:5,y:0}).length===8`.
- [ ] **Step 3: Run** `node --test tests/board.test.js`; expected FAIL (module not found).
- [ ] **Step 4: Implement** the functions in `src/board.js` with the signatures above. Squares in goal strips (`|y| = 7`) are valid squares only for the ball; `neighbors` includes them only when the origin is in the pitch.
- [ ] **Step 5: Run** the same command; expected PASS. Commit: `git add -A && git commit -m "feat: board geometry"`.

### Task 2: State, start position and counter moves

**Files:**
- Create: `src/state.js`, `src/rules.js` (counter-move part), `tests/helpers.js`, `tests/counters.test.js`

**Interfaces:**
- Consumes: Task 1 (`inPitch`, `inSmallArea`, `isCorner`, `sqEq`).
- Produces: `initialState(firstTurn: Team): State` — start squares read from the leaflet cover photo; my reading, to be confirmed against it: White players at `(x2,y-1) (x8,y-1) (x3,y-3) (x7,y-3)`, White GK `(x5,y-5)`, Red mirrored (`y` negated), ball `(x5,y0)`. `cloneState(s): State`. `legalCounterMoves(s: State): Action[]` (kind `'move'`, for `s.turn`). Test helper `stateFromAscii(rows: string[13], opts?: {turn?: Team}): State` — rows run from `y=6` (first row) to `y=-6`, 11 characters each for `x=0..10`; `W`/`R` players, `G`/`g` White/Red goal-keeper, `o` ball, `.` empty; goal strips are not drawn.

- [ ] **Step 1: Read the photos.** Convert with `sips -s format jpeg -Z 4000 IMG_522x.HEIC --out <scratch>/x.jpg` (IMG_5224 is sideways; rotate 90°). Confirm the start squares, goal-keeper square, arm orientation, yellow-point squares and which corners are prohibited for which team (Fig. 8). Record findings as comments at the top of `src/state.js` and correct the start squares above if the photo disagrees.
- [ ] **Step 2: Write failing tests** in `tests/counters.test.js`: `initialState('W')` has 4 players and one GK per team, ball at `{x:5,y:0}`, `score` `{W:0,R:0}`, `result` null, `phase` `'counter'`; a lone White player at `{x:5,y:-2}` has exactly 16 destinations (8 directions × distance 1 or 2) with an empty board; a White player cannot move onto an occupied square nor jump over a counter at distance 1 to reach distance 2; no Player may enter `inSmallArea` of either team (test a player at `{x:5,y:-3}` against a White small area `{x:5,y:-5}` and `{x:5,y:-6}`); a White player may not move to a White corner or a Red corner according to the leaflet rule found in Step 1 (assert both); a counter move never targets a square off the pitch.
- [ ] **Step 3: Run** `node --test tests/counters.test.js`; expected FAIL.
- [ ] **Step 4: Implement** `state.js` and `legalCounterMoves` for Players and for the Goal-keeper (same movement as a Player outside his own large area; inside his own area he moves within the area, may enter the small area, and his arms stay parallel to the goal line — arms are derived from his square, not stored).
- [ ] **Step 5: Run** the tests; expected PASS. Commit: `git commit -am "feat: state and counter moves"`.

### Task 3: Ball ownership and possession

**Files:**
- Modify: `src/rules.js`; Create: `tests/ownership.test.js`

**Interfaces:**
- Consumes: Task 2 (`State`, `stateFromAscii`).
- Produces: `armSquares(s: State, team: Team): Square[]` (the on-pitch side squares of a Goal-keeper inside his own large area; empty otherwise), `ownerOfBall(s: State, at: Square = s.ball): Team | null` (strict majority of that team's counters on the 8 adjacent squares, excluding arm squares from the count; equal counts, including 0–0, give `null`; if `at` lies on a team's arm square it belongs to that team's Goal-keeper), `ownersExclusive(s, at, team): boolean` (true when `team` owns `at` through one single player only, used by the self-pass rule).

- [ ] **Step 1: Write failing tests** using the leaflet figures: Fig. A/B/C boards (1 vs 1 counters adjacent) give `null`; Fig. A1/B1/C1 boards after the mover adds a second adjacent player give that mover's team; Fig. 3 (single counter adjacent) gives that counter's team; Fig. 5 (ball inside the arm squares) gives the Goal-keeper's team regardless of adjacent opposing players; Fig. 7 (arm squares do not count in a majority); GK at the edge of the area with one arm off-pitch yields exactly one arm square.
- [ ] **Step 2: Run** `node --test tests/ownership.test.js`; expected FAIL.
- [ ] **Step 3: Implement** the three functions in `src/rules.js`.
- [ ] **Step 4: Run** the tests; expected PASS. Commit: `git commit -am "feat: ball ownership"`.

### Task 4: Ball moves, turn flow and match end

**Files:**
- Modify: `src/rules.js`; Create: `tests/turn.test.js`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `legalBallMoves(s: State): Action[]`, `legalActions(s: State): Action[]`, `applyAction(s: State, a: Action): State` (pure; returns a new state), `isOver(s: State): boolean`.

Rules to encode (all from the spec's Rules section; read the corresponding leaflet figure when a test fixture is needed):
- After a counter move, if the mover now owns the ball (`ownerOfBall(s)` is the mover's team) the phase becomes `'ball'` with `ballMovesUsed = 0`; otherwise the turn passes to the other team.
- A ball move goes in a straight line, 1–4 squares, 8 directions, may jump counters (Players, and Goal-keeper arms only outside the rule below) but never over a Goal-keeper or his arm squares inside his large area; it may never end on an occupied square, a prohibited corner, or enter a goal strip except by a diagonal or forward (toward the opponent's goal) move.
- Moves 1–3 (a move that is not the last possible) must end on a square owned by the mover's own team and satisfy the self-pass rule (the destination must be owned through at least one player other than the sole owner of the departure square, unless the departure square is owned by more than one player). The last permitted move (4th) and any move may instead end on a square owned by nobody and outside the mover's own large area, which ends the turn. A destination owned by the opponent is never legal.
- Entering a goal strip scores: `score[mover]++`, counters reset with `initialState`-style positions, the scorer moves next (`turn` = scorer), and `result` becomes `{winner, reason:'goals'}` once `score.W + score.R === 2` (winner is the higher score, `null` for 1:1).
- Landing on the opponent's end-line yellow-point squares (my reading, to confirm in Task 2: the end line squares in the goal's width plus the corners) when the ball ends there gives the same team another turn (`bonusTurn` true, fresh `phase 'counter'`, `ballMovesUsed` 0).
- Put out: if it is the mover's obligation to move the ball and `legalBallMoves` is empty, `result` becomes `{winner: higher score, reason:'put-out'}` (`null` when level).

- [ ] **Step 1: Write failing tests** in `tests/turn.test.js`: moving a counter that does not land next to the ball hands the turn to the other team; landing next to the ball makes `phase` `'ball'`; a 4-square straight ball move is legal and a 5-square one is not; the ball cannot jump a GK inside his large area; a first ball move to a square owned by nobody ends the turn and a first ball move to an opponent-owned square is illegal; a self-pass is illegal and a pass to a square owned by another own player is legal; the 4th ball move cannot end on an own-owned square; scoring by diagonal entry (Fig. 9 fixture, 4 moves) and by forward entry (Fig. 10 fixture, 3 moves) both give `score.W === 1` with `turn === 'W'` and counters back at the initial squares; a second goal ends the match with the right winner and a 1:1 match is a draw (`winner` null); a position with no legal destination for the obliged ball move ends the game with `reason 'put-out'` and the higher-score team as winner; a bonus-turn landing keeps `turn` and resets `ballMovesUsed`; `applyAction` does not mutate its input state.
- [ ] **Step 2: Run** `node --test tests/turn.test.js`; expected FAIL.
- [ ] **Step 3: Implement** the four functions in `src/rules.js`; `legalActions` returns `legalCounterMoves` when `phase==='counter'` and `legalBallMoves` when `phase==='ball'`; `applyAction` throws on an action not in `legalActions`.
- [ ] **Step 4: Run** the whole suite (`node --test tests/`); expected PASS. Commit: `git commit -am "feat: ball moves and turn flow"`.

### Task 5: Rules sweep against the leaflet

**Files:**
- Create: `tests/leaflet.test.js`

**Interfaces:**
- Consumes: Tasks 1–4. Produces: nothing new; a regression suite.

- [ ] **Step 1:** Re-read every figure (Fig. 1–10, A–C, A1–C1) and every rule paragraph in the photos. For each, add one test in `tests/leaflet.test.js` named after the figure (`'Fig. 6: pass between 2 players'`, ...) that asserts the legal and illegal actions the figure shows. Include the Fig. 8 corner rule, the goal-keeper "arms stay parallel" rule, neutral-square rules (A–C, A1–C1), and the self-pass rule.
- [ ] **Step 2: Run** `node --test tests/`. Fix any rule bug the new tests find in `src/rules.js` (each fix gets a one-line comment naming the figure). Expected final: PASS.
- [ ] **Step 3:** List in the commit message any leaflet sentence that remained ambiguous and the interpretation chosen. Commit: `git commit -am "test: leaflet rule sweep"`. Report that list to the user.

### Task 6: Computer opponent

**Files:**
- Create: `src/ai.js`, `src/ai-worker.js`, `tests/ai.test.js`

**Interfaces:**
- Consumes: `legalActions`, `applyAction`, `isOver` from Task 4.
- Produces: `chooseTurn(s: State, level: 'beginner' | 'medium' | 'master', opts?: { timeMs?: number, rng?: () => number }): Action[]` — returns the full ordered list of actions for the mover's current turn (counter move, then any ball moves), each legal in sequence; `evaluate(s: State, team: Team): number`. `src/ai-worker.js` receives `{state, level}` and posts back `{actions}`.

- [ ] **Step 1: Write failing tests**: every level returns a non-empty sequence whose actions apply in order without throwing, from `initialState('R')`; with a seeded `rng`, Beginner returns the same sequence twice; when a one-move goal exists (Fig. 10 style fixture) Master returns an action list that scores; Master honours `timeMs: 200` (returns within 400 ms on the initial position); in a self-play harness of 20 seeded games Master beats Beginner in at least 18 and beats Medium in a clear majority (assert `>= 14` of 20), both with a game-length cap of 200 turns counted as no win.
- [ ] **Step 2: Run** `node --test tests/ai.test.js`; expected FAIL.
- [ ] **Step 3: Implement** `evaluate` (goal difference dominant; then ball advancement, own counters near the ball, own ownership of the ball; put-out outcome scored by who is ahead) and `chooseTurn` as: Beginner = random legal sequence 80% of the time, else greedy one-ply; Medium = depth-limited search over whole turns (depth 2 turns, noise on 20% of picks); Master = iterative deepening alpha-beta over whole turns until `timeMs` (default 2500) expires, always returning the best completed iteration. `src/ai-worker.js` wraps `chooseTurn`.
- [ ] **Step 4: Run** the suite; expected PASS (if the win-rate assertions fail, tune the Medium noise and Master evaluation, not the thresholds). Commit: `git commit -am "feat: computer opponent"`.

### Task 7: Board UI in the classic leaflet look

**Files:**
- Create: `index.html`, `style.css`, `src/ui.js`

**Interfaces:**
- Consumes: Tasks 1–4 (`State`, `legalActions`, `squareName`).
- Produces (`src/ui.js`): `createBoardView(root: HTMLElement, handlers: { onSquare(sq: Square): void }): { render(state: State, opts: { selected?: PieceRef, targets?: Square[], lastMove?: Action[], thinking?: boolean }): void }`.

- [ ] **Step 1:** Build the page shell: board (SVG or CSS grid of 11×13 squares plus the two goal strips, red border, yellow field lines for areas, yellow dots on special squares and green dots on start squares, edge labels per Global Constraints), glossy red/white marble counters, cream ball, goal-keeper drawn with two arm stubs, a side panel (score, turn and moves left, level selector, End turn is not needed, New game button, move history container).
- [ ] **Step 2:** Responsive layout: `grid` with the panel beside the board at width ≥ 900 px and below it otherwise; board sized by `min(100vw - 32px, available height)`; `viewport` meta set; `touch-action: manipulation` on the board; squares at least 28 px on a 360 px-wide phone (check by opening the page at that width).
- [ ] **Step 3:** Verify manually with `python3 -m http.server 8000` and `open http://localhost:8000`: initial position matches the leaflet cover photo; highlight targets via a temporary call to `render` from the browser console; no horizontal scroll at 360 px and 1280 px widths. Commit: `git add -A && git commit -m "feat: board ui"`.

### Task 8: Move history

**Files:**
- Create: `src/history.js`, `tests/history.test.js`

**Interfaces:**
- Consumes: `squareName` (Task 1), `Action`, `State`.
- Produces: `describeAction(a: Action, before: State): string` (counter move `"P 23.→45"`-style: piece letter, from-name, arrow, to-name; ball move `"ball →56"`), `describeTurn(team: Team, actions: Action[], before: State): string` (joins the actions of one turn with spaces, prefixed by the team initial), `createHistory(listEl: HTMLElement): { add(turnNumber: number, text: string): void, clear(): void }`.

- [ ] **Step 1: Write failing tests**: a White player moving from `{x:2,y:-1}` to `{x:3,y:0}` is described as `"P 21.→30"`; a ball move to `{x:6,y:2}` as `"ball →52"`; `describeTurn('R', [...])` begins with `"R "`; three added entries produce three list items in order and `clear()` empties the list (use a minimal fake element with `appendChild`/`replaceChildren`).
- [ ] **Step 2: Run** `node --test tests/history.test.js`; expected FAIL.
- [ ] **Step 3: Implement** `src/history.js`; the history list auto-scrolls to the newest entry.
- [ ] **Step 4: Run** the test; expected PASS. Commit: `git commit -am "feat: move history"`.

### Task 9: Game controller

**Files:**
- Create: `src/main.js`; Modify: `index.html`

**Interfaces:**
- Consumes: everything above. Produces: the playable game.

- [ ] **Step 1:** Implement the controller: coin toss at start (random first team, shown in the panel); the user (White) taps a counter to select it — targets from `legalActions` are highlighted — then taps a target; in `'ball'` phase the user taps the ball's destination (only legal ones highlighted); a turn ends automatically per `applyAction`; the computer's turn calls the worker with the chosen level, shows a "thinking" state, ignores all board input meanwhile (Review Focus 1), then plays the returned actions one by one with ~400 ms spacing so the user can follow; every turn is appended to the history; on `result` show an end banner (win/lose/draw and reason) with a New game button; the level selector takes effect on the next New game; if `Worker` creation fails, fall back to calling `chooseTurn` on the main thread with `timeMs: 1500`.
- [ ] **Step 2:** Verify manually: play a full game on each level; check a goal, the 2-goal end, a put-out (use a temporary URL flag `?scenario=putout` that loads a fixture state, remove it before committing), moves list contents, and phone width via browser dev tools. Confirm tapping during "thinking" does nothing.
- [ ] **Step 3:** Run `node --test tests/` to confirm the engine suite is still green. Commit: `git add -A && git commit -m "feat: playable game"`.

### Task 10: Publish on GitHub Pages

**Files:**
- Create: `README.md`

- [ ] **Step 1:** Write `README.md`: what the game is, "unofficial fan implementation of Goalmind's Mastergoal, personal project", how to run (`python3 -m http.server`), how to run the tests (`node --test tests/`), the live URL placeholder.
- [ ] **Step 2:** Confirm `git status` shows no HEIC files tracked and the published tree has no leaflet images. Commit the README.
- [ ] **Step 3:** Ask the user before pushing. On approval run `git push -u origin main`, then tell the user to enable Pages (Settings → Pages → Deploy from branch → `main` / root), and open the resulting URL to confirm the game loads and plays; fix any path problems (all asset paths relative) and report the final URL.

---

## Self-review notes

- Spec coverage: rules (Tasks 1–5), levels and speed (6), look and responsive layout (7), move history (8), click/tap flow, coin toss, end screen (9), deploy and copyright constraints (10). Two-player, undo, hints, sound are non-goals and have no task.
- Interpretation points the plan leaves to Task 2/5 and the photos: start squares, yellow-point squares, which corners are prohibited, exact self-pass condition. Task 5 reports any residual ambiguity to the user.
- Node is needed only for development; the user has not approved installing it (Task 1 Step 1 asks).
