import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, parseImport, freshState, exportFile, mergeStates } from '../src/storage.js';

test('normalize fills in missing parts and new settings', () => {
  const s = normalize({ v: 2, cards: { 'h:ねこ': { s: 'r' } }, settings: { newPerDay: 15 } });
  assert.deepEqual(s.kana, { h: {}, k: {} });
  assert.equal(s.settings.newPerDay, 15);
  assert.equal(s.settings.startLevel, 5);
  assert.equal(s.settings.audio, true);
  assert.ok(s.cards['h:ねこ']);
});

test('version 1 data keeps only its streak days', () => {
  const s = normalize({ v: 1, cards: { 'h:あ': { b: 3 } }, days: { '2026-10-12': { n: 5, done: true } } });
  assert.deepEqual(s.cards, {});
  assert.ok(s.days['2026-10-12'].done);
});

test('export and import round-trip', async () => {
  const state = freshState();
  state.cards['k:コーヒー'] = { s: 'r', ivl: 3, due: '2026-10-16' };
  const { blob, filename } = exportFile(state, '2026-10-13');
  assert.equal(filename, 'kana-renshu-progress-2026-10-13.json');
  assert.deepEqual(parseImport(await blob.text()).cards, state.cards);
});

test('import rejects other files', () => {
  assert.throws(() => parseImport('not json'), /valid JSON/);
  assert.throws(() => parseImport('{"hello": 1}'), /progress export/);
});

test('merging keeps the most recently changed copy of each word', () => {
  const phone = freshState(), laptop = freshState();
  phone.cards['h:ねこ'] = { s: 'r', ivl: 8, mod: 200 };
  laptop.cards['h:ねこ'] = { s: 'r', ivl: 3, mod: 100 };
  laptop.cards['h:いぬ'] = { s: 'l', mod: 150 };
  phone.days['2026-10-12'] = { n: 10, ok: 9, h: true, done: true };
  laptop.days['2026-10-12'] = { n: 4, ok: 4, k: true, done: true };
  laptop.days['2026-10-11'] = { n: 7, ok: 6, done: true };
  phone.kana.h['ね'] = { o: 3, m: 1 };
  laptop.kana.h['ね'] = { o: 5, m: 0 };
  phone.settings.theme = 'dark';
  const merged = mergeStates(phone, laptop);
  assert.equal(merged.cards['h:ねこ'].ivl, 8);
  assert.equal(merged.cards['h:いぬ'].s, 'l');
  assert.deepEqual(merged.days['2026-10-12'], { n: 10, ok: 9, h: true, k: true, done: true });
  assert.ok(merged.days['2026-10-11'].done);
  assert.deepEqual(merged.kana.h['ね'], { o: 5, m: 1 });
  assert.equal(merged.settings.theme, 'dark');
  assert.equal(mergeStates(laptop, phone).cards['h:ねこ'].ivl, 8);
});
