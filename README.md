# Mastergoal

A browser game: play the board game Mastergoal against the computer. Plain HTML, CSS and JavaScript (ES modules), no build step.

This is an unofficial fan implementation of Goalmind's Mastergoal, a personal project. It is not affiliated with or endorsed by Goalmind.

Live: https://edupaz2.github.io/mastergoal/

## Run

ES modules do not load from `file://`, so serve the folder:

```
python3 -m http.server
```

then open http://localhost:8000.

## Tests

```
node --test tests/
```

Node 20+ is needed for development only; the game itself runs in the browser.

## Rules interpretation notes

In two places the engine follows the design spec (`docs/superpowers/specs/2026-10-23-mastergoal-design.md`) over a literal reading of the leaflet:

- A ball ending on an opponent end-line yellow square always gives a bonus turn.
- The self-pass rule counts every own counter next to the ball as the taker.
