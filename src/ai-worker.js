// Web worker wrapper around chooseTurn (load with new Worker(url, { type: 'module' })).
// Receives { state, level, opts? } and posts back { actions }: the computer's turn up to
// the next turn boundary. After a goal or a bonus square the computer moves again, so
// the caller posts the new state again while it is still the computer's turn.
import { chooseTurn } from './ai.js';

// Handles one request; `post` sends the reply. Exported for tests. Always replies, so
// the page never waits forever: on any error (unknown level, malformed state) it posts
// { actions: [], error }.
export function handleMessage(data, post) {
  let reply;
  try {
    const { state, level, opts } = data;
    reply = { actions: chooseTurn(state, level, opts) };
  } catch (err) {
    reply = { actions: [], error: String(err) };
  }
  post(reply);
}

if (typeof self !== 'undefined') self.onmessage = (e) => handleMessage(e.data, (m) => self.postMessage(m));
