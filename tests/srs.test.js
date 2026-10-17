import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyGrade, suggestGrade, formatInterval, deckPlan, forecast, streak, addDays, todayString } from '../src/srs.js';

const T = '2026-10-13';
const opts = { today: T, random: () => 0.5, now: 1000 };

test('the day starts at 4 a.m.', () => {
  assert.equal(todayString(new Date(2026, 9, 14, 1, 30)), '2026-10-13');
  assert.equal(todayString(new Date(2026, 9, 14, 4, 30)), '2026-10-14');
});

test('the day still starts at 4 a.m. on daylight-saving days', () => {
  const tz = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    assert.equal(todayString(new Date(2026, 2, 8, 4, 30)), '2026-03-08'); // clocks went forward at 2 a.m.
    assert.equal(todayString(new Date(2026, 10, 1, 3, 30)), '2026-10-31'); // clocks went back at 2 a.m.
  } finally {
    if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz;
  }
});

test('a new word graded Good is due tomorrow; Easy waits four days', () => {
  assert.equal(applyGrade(null, 3, opts).st.due, addDays(T, 1));
  assert.equal(applyGrade(null, 3, opts).st.ivl, 1);
  assert.equal(applyGrade(null, 4, opts).st.ivl, 4);
});

test('Again keeps a new word in this session', () => {
  const { st, requeue } = applyGrade(null, 1, opts);
  assert.equal(st.s, 'l');
  assert.equal(st.due, T);
  assert.equal(requeue, 3);
});

test('repeated Good answers space reviews further and further apart', () => {
  let st = null;
  const intervals = [];
  for (let i = 0; i < 6; i++) { st = applyGrade(st, 3, opts).st; intervals.push(st.ivl); }
  for (let i = 1; i < intervals.length; i++) assert.ok(intervals[i] > intervals[i - 1], intervals.join(','));
  assert.ok(intervals[5] > 60, intervals.join(','));
});

test('a lapse resets the interval, lowers the ease and relearns the word', () => {
  let st = null;
  for (let i = 0; i < 4; i++) st = applyGrade(st, 3, opts).st;
  const lapsed = applyGrade(st, 1, opts);
  assert.equal(lapsed.st.ivl, 1);
  assert.equal(lapsed.st.lapses, 1);
  assert.ok(lapsed.st.e < st.e);
  assert.equal(lapsed.requeue, 3);
  assert.equal(applyGrade(lapsed.st, 3, opts).st.ivl, 1);
});

test('grading stamps the change time; preview changes nothing', () => {
  assert.equal(applyGrade(null, 3, opts).st.mod, 1000);
  const p = applyGrade(null, 3, { preview: true });
  assert.equal(p.st.due, undefined);
  assert.equal(p.st.reps, 0);
});

test('suggested grades', () => {
  assert.equal(suggestGrade('wrong', 1000, 3), 1);
  assert.equal(suggestGrade('empty', 1000, 3), 1);
  assert.equal(suggestGrade('long', 1000, 3), 2);
  assert.equal(suggestGrade('ok', 800, 3), 4);
  assert.equal(suggestGrade('ok', 3000, 3), 3);
  assert.equal(suggestGrade('ok', 20000, 3), 2);
});

test('interval labels', () => {
  assert.equal(formatInterval(4), '4d');
  assert.equal(formatInterval(45), '1.5mo');
  assert.equal(formatInterval(365), '1y');
});

const words = [
  { key: 'h:a', jlpt: 5 }, { key: 'h:b', jlpt: 5 }, { key: 'h:c', jlpt: 5 },
  { key: 'h:d', jlpt: 0 }, { key: 'h:e', jlpt: 4 }, { key: 'h:f', jlpt: 3 }, { key: 'h:g', jlpt: 3 },
];
const settings = (extra = {}) => ({ newPerDay: 2, startLevel: 5, ...extra });

test('deck plan: due words plus new words up to the daily limit', () => {
  const state = {
    cards: { 'h:a': { s: 'r', due: T }, 'h:b': { s: 'r', due: addDays(T, 2) }, 'h:c': { s: 'l', due: T } },
    intro: { date: T, h: 1, k: 0 },
    settings: settings(),
  };
  const p = deckPlan('h', words, state, T);
  assert.deepEqual(p.review.map(w => w.key), ['h:a']);
  assert.deepEqual(p.learning.map(w => w.key), ['h:c']);
  assert.deepEqual(p.fresh.map(w => w.key), ['h:d']);
  assert.equal(p.total, 3);
});

test('starting at N3 skips easier new words but keeps reviews', () => {
  const state = { cards: { 'h:a': { s: 'r', due: T } }, intro: { date: '', h: 0, k: 0 }, settings: settings({ startLevel: 3 }) };
  const p = deckPlan('h', words, state, T);
  assert.deepEqual(p.fresh.map(w => w.key), ['h:f', 'h:g']);
  assert.deepEqual(p.review.map(w => w.key), ['h:a']);
});

test('suspended words never come up', () => {
  const state = { cards: { 'h:a': { s: 'r', due: T, sus: true }, 'h:b': { s: 'n', sus: true } }, intro: { date: '', h: 0, k: 0 }, settings: settings() };
  const p = deckPlan('h', words, state, T);
  assert.equal(p.review.length, 0);
  assert.deepEqual(p.fresh.map(w => w.key), ['h:c', 'h:d']);
});

test('forecast counts words due each day, overdue ones today', () => {
  const state = { cards: { 'h:a': { s: 'r', due: addDays(T, -3) }, 'h:b': { s: 'r', due: addDays(T, 2) }, 'h:c': { s: 'r', due: addDays(T, 9) }, 'h:d': { s: 'r', due: T, sus: true } } };
  assert.deepEqual(forecast(words, state, 7, T), [1, 0, 1, 0, 0, 0, 0]);
});

test('streak counts finished days in a row', () => {
  const days = { [T]: { done: true }, [addDays(T, -1)]: { done: true }, [addDays(T, -3)]: { done: true } };
  assert.equal(streak(days, T), 2);
  assert.equal(streak({ [addDays(T, -1)]: { done: true } }, T), 1);
  assert.equal(streak({}, T), 0);
});
