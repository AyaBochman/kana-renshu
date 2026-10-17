// Checks every word in the decks. Run this after adding or editing words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareDeck, DECKS } from '../src/decks.js';
import { tokenize, judge, matcher } from '../src/romaji.js';

const load = file => JSON.parse(readFileSync(new URL('../' + file, import.meta.url), 'utf8'));
const KATAKANA = /[ァ-ヺ]/;
const HIRAGANA = /[ぁ-ゖ]/;
const FIELDS = new Set(['kana', 'kanji', 'meaning', 'jlpt', 'reading']);

for (const [script, deck] of Object.entries(DECKS)) {
  const entries = load(deck.file);

  test(`${deck.file}: every entry is complete and unique`, () => {
    const seen = new Set();
    for (const e of entries) {
      assert.ok(e.kana && typeof e.kana === 'string', JSON.stringify(e));
      assert.ok(e.meaning && typeof e.meaning === 'string', `missing meaning: ${e.kana}`);
      assert.ok(e.jlpt === undefined || [1, 2, 3, 4, 5].includes(e.jlpt), `jlpt must be 1-5 or left out: ${e.kana}`);
      for (const k of Object.keys(e)) assert.ok(FIELDS.has(k), `unknown field "${k}" in ${e.kana}`);
      assert.ok(!seen.has(e.kana), `duplicate: ${e.kana}`);
      seen.add(e.kana);
      const wrongScript = script === 'h' ? KATAKANA : HIRAGANA;
      assert.ok(!wrongScript.test(e.kana), `${e.kana} mixes scripts`);
      const open = (e.meaning.match(/\(/g) || []).length, close = (e.meaning.match(/\)/g) || []).length;
      assert.equal(open, close, `unbalanced brackets in the meaning of ${e.kana}`);
      assert.ok(!/&\w+;/.test(e.meaning), `HTML entity in the meaning of ${e.kana}`);
    }
  });

  test(`${deck.file}: every character has a known reading`, () => {
    for (const e of entries) {
      const unknown = tokenize(e.kana).filter(u => u.type === 'other').map(u => u.kana);
      assert.deepEqual(unknown, [], `${e.kana} has characters with no reading`);
    }
  });

  test(`${deck.file}: each word accepts its own shown reading`, () => {
    for (const w of prepareDeck(entries, script, deck.seed)) {
      const shown = matcher(w).romaji;
      assert.equal(judge(w, shown), 'ok', `${w.kana} → ${shown}`);
    }
  });
}
