// Spaced repetition, modelled on Anki's SM-2 scheduler, plus the date helpers it needs.
//
// A card's state: s = 'n' (new) | 'l' (learning) | 'r' (review), ivl = days until the next review,
// e = ease factor, due = 'YYYY-MM-DD', reps, lapses, rl = true while relearning after a lapse,
// sus = true when suspended, mod = when it last changed (used to merge progress files).

const MAX_REVIEWS_PER_DAY = 150;
export const MATURE_DAYS = 21;
// Like Anki, a new day starts at 4 a.m., so practising after midnight still counts for the evening before.
const DAY_START_HOUR = 4;

function dateString(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
// Uses the clock hour rather than subtracting 4 hours, so daylight-saving days still switch at 4 a.m.
export function todayString(now = new Date()) {
  const d = new Date(now);
  if (d.getHours() < DAY_START_HOUR) d.setDate(d.getDate() - 1);
  return dateString(d);
}
// 'YYYY-MM-DD' as a local date at noon (safe from daylight-saving shifts).
export function parseDay(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
export function addDays(ds, n) {
  const [y, m, d] = ds.split('-').map(Number);
  return dateString(new Date(y, m - 1, d + n));
}
export function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 864e5);
}

/**
 * Apply a grade (1 Again, 2 Hard, 3 Good, 4 Easy) to a card.
 * Returns the new state and `requeue`: how many cards later it should come back in this session (0 = not today).
 * With `preview`, nothing is dated or randomised, so the result can label the grade buttons.
 */
export function applyGrade(prev, grade, { today = todayString(), preview = false, random = Math.random, now = Date.now() } = {}) {
  const st = { s: 'n', ivl: 0, e: 2.5, reps: 0, lapses: 0, ...(prev ? structuredClone(prev) : {}) };
  let requeue = 0;
  if (st.s === 'n' || st.s === 'l') {
    if (grade === 1) { st.s = 'l'; requeue = 3; }
    else if (grade === 2) { st.s = 'l'; requeue = 6; }
    else if (grade === 3) { st.ivl = st.rl ? Math.max(1, st.ivl || 1) : 1; st.s = 'r'; delete st.rl; }
    else { st.ivl = st.rl ? Math.max(2, (st.ivl || 1) + 1) : 4; st.s = 'r'; delete st.rl; }
  } else {
    if (grade === 1) { st.lapses++; st.e = Math.max(1.3, st.e - 0.2); st.ivl = 1; st.s = 'l'; st.rl = true; requeue = 3; }
    else if (grade === 2) { st.e = Math.max(1.3, st.e - 0.15); st.ivl = Math.max(st.ivl + 1, Math.round(st.ivl * 1.2)); }
    else if (grade === 3) { st.ivl = Math.max(st.ivl + 1, Math.round(st.ivl * st.e)); }
    else { st.e += 0.15; st.ivl = Math.max(st.ivl + 2, Math.round(st.ivl * st.e * 1.3)); }
  }
  if (!preview) {
    st.reps++;
    st.last = today;
    st.mod = now;
    if (requeue) st.due = today;
    else {
      // A little fuzz so words learned together don't stay bunched up forever.
      if (st.ivl >= 3) st.ivl = Math.max(1, st.ivl + Math.round((random() * 2 - 1) * Math.max(1, st.ivl * 0.05)));
      st.due = addDays(today, st.ivl);
    }
  }
  return { st, requeue };
}

// The grade the app suggests: wrong → Again, missing long vowel → Hard, otherwise by answer speed.
export function suggestGrade(verdict, ms, unitCount) {
  if (verdict === 'long') return 2;
  if (verdict !== 'ok') return 1;
  const expected = 1400 + 650 * unitCount;
  return ms < expected * 0.55 ? 4 : ms < expected * 1.5 ? 3 : 2;
}

export function formatInterval(days) {
  if (days < 30) return days + 'd';
  if (days < 365) return (days / 30).toFixed(1).replace(/\.0$/, '') + 'mo';
  return (days / 365).toFixed(1).replace(/\.0$/, '') + 'y';
}

export const isMet = st => !!st && st.s !== 'n';

/**
 * What a deck has for today: learning and review cards that are due, and new words up to the daily limit.
 * New words come in deck order, starting from the chosen JLPT level (5 = N5) and moving up.
 * Everyday words count as N5.
 */
export function deckPlan(script, words, state, today = todayString()) {
  const learning = [], review = [], unseen = [];
  const start = state.settings.startLevel || 5;
  for (const w of words) {
    const st = state.cards[w.key];
    if (st && st.sus) continue;
    if (!isMet(st)) {
      if ((w.jlpt || 5) <= start) unseen.push(w);
      continue;
    }
    if ((st.due || today) <= today) (st.s === 'l' ? learning : review).push(w);
  }
  const introduced = state.intro.date === today ? (state.intro[script] || 0) : 0;
  const fresh = unseen.slice(0, Math.max(0, state.settings.newPerDay - introduced));
  const reviews = review.slice(0, MAX_REVIEWS_PER_DAY);
  return { learning, review: reviews, fresh, unseen, total: learning.length + reviews.length + fresh.length };
}

// How many words come due on each of the next `days` days (overdue ones count for today).
export function forecast(words, state, days = 7, today = todayString()) {
  const out = new Array(days).fill(0);
  for (const w of words) {
    const st = state.cards[w.key];
    if (!isMet(st) || st.sus || !st.due) continue;
    const d = Math.max(0, daysBetween(today, st.due));
    if (d < days) out[d]++;
  }
  return out;
}

// Days in a row with a finished session, counting today only once it's done.
export function streak(days, today = todayString()) {
  let d = today, n = 0;
  if (!(days[d] && days[d].done)) d = addDays(d, -1);
  while (days[d] && days[d].done) { n++; d = addDays(d, -1); }
  return n;
}
