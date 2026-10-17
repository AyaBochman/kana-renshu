import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judge, displayRomaji, normalizeInput, matcher, align } from '../src/romaji.js';

const h = (kana, extra = {}) => ({ script: 'h', kana, ...extra });
const k = (kana, extra = {}) => ({ script: 'k', kana, ...extra });

test('shows Hepburn with macrons for long vowels', () => {
  assert.equal(displayRomaji(h('とうきょう')), 'tōkyō');
  assert.equal(displayRomaji(h('ぎゅうにゅう')), 'gyūnyū');
  assert.equal(displayRomaji(h('おおさか')), 'ōsaka');
  assert.equal(displayRomaji(h('いっしょうけんめい')), 'isshōkenmei');
  assert.equal(displayRomaji(h('ちょっと まって ください')), 'chotto matte kudasai');
  assert.equal(displayRomaji(k('コーヒー')), 'kōhī');
  assert.equal(displayRomaji(k('ジェットコースター')), 'jettokōsutā');
  assert.equal(displayRomaji(k('ホッチキス')), 'hotchikisu');
  assert.equal(displayRomaji(h('こんにちは', { reading: 'konnichiwa' })), 'konnichiwa');
});

test('normalizes macrons, dashes, case and spaces', () => {
  assert.equal(normalizeInput('Kōhī'), 'koohii');
  assert.equal(normalizeInput('ko-hi-'), 'koohii');
  assert.equal(normalizeInput('chotto matte'), 'chottomatte');
  assert.equal(normalizeInput("kin'en"), 'kinen');
});

test('accepts the usual spellings', () => {
  const cases = [
    [k('コーヒー'), ['koohii', 'kōhī', 'ko-hi-', 'kouhii']],
    [h('ありがとう'), ['arigatou', 'arigatō', 'arigatoo']],
    [h('せんせい'), ['sensei', 'sensee']],
    [h('しんぶん'), ['shinbun', 'shimbun', 'sinbun']],
    [h('えんぴつ'), ['enpitsu', 'empitsu']],
    [k('ホッチキス'), ['hotchikisu', 'hocchikisu']],
    [k('ヴァイオリン'), ['vaiorin', 'baiorin']],
    [k('ティッシュ'), ['tisshu', 'thisshu']],
    [h('ちょっと まって ください'), ['chotto matte kudasai', 'chottomattekudasai']],
    [h('こんにちは', { reading: 'konnichiwa' }), ['konnichiwa', 'konnichiha']],
    [h('きを つけて', { reading: 'ki o tsukete' }), ['ki o tsukete', 'kiwotsukete']],
  ];
  for (const [word, inputs] of cases) for (const input of inputs) assert.equal(judge(word, input), 'ok', `${word.kana} ← ${input}`);
});

test('a dropped long vowel is right but flagged', () => {
  assert.equal(judge(h('ありがとう'), 'arigato'), 'long');
  assert.equal(judge(h('とうきょう'), 'tokyo'), 'long');
  assert.equal(judge(k('ビール'), 'biru'), 'long');
});

test('long vowels that change the word are wrong when left out', () => {
  assert.equal(judge(h('おばあさん'), 'obasan'), 'wrong');
  assert.equal(judge(h('おじいさん'), 'ojisan'), 'wrong');
  assert.equal(judge(h('せんせい'), 'sense'), 'wrong');
  assert.equal(judge(h('がっこう'), 'gakou'), 'wrong');
});

test('empty and wrong answers', () => {
  assert.equal(judge(h('ねこ'), ''), 'empty');
  assert.equal(judge(h('ねこ'), 'reko'), 'wrong');
});

test('finds which characters were misread', () => {
  const misread = (word, input) => align(matcher(word).units, normalizeInput(input)).filter(s => !s.ok).map(s => [s.u.kana, s.seg]);
  assert.deepEqual(misread(k('シーツ'), 'tsiitsu'), [['シ', 'tsi']]);
  assert.deepEqual(misread(k('ソース'), 'nuusu'), [['ソ', 'nu']]);
  assert.deepEqual(misread(h('ねこ'), 'reko'), [['ね', 're']]);
  assert.deepEqual(misread(h('がっこう'), 'gakou'), [['っこ', 'ko']]);
  assert.deepEqual(misread(k('シーツ'), 'tsuutsu'), [['シ', 'tsu']]);
});
