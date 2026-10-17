import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareDeck, tierOf, levelLabel } from '../src/decks.js';

test('reading difficulty from the kana', () => {
  assert.equal(tierOf('ねこ'), 1);
  assert.equal(tierOf('かぎ'), 2);
  assert.equal(tierOf('ぱん'), 2);
  assert.equal(tierOf('がっこう'), 3);
  assert.equal(tierOf('コーヒー'), 3);
  assert.equal(tierOf('ファン'), 4);
  assert.equal(tierOf('また あした'), 4);
});

test('new words come N5 first (with everyday words), then by difficulty, in a stable order', () => {
  const entries = [
    { kana: 'えいきょう', meaning: 'influence', jlpt: 3 },
    { kana: 'がっこう', meaning: 'school', jlpt: 5 },
    { kana: 'ねこ', meaning: 'cat', jlpt: 5 },
    { kana: 'さくら', meaning: 'cherry blossom' },
    { kana: 'かぎ', meaning: 'key', jlpt: 4 },
  ];
  const order = prepareDeck(entries, 'h', 1).map(w => w.kana);
  assert.deepEqual(order.slice(0, 2).sort(), ['さくら', 'ねこ']);
  assert.deepEqual(order.slice(2), ['がっこう', 'かぎ', 'えいきょう']);
  assert.deepEqual(prepareDeck(entries, 'h', 1).map(w => w.kana), order);
});

test('level labels', () => {
  assert.equal(levelLabel(5), 'N5');
  assert.equal(levelLabel(0), 'Everyday');
});
