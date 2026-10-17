// Word decks: loading the JSON files and putting new words in the order they get introduced.
import { seededRandom } from './random.js';

export const DECKS = {
  h: { file: 'data/hiragana.json', ja: 'ひらがな', en: 'Hiragana', seed: 4127 },
  k: { file: 'data/katakana.json', ja: 'カタカナ', en: 'Katakana', seed: 9133 },
};

// JLPT levels from easiest to hardest. Words not on the JLPT lists are "everyday" and count as N5.
export const LEVELS = [5, 4, 3, 2, 1];
export const levelLabel = jlpt => (jlpt ? 'N' + jlpt : 'Everyday');

// Reading difficulty, worked out from the kana:
// 1 plain kana, 2 with dakuten (が, ぱ), 3 with small っ/ゃ or ー, 4 phrases and extended katakana (ファ, ヴ).
export function tierOf(kana) {
  if (/ /.test(kana) || /[ァィゥェォヮヴ]/.test(kana)) return 4;
  if (/[っッゃゅょャュョー]/.test(kana)) return 3;
  if (/[゙゚]/.test(kana.normalize('NFD'))) return 2;
  return 1;
}

/**
 * Turn the raw JSON entries into words: { key, script, kana, kanji, meaning, jlpt, reading, tier }.
 * Order: by JLPT level (N5 first), then by reading difficulty, shuffled within each group.
 */
export function prepareDeck(entries, script, seed) {
  const seen = new Set();
  const words = [];
  for (const e of entries) {
    if (!e || !e.kana || seen.has(e.kana)) continue;
    seen.add(e.kana);
    words.push({
      key: script + ':' + e.kana,
      script,
      kana: e.kana,
      kanji: e.kanji || '',
      meaning: e.meaning || '',
      jlpt: Number(e.jlpt) || 0,
      reading: e.reading || '',
      tier: tierOf(e.kana),
    });
  }
  const rng = seededRandom(seed); // the same order on every device
  const out = [];
  for (const level of LEVELS) {
    for (const tier of [1, 2, 3, 4]) {
      const group = words.filter(w => (w.jlpt || 5) === level && w.tier === tier);
      for (let i = group.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [group[i], group[j]] = [group[j], group[i]];
      }
      out.push(...group);
    }
  }
  return out;
}

export async function loadDecks(fetchJson = url => fetch(url).then(r => {
  if (!r.ok) throw new Error(url + ' returned ' + r.status);
  return r.json();
})) {
  const out = {};
  for (const [script, d] of Object.entries(DECKS)) {
    out[script] = prepareDeck(await fetchJson(d.file), script, d.seed);
  }
  return out;
}
