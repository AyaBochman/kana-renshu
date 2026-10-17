// Progress is kept in this browser's local storage and can be exported to / imported from a JSON file.
//
// Shape (version 2):
// {
//   v: 2, updatedAt,
//   cards:    { "h:さくら": { s, ivl, e, due, reps, lapses, rl, last, mod, sus }, ... },  (see srs.js)
//   kana:     { h: { "さ": { o: rightCount, m: missCount } }, k: { ... } },
//   days:     { "2026-10-13": { n: wordsReviewed, ok: rightFirstTime, h: true, k: true, done: true } },
//   intro:    { date, h: newWordsToday, k: newWordsToday },
//   settings: { newPerDay, startLevel, audio, fonts, kanji, theme, seenIntro, lastExport }
// }

// The key name dates from the first version; the data inside is version 2.
const KEY = 'kana-renshu-v1';

const DEFAULT_SETTINGS = {
  newPerDay: 10,
  startLevel: 5,
  audio: true,
  fonts: true,
  kanji: true,
  theme: 'system',
  seenIntro: false,
  lastExport: '',
};

export function freshState() {
  return { v: 2, updatedAt: 0, cards: {}, kana: { h: {}, k: {} }, days: {}, intro: { date: '', h: 0, k: 0 }, settings: { ...DEFAULT_SETTINGS } };
}

const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);

// Accepts anything and returns a valid state. Version 1 (single-character cards) keeps only its streak.
export function normalize(s) {
  const f = freshState();
  if (!isObj(s)) return f;
  const v2 = s.v === 2;
  return {
    v: 2,
    updatedAt: Number(s.updatedAt) || 0,
    cards: v2 && isObj(s.cards) ? s.cards : {},
    kana: v2 && isObj(s.kana) ? { h: isObj(s.kana.h) ? s.kana.h : {}, k: isObj(s.kana.k) ? s.kana.k : {} } : { h: {}, k: {} },
    days: isObj(s.days) ? s.days : {},
    intro: v2 && isObj(s.intro) ? s.intro : { date: '', h: 0, k: 0 },
    settings: { ...f.settings, ...(v2 && isObj(s.settings) ? s.settings : {}) },
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalize(JSON.parse(raw)) : freshState();
  } catch {
    return freshState();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

// Ask the browser not to clear our data under storage pressure. Some browsers (Firefox) show a
// prompt, so this runs after a finished session or an export, never in the middle of practice.
let persistAsked = false;
export function requestPersistence() {
  if (persistAsked || typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.persist) return;
  persistAsked = true;
  navigator.storage.persist().catch(() => {});
}
export const STORAGE_KEY = KEY;

export function exportFile(state, today) {
  const filename = `kana-renshu-progress-${today}.json`;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  return { filename, blob };
}

// Throws an Error with a readable message if the file isn't a progress export.
export function parseImport(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("That file isn't valid JSON."); }
  if (!isObj(data) || data.v !== 2 || !isObj(data.cards)) {
    throw new Error("That file isn't a Kana Renshū progress export.");
  }
  return normalize(data);
}

// The more recently changed of two copies of a card.
function newer(a, b) {
  if ((a.mod || 0) !== (b.mod || 0)) return (a.mod || 0) > (b.mod || 0) ? a : b;
  if ((a.last || '') !== (b.last || '')) return (a.last || '') > (b.last || '') ? a : b;
  return (a.reps || 0) >= (b.reps || 0) ? a : b;
}

/**
 * Combine progress from two devices. Each word keeps whichever copy changed most recently,
 * practice days are combined, and this device's settings stay as they are.
 */
export function mergeStates(local, incoming) {
  const a = normalize(structuredClone(local));
  const b = normalize(structuredClone(incoming));
  for (const [key, card] of Object.entries(b.cards)) {
    a.cards[key] = a.cards[key] ? newer(a.cards[key], card) : card;
  }
  for (const s of ['h', 'k']) {
    for (const [k, v] of Object.entries(b.kana[s])) {
      const o = a.kana[s][k] || { o: 0, m: 0 };
      a.kana[s][k] = { o: Math.max(o.o || 0, v.o || 0), m: Math.max(o.m || 0, v.m || 0) };
    }
  }
  for (const [d, v] of Object.entries(b.days)) {
    const o = a.days[d];
    a.days[d] = !o ? v : {
      n: Math.max(o.n || 0, v.n || 0),
      ok: Math.max(o.ok || 0, v.ok || 0),
      h: !!(o.h || v.h),
      k: !!(o.k || v.k),
      done: !!(o.done || v.done),
    };
  }
  if (b.intro.date > a.intro.date) a.intro = b.intro;
  else if (b.intro.date === a.intro.date) {
    a.intro = { date: a.intro.date, h: Math.max(a.intro.h || 0, b.intro.h || 0), k: Math.max(a.intro.k || 0, b.intro.k || 0) };
  }
  return a;
}
