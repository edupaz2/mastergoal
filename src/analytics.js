// Privacy-friendly analytics (GoatCounter).
//
// Privacy contract: only the constant event names below can ever be sent. `track`
// drops anything else, nothing about the game or the player is attached, and there
// are no cookies or stored identifiers. Off on local and private hosts, with `?e2e`
// in the URL, and with Do Not Track; it never breaks the game.

export const GOATCOUNTER_ENDPOINT = 'https://mastergoal.goatcounter.com/count';
export const GOATCOUNTER_SCRIPT_URL = 'https://gc.zgo.at/count.js';

const EVENT_TITLES = {
  'new-game': 'New game',
  'level-beginner': 'Level: Beginner',
  'level-medium': 'Level: Medium',
  'level-master': 'Level: Master',
  'game-won': 'Game won',
  'game-lost': 'Game lost',
  'game-drawn': 'Game drawn',
};

export const ANALYTICS_EVENTS = Object.keys(EVENT_TITLES);

function isLocalHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === '' || h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1') return true;
  if (h.endsWith('.local')) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

// No build step, so there is no production flag: the host alone decides.
export function shouldEnableAnalytics({ hostname, search, doNotTrack }) {
  if (isLocalHost(hostname)) return false;
  if (new URLSearchParams(search).has('e2e')) return false;
  return doNotTrack !== '1';
}

function readDoNotTrack() {
  try {
    return globalThis.navigator?.doNotTrack ?? globalThis.doNotTrack ?? null;
  } catch {
    return null;
  }
}

export function initAnalytics(options, doc = globalThis.document) {
  try {
    const input = options ?? {
      hostname: location.hostname,
      search: location.search,
      doNotTrack: readDoNotTrack(),
    };
    if (!shouldEnableAnalytics(input)) return;
    if (doc.head.querySelector('script[data-goatcounter]')) return;
    const script = doc.createElement('script');
    script.async = true;
    script.dataset.goatcounter = GOATCOUNTER_ENDPOINT;
    script.src = GOATCOUNTER_SCRIPT_URL;
    doc.head.appendChild(script);
  } catch {
    // Analytics must never break the game.
  }
}

export function track(event) {
  try {
    if (!Object.hasOwn(EVENT_TITLES, event)) return;
    if (readDoNotTrack() === '1') return;
    const gc = globalThis.goatcounter;
    if (typeof gc?.count !== 'function') return;
    gc.count({ path: event, title: EVENT_TITLES[event], event: true });
  } catch {
    // Blocked, offline or not loaded: ignore.
  }
}
