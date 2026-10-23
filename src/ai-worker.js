// Web worker wrapper around chooseTurn (load with new Worker(url, { type: 'module' })).
// Receives { state, level, opts? } and posts back { actions }: the computer's turn up to
// the next turn boundary. After a goal or a bonus square the computer moves again, so
// the caller posts the new state again while it is still the computer's turn.
import { chooseTurn } from './ai.js';

self.onmessage = (e) => {
  const { state, level, opts } = e.data;
  self.postMessage({ actions: chooseTurn(state, level, opts) });
};
