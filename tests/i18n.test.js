import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LANGUAGES, pickLanguage, setLanguage, language, t, teamName, translatePage, _STRINGS } from '../src/i18n.js';
import { describeTurn } from '../src/history.js';
import { initialState } from '../src/state.js';

test('pickLanguage: first supported browser language by primary subtag, else English', () => {
  assert.equal(pickLanguage(['es-AR', 'en-US']), 'es');
  assert.equal(pickLanguage(['de-DE', 'pt-BR', 'en']), 'pt');
  assert.equal(pickLanguage(['zh-TW']), 'zh');
  assert.equal(pickLanguage(['zh_CN']), 'zh');
  assert.equal(pickLanguage(['FR-ca']), 'fr');
  assert.equal(pickLanguage(['it']), 'it');
  assert.equal(pickLanguage(['de', 'ja']), 'en');
  assert.equal(pickLanguage([]), 'en');
  assert.equal(pickLanguage(undefined), 'en');
});

test('every language has every English key, and no extra ones', () => {
  const keys = Object.keys(_STRINGS.en).sort();
  for (const l of LANGUAGES) assert.deepEqual(Object.keys(_STRINGS[l]).sort(), keys, l);
});

test('placeholders survive translation', () => {
  for (const l of LANGUAGES) {
    for (const [k, v] of Object.entries(_STRINGS.en)) {
      const want = (v.match(/\{\w+\}/g) ?? []).sort();
      assert.deepEqual((_STRINGS[l][k].match(/\{\w+\}/g) ?? []).sort(), want, `${l}.${k}`);
    }
  }
});

test('t fills placeholders in the current language; unknown languages fall back to English', () => {
  setLanguage('es');
  assert.equal(language(), 'es');
  assert.equal(t('toMove', { team: teamName('W') }), 'Mueve Blanco');
  assert.equal(t('finalScore', { score: '2:1' }), 'Resultado final 2:1.');
  setLanguage('xx');
  assert.equal(language(), 'en');
  assert.equal(t('wins', { team: teamName('R') }), 'Red wins');
});

test('history keeps the notation and translates the word "ball"', () => {
  const s = initialState('W');
  const acts = [{ kind: 'move', piece: { team: 'W', kind: 'P', index: 0 }, to: { x: 3, y: 0 } }, { kind: 'ball', to: { x: 5, y: 3 } }];
  assert.equal(describeTurn('W', acts, s), 'W P (2,1.)→(3,0) ball →(B,3)');
  assert.equal(describeTurn('W', acts, s, 'balón'), 'W P (2,1.)→(3,0) balón →(B,3)');
});

test('index.html: one rules block per language, only English shown before scripts run', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const blocks = [...html.matchAll(/<div class="rules-body" data-lang="(\w+)"[^>]*>/g)];
  assert.deepEqual(blocks.map((m) => m[1]).sort(), [...LANGUAGES].sort());
  for (const m of blocks) assert.equal(m[0].includes(' hidden'), m[1] !== 'en', m[1]);
  // Every data-i18n key on the page exists.
  for (const m of html.matchAll(/data-i18n(?:-label)?="(\w+)"/g)) assert.ok(m[1] in _STRINGS.en, m[1]);
});

test('translatePage sets text, labels, lang and the visible rules block', () => {
  const node = (attrs) => ({ dataset: attrs, textContent: '', label: null, setAttribute(k, v) { if (k === 'aria-label') this.label = v; } });
  const btn = node({ i18n: 'newGame' });
  const dlg = node({ i18nLabel: 'rules' });
  const rules = LANGUAGES.map((l) => ({ dataset: { lang: l }, hidden: false }));
  const doc = {
    documentElement: { lang: 'en' },
    querySelectorAll(sel) {
      if (sel === '[data-i18n]') return [btn];
      if (sel === '[data-i18n-label]') return [dlg];
      if (sel === '.rules-body') return rules;
      return [];
    },
  };
  setLanguage('fr');
  translatePage(doc);
  assert.equal(doc.documentElement.lang, 'fr');
  assert.equal(btn.textContent, 'Nouvelle partie');
  assert.equal(dlg.label, 'Règles');
  assert.deepEqual(rules.filter((r) => !r.hidden).map((r) => r.dataset.lang), ['fr']);
  setLanguage('en');
});
