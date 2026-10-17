// Reading kana as rōmaji: splitting a word into reading units, showing the Hepburn reading,
// and checking what the learner typed, including which characters they misread.
import { UNIT } from './kana.js';

const MACRON = { a: 'ā', i: 'ī', u: 'ū', e: 'ē', o: 'ō' };
const lastVowel = s => { const c = (s || '').slice(-1); return c && 'aeiou'.includes(c) ? c : ''; };
const uniq = a => [...new Set(a)];
const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Split kana into units: a kana with its small ゃ/ゅ/ょ/ァ…, small っ, the long mark ー, ん, or a space.
export function tokenize(word) {
  const chars = [...word], units = [];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === ' ') { units.push({ type: 'space', kana: c, from: i, to: i }); continue; }
    if (c === 'っ' || c === 'ッ') { units.push({ type: 'soku', kana: c, from: i, to: i }); continue; }
    if (c === 'ー') { units.push({ type: 'long', kana: c, from: i, to: i }); continue; }
    const two = c + (chars[i + 1] || '');
    if (chars[i + 1] && UNIT[two]) { units.push({ type: 'kana', kana: two, from: i, to: i + 1, alts: UNIT[two].slice() }); i++; continue; }
    if (UNIT[c]) units.push({ type: c === 'ん' || c === 'ン' ? 'n' : 'kana', kana: c, from: i, to: i, alts: UNIT[c].slice() });
    else units.push({ type: 'other', kana: c, from: i, to: i, alts: [''] });
  }
  return units;
}

// Units used to check an answer. `alts` are the strict spellings; `loose` also lets a long vowel
// be left out, which still counts as right but is graded down.
export function readingUnits(word, script) {
  const raw = tokenize(word), out = [];
  for (let i = 0; i < raw.length; i++) {
    const u = raw[i];
    if (u.type === 'space') continue;
    const prev = out[out.length - 1];
    const pv = prev ? prev.vowel : '';
    if (u.type === 'soku') {
      const next = raw[i + 1];
      if (next && next.alts && next.type !== 'space') {
        const alts = uniq(next.alts.flatMap(a => a.startsWith('ch') ? [a[0] + a, 't' + a] : [a[0] + a]));
        out.push({ kana: u.kana + next.kana, from: u.from, to: next.to, alts, loose: alts, keys: [u.kana, next.kana], nextAlts: next.alts, vowel: lastVowel(next.alts[0]) });
        i++;
      } else {
        out.push({ kana: u.kana, from: u.from, to: u.to, alts: ['t'], loose: ['t', ''], keys: [u.kana], vowel: '' });
      }
      continue;
    }
    if (u.type === 'long') {
      const alts = pv === 'o' ? ['o', 'u'] : pv === 'e' ? ['e', 'i'] : pv ? [pv] : [''];
      out.push({ kana: u.kana, from: u.from, to: u.to, alts, loose: uniq([...alts, '']), keys: [], vowel: pv, isLong: true });
      continue;
    }
    let alts = u.alts.slice(), loose = null;
    if (script === 'h' && u.kana === 'う' && (pv === 'o' || pv === 'u')) { alts = pv === 'o' ? ['u', 'o'] : ['u']; loose = [...alts, '']; }
    else if (script === 'h' && u.kana === 'お' && pv === 'o') { alts = ['o', 'u']; loose = ['o', 'u', '']; }
    else if (script === 'h' && u.kana === 'い' && pv === 'e') { alts = ['i', 'e']; }
    if (u.type === 'n') {
      let next = raw[i + 1];
      if (next && next.type === 'space') next = raw[i + 2];
      if (next && next.alts && /^[bmp]/.test(next.alts[0])) alts.push('m');
    }
    out.push({ kana: u.kana, from: u.from, to: u.to, alts, loose: loose || alts, keys: [u.kana], vowel: u.type === 'n' ? '' : lastVowel(alts[0]), isLong: !!loose });
  }
  return out;
}

// Hepburn with macrons for long vowels: とうきょう → tōkyō, コーヒー → kōhī.
export function displayRomaji(word) {
  if (word.reading) return word.reading;
  let out = '', soku = false;
  const macron = () => { const v = lastVowel(out); if (v) out = out.slice(0, -1) + MACRON[v]; };
  tokenize(word.kana).forEach(u => {
    if (u.type === 'space') { out += ' '; return; }
    if (u.type === 'soku') { soku = true; return; }
    if (u.type === 'long') { macron(); return; }
    let r = u.alts[0];
    const pv = lastVowel(out);
    const longVowel = (u.kana === 'う' && (pv === 'o' || pv === 'u')) || (u.kana === 'お' && pv === 'o');
    if (word.script === 'h' && !soku && longVowel) { macron(); return; }
    if (soku) { r = (r.startsWith('ch') ? 't' : r[0]) + r; soku = false; }
    out += r;
  });
  return out;
}

// Lowercase letters only. Macrons and circumflexes double the vowel, and a dash after a vowel
// repeats it, so kōhī, koohii and ko-hi- all become koohii.
export function normalizeInput(s) {
  s = String(s || '').toLowerCase().normalize('NFD').replace(/([aeiou])[̄̂]/g, '$1$1');
  let out = '';
  for (const ch of s) {
    if (ch >= 'a' && ch <= 'z') out += ch;
    else if ('-ー‐−~'.includes(ch) && lastVowel(out)) out += out.slice(-1);
  }
  return out;
}

const cache = new Map();
export function matcher(word) {
  const key = word.script + ':' + word.kana;
  if (cache.has(key)) return cache.get(key);
  const units = readingUnits(word.kana, word.script);
  const rx = field => new RegExp('^' + units.map(u => '(?:' + u[field].map(escapeRegExp).join('|') + ')').join('') + '$');
  const m = {
    units,
    strict: rx('alts'),
    loose: rx('loose'),
    override: word.reading ? normalizeInput(word.reading) : null,
    romaji: displayRomaji(word),
  };
  cache.set(key, m);
  return m;
}

// 'ok', 'long' (right except a dropped long vowel), 'wrong', or 'empty'.
export function judge(word, input) {
  const m = matcher(word);
  const v = normalizeInput(input);
  if (!v) return 'empty';
  if (v === m.override || m.strict.test(v)) return 'ok';
  if (m.loose.test(v)) return 'long';
  return 'wrong';
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return row[b.length];
}

// Line a wrong answer up against the word's units to find which ones were misread.
// Returns one { u, seg, ok } per unit, where seg is the part of the answer given for that unit.
export function align(units, v) {
  const n = units.length, L = v.length, INF = 1e9;
  const cost = Array.from({ length: n + 1 }, () => new Array(L + 1).fill(INF));
  const back = Array.from({ length: n + 1 }, () => new Array(L + 1).fill(-1));
  cost[0][0] = 0;
  for (let i = 0; i < n; i++) {
    const u = units[i];
    const maxLen = i === n - 1 ? L : 6;
    for (let j = 0; j <= L; j++) {
      if (cost[i][j] >= INF) continue;
      for (let l = 0; l <= Math.min(maxLen, L - j); l++) {
        const seg = v.substr(j, l);
        // ー repeats whatever vowel was just read, even if that character was misread (シー read as "tsuu").
        const ok = u.loose.includes(seg) || (u.kana === 'ー' && l === 1 && 'aeiou'.includes(seg) && seg === v[j - 1]);
        const miss = () => 1 + 0.2 * Math.min(...u.alts.map(a => editDistance(seg, a))) + (l === 0 ? 0.3 : 0);
        const c = cost[i][j] + (ok ? (l === 0 ? 0.05 : 0) : miss());
        if (c < cost[i + 1][j + l]) { cost[i + 1][j + l] = c; back[i + 1][j + l] = j; }
      }
    }
  }
  if (cost[n][L] >= INF) return units.map(u => ({ u, seg: '', ok: false }));
  const segs = [];
  let j = L;
  for (let i = n; i > 0; i--) {
    const pj = back[i][j];
    const seg = v.slice(pj, j);
    const u = units[i - 1];
    segs.unshift({ u, seg, ok: u.loose.includes(seg) || (u.kana === 'ー' && seg.length === 1 && seg === v[pj - 1]) });
    j = pj;
  }
  return segs;
}
