// Merge JLPT vocabulary lists into the decks.
//
// Source: https://github.com/jamsinclair/open-anki-jlpt-decks (MIT), files src/n5.csv … src/n1.csv,
// originally based on Jonathan Waller's JLPT lists (tanos.co.uk, CC BY).
//
// Usage: node scripts/import-jlpt.mjs <folder containing n5.csv … n1.csv>
//
// Existing deck entries keep their meaning, kanji and reading; they only gain a "jlpt" level if the
// list has them. Words that aren't in the decks yet are added. Running it twice changes nothing.
import { readFileSync, writeFileSync } from 'node:fs';
import { tokenize } from '../src/romaji.js';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node scripts/import-jlpt.mjs <folder with n5.csv … n1.csv>');
  process.exit(1);
}
const root = new URL('../', import.meta.url);
const DECK_FILES = { h: 'data/hiragana.json', k: 'data/katakana.json' };

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const HIRAGANA_WORD = /^[ぁ-ゟ ー]+$/;
const KATAKANA_WORD = /^[ァ-ヿ]+$/;
const HAS_KANJI = /[一-鿿々]/;

// Split a sense into glosses on commas that aren't inside parentheses.
function glosses(sense) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of sense) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
// A single sense, cut to its first two glosses.
const shortSense = s => glosses(s).slice(0, 2).join(', ').replace(/[,;\s]+$/, '');

// Keep meanings short enough for a card: whole senses, up to about 64 characters.
function cleanMeaning(m) {
  const senses = m.replace(/\s+/g, ' ').replace(/^[-–—\s]+/, '').trim().split(/;\s*/)
    .map(s => s.replace(/[,;\s]+$/, '')).filter(Boolean)
    .map(s => (s.length > 70 ? shortSense(s) : s));
  let out = '';
  for (const s of senses) {
    const next = out ? `${out}; ${s}` : s;
    if (out && next.length > 64) break;
    out = next;
  }
  return out;
}

// Read the five lists into { reading → { jlpt, kanji: Set, meanings: [] } }.
const found = new Map();
let skipped = 0;
for (const level of [5, 4, 3, 2, 1]) {
  const rows = parseCSV(readFileSync(`${dir}/n${level}.csv`, 'utf8')).slice(1);
  for (let [expression = '', reading = '', meaning = ''] of rows) {
    // A few rows have expression and reading swapped.
    if (HAS_KANJI.test(reading) && !HAS_KANJI.test(expression)) [expression, reading] = [reading, expression];
    reading = reading.split(/[;；、/／]/)[0].trim();
    expression = expression.split(/[;；、/／]/)[0].trim();
    const ok = (HIRAGANA_WORD.test(reading) || KATAKANA_WORD.test(reading))
      && !reading.includes(' ')
      && !tokenize(reading).some(u => u.type === 'other');
    if (!ok || !meaning.trim()) { skipped++; continue; }
    const entry = found.get(reading) || { jlpt: level, kanji: new Set(), meanings: [] };
    entry.jlpt = Math.max(entry.jlpt, level); // a word listed at several levels counts at the easiest
    if (HAS_KANJI.test(expression)) entry.kanji.add(expression);
    const m = cleanMeaning(meaning);
    if (m && !entry.meanings.includes(m)) entry.meanings.push(m);
    found.set(reading, entry);
  }
}

const sortWords = (a, b) => (b.jlpt || 0) - (a.jlpt || 0) || a.kana.localeCompare(b.kana, 'ja');
let added = 0, tagged = 0;
for (const [script, file] of Object.entries(DECK_FILES)) {
  const url = new URL(file, root);
  const deck = JSON.parse(readFileSync(url, 'utf8'));
  const byKana = new Map(deck.map(w => [w.kana, w]));
  for (const [reading, e] of found) {
    const inThisDeck = script === 'k' ? KATAKANA_WORD.test(reading) : HIRAGANA_WORD.test(reading);
    if (!inThisDeck) continue;
    const existing = byKana.get(reading);
    if (existing) {
      if (!existing.jlpt || existing.jlpt < e.jlpt) { existing.jlpt = e.jlpt; tagged++; }
      if (!existing.kanji && e.kanji.size) existing.kanji = [...e.kanji].slice(0, 3).join('・');
      continue;
    }
    // Same-sounding words: keep the first sense of each, up to three of them.
    let meaning = e.meanings[0];
    if (e.meanings.length > 1) {
      meaning = shortSense(e.meanings[0].split('; ')[0]);
      for (const m of e.meanings.slice(1, 3)) {
        const next = `${meaning}; ${shortSense(m.split('; ')[0])}`;
        if (next.length > 90) break;
        meaning = next;
      }
    }
    const word = { kana: reading };
    if (e.kanji.size) word.kanji = [...e.kanji].slice(0, 3).join('・');
    word.meaning = meaning;
    word.jlpt = e.jlpt;
    deck.push(word);
    byKana.set(reading, word);
    added++;
  }
  deck.sort(sortWords);
  const ordered = deck.map(w => {
    const o = { kana: w.kana };
    if (w.kanji) o.kanji = w.kanji;
    o.meaning = w.meaning;
    if (w.jlpt) o.jlpt = w.jlpt;
    if (w.reading) o.reading = w.reading;
    return o;
  });
  writeFileSync(url, '[\n' + ordered.map(w => '  ' + JSON.stringify(w)).join(',\n') + '\n]\n');
  const counts = [5, 4, 3, 2, 1].map(n => `N${n} ${ordered.filter(w => w.jlpt === n).length}`).join(', ');
  console.log(`${file}: ${ordered.length} words (${counts}, everyday ${ordered.filter(w => !w.jlpt).length})`);
}
console.log(`Added ${added}, tagged ${tagged} existing words, skipped ${skipped} list entries (affixes, mixed scripts or unreadable).`);
