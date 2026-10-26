import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANALYTICS_EVENTS, GOATCOUNTER_ENDPOINT, GOATCOUNTER_SCRIPT_URL,
  initAnalytics, shouldEnableAnalytics, track,
} from '../src/analytics.js';

const base = { hostname: 'edupaz2.github.io', search: '', doNotTrack: null };

function fakeDocument() {
  const scripts = [];
  return {
    scripts,
    head: {
      querySelector: (sel) => (sel === 'script[data-goatcounter]' ? scripts.find((s) => s.dataset.goatcounter) ?? null : null),
      appendChild: (s) => scripts.push(s),
    },
    createElement: (tag) => ({ tag, dataset: {}, async: false, src: '' }),
  };
}

// Replaces globalThis.goatcounter / navigator for one test.
function withGlobals(t, globals) {
  for (const [k, value] of Object.entries(globals)) {
    const prev = Object.getOwnPropertyDescriptor(globalThis, k);
    Object.defineProperty(globalThis, k, { value, configurable: true, writable: true });
    t.after(() => (prev ? Object.defineProperty(globalThis, k, prev) : delete globalThis[k]));
  }
}

function counter() {
  const calls = [];
  return { calls, count: (vars) => calls.push(vars) };
}

// ---- shouldEnableAnalytics ----

test('analytics: enabled on the live host', () => {
  assert.equal(shouldEnableAnalytics(base), true);
});

test('analytics: disabled on local and private hosts', () => {
  for (const hostname of ['localhost', '127.0.0.1', '[::1]', '192.168.1.5', '10.0.0.2',
    '172.16.0.1', '172.20.1.1', '172.31.255.1', 'foo.local', '']) {
    assert.equal(shouldEnableAnalytics({ ...base, hostname }), false, hostname);
  }
});

test('analytics: enabled on public hosts next to the private ranges', () => {
  for (const hostname of ['172.15.0.1', '172.32.0.1', '11.0.0.1', '193.168.1.1']) {
    assert.equal(shouldEnableAnalytics({ ...base, hostname }), true, hostname);
  }
});

test('analytics: disabled by the e2e flag, not by other queries', () => {
  for (const search of ['?e2e', '?a=1&e2e', '?e2e=1']) {
    assert.equal(shouldEnableAnalytics({ ...base, search }), false, search);
  }
  assert.equal(shouldEnableAnalytics({ ...base, search: '?level=master' }), true);
});

test('analytics: disabled by Do Not Track = 1 only', () => {
  assert.equal(shouldEnableAnalytics({ ...base, doNotTrack: '1' }), false);
  for (const doNotTrack of ['unspecified', null, '0', undefined]) {
    assert.equal(shouldEnableAnalytics({ ...base, doNotTrack }), true, String(doNotTrack));
  }
});

// ---- initAnalytics ----

test('initAnalytics: injects one async GoatCounter script when enabled', () => {
  const doc = fakeDocument();
  initAnalytics(base, doc);
  assert.equal(doc.scripts.length, 1);
  const s = doc.scripts[0];
  assert.equal(s.tag, 'script');
  assert.equal(s.async, true);
  assert.equal(s.dataset.goatcounter, GOATCOUNTER_ENDPOINT);
  assert.equal(s.src, GOATCOUNTER_SCRIPT_URL);
  assert.equal(GOATCOUNTER_ENDPOINT, 'https://mastergoal.goatcounter.com/count');
  assert.equal(GOATCOUNTER_SCRIPT_URL, 'https://gc.zgo.at/count.js');
});

test('initAnalytics: injects nothing when disabled', () => {
  const doc = fakeDocument();
  initAnalytics({ ...base, hostname: 'localhost' }, doc);
  initAnalytics({ ...base, search: '?e2e' }, doc);
  initAnalytics({ ...base, doNotTrack: '1' }, doc);
  assert.equal(doc.scripts.length, 0);
});

test('initAnalytics: is idempotent', () => {
  const doc = fakeDocument();
  initAnalytics(base, doc);
  initAnalytics(base, doc);
  assert.equal(doc.scripts.length, 1);
});

test('initAnalytics: never throws, and stays off without a browser', () => {
  assert.doesNotThrow(() => initAnalytics());
  assert.doesNotThrow(() => initAnalytics(base, null));
});

// ---- track ----

test('track: counts a known event as a GoatCounter event', (t) => {
  const gc = counter();
  withGlobals(t, { goatcounter: gc });
  track('new-game');
  assert.deepEqual(gc.calls, [{ path: 'new-game', title: 'New game', event: true }]);
});

test('track: every known event sends only path, title and event', (t) => {
  const gc = counter();
  withGlobals(t, { goatcounter: gc });
  ANALYTICS_EVENTS.forEach((e) => track(e));
  assert.deepEqual(gc.calls.map((c) => c.path), ANALYTICS_EVENTS);
  for (const c of gc.calls) {
    assert.deepEqual(Object.keys(c).sort(), ['event', 'path', 'title']);
    assert.equal(c.event, true);
  }
});

test('track: ignores names outside the constant list', (t) => {
  const gc = counter();
  withGlobals(t, { goatcounter: gc });
  track('level-expert');
  track('(5,-3)');
  track(undefined);
  assert.deepEqual(gc.calls, []);
});

test('track: does nothing when the script has not loaded, or is broken', (t) => {
  assert.doesNotThrow(() => track('new-game'));
  withGlobals(t, { goatcounter: {} });
  assert.doesNotThrow(() => track('new-game'));
  globalThis.goatcounter = { count: () => { throw new Error('boom'); } };
  assert.doesNotThrow(() => track('new-game'));
});

test('track: does nothing with Do Not Track set', (t) => {
  const gc = counter();
  withGlobals(t, { goatcounter: gc, navigator: { doNotTrack: '1' } });
  track('new-game');
  assert.deepEqual(gc.calls, []);
});

test('track: the event list is the agreed one', () => {
  assert.deepEqual(ANALYTICS_EVENTS, [
    'new-game', 'level-beginner', 'level-medium', 'level-master',
    'game-won', 'game-lost', 'game-drawn',
  ]);
});
