# Mastergoal Web Game — Design

Date: 2026-10-23
Status: Draft, awaiting approval

## Intent

Recreate the childhood board game **Mastergoal** (Goalmind S.A., 1992) as a web page. The user plays against a computer opponent in the browser. The page is hosted on GitHub Pages from `git@edupaz-github.com:edupaz2/mastergoal.git` (currently empty). The three leaflet photos in the project root (`IMG_5223.HEIC`, `IMG_5224.HEIC`, `IMG_5225.HEIC`) are the authoritative rulebook. The user wants it for nostalgia and to play; faithfulness to the leaflet matters more than novelty.

## Goals

- Full, faithful implementation of the leaflet rules (see Rules). The user said: "Follow completely. They are clear."
- Single-player vs computer. User plays White, computer plays Red (builder's call, easy to swap).
- Three difficulty levels: **Beginner, Medium, Master**. The user wants an opponent that is "friendly, one I can usually beat, but also difficult". Beginner and Medium should be beatable by a casual player; Master should make the user think.
- Classic leaflet look (mockup option A): olive/green checkerboard, red border, yellow field lines and dots, glossy red and white marble counters, cream ball. The board is drawn from the leaflet figures.
- Works on desktop, phone and tablet. Board scales to fit; side panel sits beside the board on wide screens and below it on narrow ones. Tap/click input only (no keyboard-only flow required).
- Move history panel (list of moves made by both sides).
- Click/tap flow: select a counter, legal destinations highlight, tap a destination.
- Deployable as static files on GitHub Pages.

## Non-goals

- Two-player or online play (the user said "for now, solo play vs computer"; leave the door open but do not build it).
- Undo, hints, sound (the user chose only move history as an extra).
- Accounts, persistence, analytics.
- Reproducing leaflet artwork, logo or text. The leaflet is © Goalmind 1992 and the site is a personal project; do not copy the leaflet images or logo into the repo's published site.

## Anti-goals (failure even if it technically works)

- An opponent that cheats, or that always crushes the user at every level.
- Rules that are "close enough". A move the leaflet forbids must never be offered, and a move it allows must never be missing.
- Layout that needs horizontal scrolling or pinch-zoom on a phone.

## Constraints

- Plain HTML, CSS and JavaScript. No framework, no build step, no server. (Builder's call as stated to the user; the user did not object.)
- Computer opponent runs in the browser; Master level must still respond in a few seconds on a phone (use a web worker or time-boxed search if needed).
- The project folder is not yet a git repository. The builder initialises it, sets the remote above, and publishes to GitHub Pages. Do not commit the HEIC photos to the public site unless the user says so (copyright).
- Node is not installed on the user's machine, so anything the user must run locally should work by opening `index.html` or via `python3 -m http.server`.

## Rules (transcribed from the leaflet)

The board (dimensions confirmed by the user from the physical board; the builder still checks start squares, yellow points and the goal strip against the photos):

- The pitch is **11 squares wide (rows 0–10, centre row 5) and 13 squares long (columns −6…6, centre column 0)**, a checkerboard.
- **Goal posts:** a strip of **5 squares** (rows 3–7, centred) sitting just beyond each short end of the pitch, 1 deep (depth is my reading of the photo). The ball scores by entering these.
- **Small area:** 7 wide × 2 deep at each end. **Large area:** 9 wide × 4 deep at each end (a larger yellow box containing the small area).
- **Corner squares:** the four corner squares of the pitch. Marked with yellow points.
- **Special squares (yellow points):** the squares on the bottom line of the *opposite* side (each end line). If you manage to place the ball on one, you get another turn.
- **Centre point** marked with a green point. Start squares are marked with green points.

Square names (from the user, matching the numbers printed around the board, used for the move history and shown on the board edges):

- Across the width (11 squares): **0, 1, 2, 3, 4, (blank), 5, 6, 7, 8, 9**. The centre square of the width has no number.
- Along the length (13 squares): **6., 5., 4., 3., 2., 1., 0, 1, 2, 3, 4, 5, 6**. The first six carry a trailing dot (one half of the pitch), 0 is the centre line, and the last six have no dot (the other half). Which half is White's is left to the builder.
- A square is written **(w,l)**: width label first, length label second, e.g. `(3,6.)`. The blank centre file of the width is called **B**, e.g. `(B,5.)`. The dotted half (`.`) is **White's half**; the undotted half is Red's.
- Internally the engine may use numeric indices; names are for the board edges and the move history.

Confirmed start and special squares (from the user, in the notation above):

- **Yellow-dot squares:** `(0,6) (3,6) (4,6) (B,6) (5,6) (6,6) (9,6)` and the same seven on the dotted end line: `(0,6.) (3,6.) (4,6.) (B,6.) (5,6.) (6,6.) (9,6.)`. That is the two corners plus the five squares of the goal width on each end line.
- **Start squares (dark green dots):** Red goalkeeper `(B,5)`; Red counters `(3,3) (6,3) (2,1) (7,1)`. White goalkeeper `(B,5.)`; White counters `(2,1.) (7,1.) (3,3.) (6,3.)`. Ball `(B,0)`.

Counters:

- Each team: **4 Players and 1 Goal-keeper**, plus **one shared Ball**.
- **Player:** moves in any direction (forward, back, sideways, diagonally), always in a straight line, **1 or 2 squares** per move.
- **Goal-keeper:** moves like a Player when outside his own area. He has "arms" (two extra squares, one on each side). Inside his own area the arms always stay parallel to the goal post line.
- **Ball:** never moves by itself. It moves only when a Player or the Goal-keeper has possession (see below). It moves in a straight line (any of 8 directions) **up to 4 squares**. Only the Ball may jump over the Goal-keeper within his large area, or over players (see Passes). The Ball is the only counter that may enter the goal posts squares. Players may never jump over the Goal-keeper within his large area; no Player may go into the small area.

Start of game:

- Players and Goal-keepers and Ball start on the marked green points as in the leaflet's cover photo. A coin toss decides who starts. Play to a total of **2 goals** (final scores 1:1 or 2:0).

Turn structure:

- Whoever's turn it is must move either a Player or the Goal-keeper.
- A Player gains **possession** of the Ball when he lands on one of the 8 squares adjacent to it ("CC" squares in Fig. 3). He then **must** move the Ball on that same turn (the Ball never moves by itself).
- If neither Player nor Goal-keeper can gain control of the Ball, the turn is over and it is the other team's turn.
- If a team gains control of the Ball, it **must** move it, up to **4 times in succession** (the Ball can be moved a maximum of 4 times).
- The first 3 moves of a turn must be **passes between one's own Players**. In the last move, if no goal is scored, the Ball will always be left outside one's own area and will not belong to any Player. It may also be left on a neutral square.
- It is **not necessary to use up the 4 moves**, provided that the Ball is left correctly.
- **Passing:** the Ball is sent from a square that belongs to the team to another that belongs to a Player of the same team. A Player who receives the Ball can pass it on to another Player, trying to score a Goal. When a Player has the Ball, it can be sent in any direction, including through the line of a Player of the other team, since it is the only counter that can "jump" over the Players. The Player cannot do a **self-pass**: the Ball cannot be sent from one square to another, even if both squares are adjacent to the same Player, except when the square is not exclusively his and belongs to another Player from the same team.
- **Goal-keeper inside his own area:** the Goal-keeper's arms allow the Ball to pass only when the Ball moves into squares reachable by his arms, carried out by members of his team. Neither side's Players may pass through the Goal-keeper's side squares (the squares indicated by his arms) if they are the other team's. If the Ball is on a square inside a Goal-keeper's arms, it always belongs to him, independent of other considerations. No Player can go onto the Goal-keeper's side squares (the squares indicated by the arms) or vice versa, although they can pass them. The Goal-keeper and the two side squares which his arms point to can never be crossed over by the Ball. If the Goal-keeper situated at the edge of the area has one arm outside and the other in, only the one which is in is valid. The side squares of the Goal-keeper's arms occupy within his areas and are not used to form a majority in the neutral squares (Fig. 7).
- **Neutral squares:** when the Ball is on them they do not belong to any team, because there is an equal number of Players from the two teams on the squares adjacent to the Ball (Fig. A, B, C). A square stops being neutral when the team whose turn it is places one of its Players on one of the squares adjacent to the Ball in such a way that it has a **majority** of its Players on the adjacent squares, and thus the Ball is theirs and they must move it (Fig. A1, B1, C1). The squares that belong to the team through having a majority of Players are used in passes, in the same way that if they belong to only one Player of said team.
- **Special squares:** a team's own corner squares are prohibited for that team (neither its Players nor its Goal-keeper can send the Ball there nor occupy them, even if they have the Ball). Special squares lose this characteristic if they belong to the Goal-keeper or to any Player of any team.
- **Goal:** scored when the Ball enters the goal post squares, either diagonally or with a forward move (Fig. 9 and 10). After a goal, if the game continues, counters return to their initial position. The team that moves next is the team that **scored** the goal (as printed on the leaflet).
- **Ball put out:** if the Ball cannot be moved to a correct place, the game ends and the score is that obtained up to that moment.

## Clarifications from the reviewer pass

Answered by the leaflet or the project:

- **Match end:** the leaflet says the game is played "until a total of 2 goals are scored (with possible scores 1:1 or 2:0)". So the match ends after 2 goals in total; 1:1 is a draw. It is not "first to 2".
- **Reading the photos:** the three HEIC photos are readable on this Mac. `sips -s format jpeg -Z 4000 IMG_5224.HEIC --out x.jpg` converts them; the builder should convert them and read the figures (Fig. 1–10) directly. Figures A–C, A1–C1 and 3–10 are the test fixtures for the rules engine. IMG_5224 is photographed sideways (rotate 90°).
- **Goal-keeper arms:** the leaflet says the arms stay parallel to the goal line inside the area, and only the in-area arm counts when he stands on the edge. Outside his area he is a normal Player with no arms. Arm squares are not counted in neutral-square majorities (Fig. 7).

Minor, my calls (builder may refine):

- **Ball put out:** the higher score wins; level score is a draw. (Winner rule is my call.)
- **What "put out" means (confirmed by the user):** it happens when the team that has taken control of the ball has no legal square to move it to. The game ends at once, with the score at that moment. The rules engine must detect this whenever a team is obliged to move the ball (e.g. right after landing next to it, or when the ball cannot yet legally be left where it is) and has no legal destination, and the computer opponent must treat it as a game-ending outcome (avoid it when behind, seek it when ahead).

Confirmed by the user:

- **Turn without reaching the ball:** if a team moves a counter and does not land next to the ball, the turn is simply over. If a counter lands next to the ball, that team takes control and must move the ball. The turn must always end with the ball on a neutral square or on a square that no player owns (never left owned by a player), and outside the mover's own area.
- **Restart after a goal:** the team that scored moves next, exactly as the leaflet says.
- **Bonus turn from a special square:** the same team moves again as a fresh turn (a new set of up to 4 ball moves and a new counter move). The 4-move count does not carry over.
- **AI targets:** Beginner picks a random legal move most of the time; Medium searches shallowly and sometimes errs; Master searches deepest. Target: Master beats Beginner nearly always and beats Medium clearly, and responds within about 3 seconds on a phone. A self-play harness to tune the levels is acceptable.
- **Ownership:** a square "belongs" to the team with a strict majority of counters in the squares adjacent to the ball, counted after the move. Equal counts means neutral. Goal-keeper arm squares are handled as in the Rules section.

## What I decided on the way (builder's calls the user has not seen)

- White = user, Red = computer; computer moves after a short delay with a visible "thinking" state.
- Computer levels differ by search depth/evaluation and by a deliberate error rate at Beginner (e.g. random legal move often) and Medium (shallow lookahead).
- Move history format: simple numbered lines per turn using the board's own square names (see Rules), exact notation left to the builder.
- Visuals use CSS or SVG; no image assets copied from the leaflet.

## Left to the builder

- File layout, module structure, rule-engine design, AI algorithm (e.g. minimax/alpha-beta, MCTS) and tuning of the three levels.
- Exact responsive breakpoints, animation, colours within the classic-leaflet style.
- How to test the rules engine (the leaflet figures 3–10 make good test cases).

## Open items needing verification against the photos

- Which corners are prohibited for which team (leaflet Fig. 8) and the goal-keeper's arm orientation: read these from the photos. Pitch, goal and area dimensions, start squares and yellow-dot squares are confirmed by the user.
- Wording of a few leaflet sentences is a transcription from phone photos and is ambiguous where the figures are small (e.g. the self-pass rule, the Goal-keeper side squares rule).
