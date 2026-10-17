// A practice session: show a word, check the typed reading, explain mistakes, grade, repeat.
import { app, $, esc, plan, commit, go, isTouch, pickFont, squareHTML, drawCross, drawRing, hanamaruSVG } from './app.js';
import { requestPersistence } from './storage.js';
import { REVERSE, lookalikeHint } from './kana.js';
import { matcher, judge, align, normalizeInput } from './romaji.js';
import { applyGrade, suggestGrade, formatInterval, streak, todayString } from './srs.js';
import { DECKS, levelLabel } from './decks.js';
import { speak, hasVoice } from './audio.js';
import { mountScene } from './scenes.js';
import { icon } from './icons.js';

const input = $('cInput');

// Play the word, and say so on screen if no sound came out.
function say(text) {
  const note = $('soundNote');
  note.hidden = true;
  speak(text, {
    onFail: reason => {
      note.textContent = reason === 'not-allowed'
        ? 'The browser blocked the sound. Tap the speaker to play it.'
        : 'No sound played. Check that your volume is on, or test the voice in Settings → Sound.';
      note.hidden = false;
    },
  });
}
let session = null;
let card = null;     // the word on screen: { key, word, font, shownAt, answered, verdict, segs, suggested }
let undo = null;     // snapshot from just before the last grade
let doneScene = null;

export const inSession = () => !!session;

/* ---------- starting and ending ---------- */
// Learning cards first, then reviews with the new words spread evenly among them.
function buildQueue(script, kind) {
  const p = plan(script);
  if (kind === 'more') return p.unseen.slice(0, 5).map(w => w.key);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const queue = shuffle(p.learning.map(w => w.key));
  const reviews = shuffle(p.review.map(w => w.key));
  const fresh = p.fresh.map(w => w.key);
  const total = reviews.length + fresh.length;
  let ri = 0, fi = 0;
  for (let i = 0; i < total; i++) {
    const takeFresh = fi < fresh.length && (ri >= reviews.length || (fi + 1) / (fresh.length + 1) <= (i + 1) / (total + 1));
    queue.push(takeFresh ? fresh[fi++] : reviews[ri++]);
  }
  return queue;
}

function begin(deck, kind, queue) {
  if (!queue.length) return;
  session = { deck, kind, queue, idx: 0, phase: 'card', first: {}, newKeys: [], missKeys: [], retries: {} };
  undo = null;
  go('session');
  showCard();
}
export const startDeck = (script, kind = 'daily') => begin(script, kind, buildQueue(script, kind));
// Go through some words again without changing their schedule.
const startDrill = (script, keys) => begin(script, 'drill', [...keys]);

function endSession() {
  session = null;
  undo = null;
  if (doneScene) { doneScene.destroy(); doneScene = null; }
  input.blur();
  go('today');
}
$('endBtn').addEventListener('click', endSession);
$('undoBtn').addEventListener('click', () => undoLast());

/* ---------- header ---------- */
function renderHeader() {
  const d = DECKS[session.deck];
  const label = { daily: d.en + ' words', more: 'extra new words', drill: 'drill, schedule unchanged' }[session.kind];
  $('sDeck').innerHTML = `<span lang="ja">${d.ja}</span><small>${label}</small>`;
  $('undoBtn').hidden = !undo;
  if (session.phase === 'done') { $('counters').innerHTML = ''; $('barFill').style.width = '100%'; return; }
  const seen = new Set();
  let n = 0, l = 0, r = 0;
  for (let i = session.idx; i < session.queue.length; i++) {
    const k = session.queue[i];
    if (seen.has(k)) continue;
    seen.add(k);
    const st = app.state.cards[k];
    if (!st || st.s === 'n') n++; else if (st.s === 'l') l++; else r++;
  }
  const st = app.state.cards[session.queue[session.idx]];
  const now = !st || st.s === 'n' ? 'n' : st.s === 'l' ? 'l' : 'r';
  $('counters').innerHTML = session.kind === 'drill'
    ? `<span>${session.queue.length - session.idx}<small>left</small></span>`
    : `<span class="c-new${now === 'n' ? ' now' : ''}">${n}<small>new</small></span>` +
      `<span class="c-learn${now === 'l' ? ' now' : ''}">${l}<small>learning</small></span>` +
      `<span class="c-rev${now === 'r' ? ' now' : ''}">${r}<small>review</small></span>`;
  $('barFill').style.width = (session.idx / session.queue.length * 100) + '%';
}

/* ---------- one card ---------- */
function sizeWordRow() {
  const row = $('wordRow');
  const n = Number(row.dataset.n || 1), gaps = Number(row.dataset.gaps || 0);
  const avail = Math.min($('session').clientWidth || 600, 660) - 8;
  const perLine = Math.min(n, 8);
  const size = Math.floor(avail / (perLine + (n <= 8 ? gaps * 0.35 : 0)));
  row.style.setProperty('--wsq', Math.max(36, Math.min(isTouch() ? 72 : 84, size)) + 'px');
}
window.addEventListener('resize', () => { if (session && session.phase === 'card') sizeWordRow(); });

function showCard() {
  session.phase = 'card';
  $('phCard').hidden = false;
  $('phDone').hidden = true;
  $('endBtn').hidden = false;
  if (doneScene) { doneScene.destroy(); doneScene = null; }
  const key = session.queue[session.idx];
  const word = app.byKey.get(key);
  const font = pickFont();
  card = { key, word, font, shownAt: performance.now(), answered: false, verdict: null, segs: null, suggested: 3 };

  const chars = [...word.kana];
  const row = $('wordRow');
  row.dataset.n = chars.filter(c => c !== ' ').length;
  row.dataset.gaps = chars.filter(c => c === ' ').length;
  row.innerHTML = chars.map((c, i) => (c === ' ' ? '<span class="gap"></span>' : squareHTML(c, font, ` data-i="${i}"`))).join('');
  row.classList.remove('enter');
  void row.offsetWidth;
  row.classList.add('enter');
  sizeWordRow();

  $('cFont').innerHTML = app.state.settings.fonts ? `<span lang="ja">${font.ja}</span>${font.en}` : '';
  const st = app.state.cards[key];
  const tag = $('cTag');
  if (session.kind === 'drill') { tag.className = 'tag'; tag.textContent = 'Drill'; }
  else if (key in session.first) { tag.className = 'tag again'; tag.textContent = 'Once more'; }
  else if (!st || st.s === 'n') { tag.className = 'tag t-new'; tag.textContent = 'New word'; }
  else if (st.s === 'l') { tag.className = 'tag t-learn'; tag.textContent = 'Learning'; }
  else { tag.className = 'tag'; tag.textContent = 'Review'; }
  $('cLevel').textContent = levelLabel(word.jlpt);

  const firstEver = session.idx === 0 && !Object.keys(app.state.cards).length;
  $('cHint').textContent = firstEver ? 'Type what the word says in rōmaji and press Enter. Not sure? Check with the box empty to see it.' : '';
  $('cHint').hidden = !firstEver;
  $('reveal').hidden = true;
  $('cForm').hidden = false;
  $('cCheck').hidden = false;
  input.readOnly = false;
  input.value = '';
  input.focus({ preventScroll: true });
  renderHeader();
}

function misreadLines() {
  const { word, verdict, segs } = card;
  const m = matcher(word);
  const v = normalizeInput(input.value);
  if (verdict === 'long') {
    return [`<p>Long vowels change the word in Japanese. You typed <span class="typed">${esc(v)}</span>; this is read <span class="typed">${esc(m.romaji)}</span>.</p>`];
  }
  if (verdict !== 'wrong') return [];
  const lines = [`<p>You typed <span class="typed">${esc(v)}</span>.</p>`];
  segs.filter(sg => !sg.ok).slice(0, 4).forEach(({ u, seg }) => {
    const expected = u.alts[0];
    if (u.isLong && u.kana === 'ー') { lines.push('<p><span class="k" lang="ja">ー</span> stretches the vowel before it: read it twice.</p>'); return; }
    if (u.keys.length === 2 && (u.keys[0] === 'っ' || u.keys[0] === 'ッ')) {
      lines.push(`<p><span class="k" lang="ja">${u.kana}</span> is <b>${expected}</b>. The small <span lang="ja">${u.keys[0]}</span> doubles the next consonant.</p>`);
      return;
    }
    const other = seg ? REVERSE[word.script][seg] : '';
    const hint = other ? lookalikeHint(word.script, u.kana, other) : '';
    const read = seg ? `You read it as <b>${esc(seg)}</b>${other && other !== u.kana ? ` (<span lang="ja">${other}</span>)` : ''}.` : 'You skipped it.';
    lines.push(`<p><span class="k" lang="ja">${u.kana}</span> is <b>${expected}</b>. ${read}${hint ? ' ' + hint : ''}</p>`);
  });
  return lines;
}

function renderGrades() {
  const drill = session.kind === 'drill';
  $('grades').hidden = drill;
  $('nextBtn').hidden = !drill;
  $('gradeKeys').hidden = drill;
  if (drill) return;
  const prev = app.state.cards[card.key];
  $('grades').innerHTML = [[1, 'Again'], [2, 'Hard'], [3, 'Good'], [4, 'Easy']].map(([g, label]) => {
    const p = applyGrade(prev, g, { preview: true });
    const when = p.requeue ? (p.requeue <= 3 ? 'soon' : 'later') : formatInterval(p.st.ivl);
    return `<button type="button" class="grade${g === card.suggested ? ' suggested' : ''}" data-g="${g}"><span class="gk keys-only">${g}</span><b>${label}</b><small>${when}</small></button>`;
  }).join('');
}

function showVerdict() {
  const { word, verdict } = card;
  const right = verdict === 'ok' || verdict === 'long';
  const el = $('rVerdict');
  el.className = 'verdict ' + (right ? 'ok' : 'no');
  el.textContent = card.mistyped ? 'Counted as right' : { ok: 'Correct', long: 'Right, but watch the long vowel', empty: 'Here is the reading', wrong: 'Not quite' }[verdict];
  $('srStatus').textContent = `${el.textContent}. ${matcher(word).romaji}: ${word.meaning}.`;
  $('rRoma').textContent = matcher(word).romaji;
  $('rMeaning').textContent = word.meaning;
  $('rKanji').textContent = app.state.settings.kanji ? word.kanji : '';
  const lines = misreadLines();
  $('rMis').innerHTML = lines.join('');
  $('rMis').hidden = !lines.length;
  $('mistypedBtn').hidden = verdict !== 'wrong';
  $('playBtn').hidden = !hasVoice();
  renderGrades();
}

function submit() {
  if (!card || card.answered) return;
  const { word } = card;
  const m = matcher(word);
  const v = normalizeInput(input.value);
  card.answered = true;
  card.verdict = judge(word, input.value);
  card.segs = card.verdict === 'wrong' ? align(m.units, v) : m.units.map(u => ({ u, seg: '', ok: true }));
  card.suggested = suggestGrade(card.verdict, performance.now() - card.shownAt, m.units.length);

  input.readOnly = true;
  $('cCheck').hidden = true;
  $('cHint').hidden = true;
  const row = $('wordRow');
  if (card.verdict === 'ok' || card.verdict === 'long') drawRing(row);
  else if (card.verdict === 'wrong') {
    for (const { u, ok } of card.segs) {
      if (ok) continue;
      for (let i = u.from; i <= u.to; i++) {
        const mark = row.querySelector(`[data-i="${i}"] .mark`);
        if (mark) drawCross(mark);
      }
    }
  }
  showVerdict();
  $('reveal').hidden = false;
  $('soundNote').hidden = true;
  if (app.state.settings.audio) say(word.kana);
  // On phones, put the keyboard away so the meaning and grade buttons are visible.
  if (isTouch()) {
    input.blur();
    requestAnimationFrame(() => $('reveal').scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }
}
$('cForm').addEventListener('submit', e => { e.preventDefault(); submit(); });
$('playBtn').addEventListener('click', () => card && say(card.word.kana));

// The reading was right but the typing wasn't: count it as right.
function markMistyped() {
  if (!card || card.verdict !== 'wrong') return;
  card.verdict = 'ok';
  card.mistyped = true;
  card.segs = card.segs.map(s => ({ ...s, ok: true }));
  card.suggested = 3;
  const row = $('wordRow');
  row.querySelectorAll('.mark').forEach(m => { m.innerHTML = ''; });
  drawRing(row);
  showVerdict();
}
$('mistypedBtn').addEventListener('click', markMistyped);

// Count each character as read right or misread, for the chart and the "misread" list.
function recordKana(script, segs) {
  const table = app.state.kana[script];
  const bump = (k, ok) => { const e = table[k] || (table[k] = { o: 0, m: 0 }); if (ok) e.o++; else e.m++; };
  for (const { u, seg, ok } of segs) {
    if (!u.keys.length) continue;
    if (u.keys.length === 2 && !ok && u.nextAlts) {
      bump(u.keys[0], false);
      bump(u.keys[1], u.nextAlts.some(a => seg.endsWith(a)));
    } else u.keys.forEach(k => bump(k, ok));
  }
}

function grade(g) {
  if (!card || !card.answered || session.phase !== 'card') return;
  const { key, word, verdict, segs } = card;
  const s = app.state;
  const today = todayString();
  undo = {
    session: structuredClone(session),
    key,
    card: s.cards[key] ? structuredClone(s.cards[key]) : null,
    today,
    day: s.days[today] ? structuredClone(s.days[today]) : null,
    script: word.script,
    kana: structuredClone(s.kana[word.script]),
    intro: structuredClone(s.intro),
  };

  if (session.kind === 'drill') {
    const wrong = verdict !== 'ok' && verdict !== 'long';
    if (wrong && (session.retries[key] || 0) < 2) {
      session.retries[key] = (session.retries[key] || 0) + 1;
      session.queue.splice(Math.min(session.idx + 4, session.queue.length), 0, key);
    }
    if (!(key in session.first)) session.first[key] = verdict;
  } else {
    if (!(key in session.first)) {
      session.first[key] = verdict;
      const day = s.days[today] || (s.days[today] = { n: 0, ok: 0 });
      day.n = (day.n || 0) + 1;
      if (verdict === 'ok' || verdict === 'long') day.ok = (day.ok || 0) + 1;
      else session.missKeys.push(key);
      if (verdict !== 'empty') recordKana(word.script, segs);
    }
    const prev = s.cards[key];
    const wasNew = !prev || prev.s === 'n';
    const { st, requeue } = applyGrade(prev, g);
    s.cards[key] = st;
    if (wasNew) {
      if (s.intro.date !== today) s.intro = { date: today, h: 0, k: 0 };
      s.intro[session.deck] = (s.intro[session.deck] || 0) + 1;
      session.newKeys.push(key);
    }
    if (requeue) session.queue.splice(Math.min(session.idx + requeue + 1, session.queue.length), 0, key);
    commit();
  }
  session.idx++;
  if (session.idx >= session.queue.length) finish();
  else showCard();
}
$('grades').addEventListener('click', e => { const b = e.target.closest('.grade'); if (b) grade(Number(b.dataset.g)); });
$('nextBtn').addEventListener('click', () => grade(3));

function undoLast() {
  if (!undo) return;
  const s = app.state;
  if (undo.card) s.cards[undo.key] = undo.card; else delete s.cards[undo.key];
  if (undo.day) s.days[undo.today] = undo.day; else delete s.days[undo.today];
  s.kana[undo.script] = undo.kana;
  s.intro = undo.intro;
  session = undo.session;
  undo = null;
  commit();
  showCard();
}

/* ---------- the end of a session ---------- */
function finish() {
  if (session.kind === 'daily') {
    const today = todayString();
    const day = app.state.days[today] || (app.state.days[today] = { n: 0, ok: 0 });
    day[session.deck] = true;
    day.done = true;
    commit();
  }
  session.phase = 'done';
  input.blur();
  requestPersistence();
  renderDone();
}

function vocabRows(keys) {
  return keys.map(k => {
    const w = app.byKey.get(k);
    return `<div class="vocab-row"><span class="vk" lang="ja">${esc(w.kana)}</span><span class="vr">${esc(matcher(w).romaji)}</span><span class="vm">${esc(w.meaning)}</span>${hasVoice() ? `<button type="button" class="icon-btn" data-say="${esc(w.kana)}" aria-label="Play ${esc(w.kana)}">${icon('sound', 16)}</button>` : ''}</div>`;
  }).join('');
}

function renderDone() {
  $('phCard').hidden = true;
  $('endBtn').hidden = true;
  renderHeader();
  const results = Object.values(session.first);
  const n = results.length, ok = results.filter(v => v === 'ok' || v === 'long').length;
  const missed = [...new Set(session.missKeys)];
  const box = $('phDone');
  let html = '<div class="done-scene" id="doneScene"></div>';
  if (session.kind === 'drill') {
    html += `<div class="stamp"><p class="phrase" lang="ja">おつかれさま</p><p class="tr">Drill finished · ${ok} of ${n} right the first time. Schedules didn't change.</p></div>`;
  } else {
    const great = n >= 5 && ok / n >= 0.9;
    const days = streak(app.state.days);
    html += `<div class="stamp">${great ? hanamaruSVG('draw') : ''}
      <p class="phrase" lang="ja">${great ? 'よくできました' : 'がんばりました'}</p>
      <p class="tr">${great ? 'Very well done' : 'Good effort'}${days ? ` · ${days} ${days === 1 ? 'day' : 'days'} in a row` : ''}</p></div>
      <div class="tally">
        <div><b>${ok}/${n}</b><span>read right the first time</span></div>
        <div><b>${session.newKeys.length}</b><span>new ${session.newKeys.length === 1 ? 'word' : 'words'}</span></div>
      </div>`;
    if (session.newKeys.length) html += `<div class="vocab"><h3>New words today</h3>${vocabRows(session.newKeys)}</div>`;
    if (missed.length) html += `<div class="vocab"><h3>Words you misread</h3>${vocabRows(missed)}</div>`;
  }
  const other = session.deck === 'h' ? 'k' : 'h';
  const otherTotal = plan(other).total;
  html += '<div class="next-row">';
  if (missed.length && session.kind !== 'drill') html += `<button type="button" class="btn" data-act="drill">${missed.length === 1 ? 'Drill the word I missed' : `Drill the ${missed.length} I missed`}</button>`;
  if (otherTotal && session.kind !== 'drill') html += `<button type="button" class="btn" data-act="other">Start <span lang="ja">${DECKS[other].ja}</span> (${otherTotal})</button>`;
  html += '<button type="button" class="btn primary" data-act="home">Back to today <kbd>Enter</kbd></button></div>';
  box.innerHTML = html;
  box.hidden = false;
  doneScene = mountScene($('doneScene'), 'garden');
  box.onclick = e => {
    const say = e.target.closest('[data-say]');
    if (say) { speak(say.dataset.say); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'home') endSession();
    if (b.dataset.act === 'drill') startDrill(session.deck, missed);
    if (b.dataset.act === 'other') startDeck(other, 'daily');
  };
}

/* ---------- keyboard ---------- */
export function handleSessionKey(e) {
  if (!session) return false;
  // Ignore keys while a Japanese input method is composing, and a held-down Enter
  // (auto-repeat would otherwise check, grade and skip through cards on its own).
  if (e.isComposing || e.keyCode === 229) return false;
  if (e.repeat && e.key === 'Enter') return true;
  const active = document.activeElement;
  const onButton = active && active.tagName === 'BUTTON';
  if (e.key === 'Escape') { endSession(); return true; }
  if ((e.key === 'z' || e.key === 'Z') && undo && (session.phase === 'done' || card.answered)) { undoLast(); return true; }
  if (session.phase === 'done') {
    if (e.key === 'Enter' && !onButton) { endSession(); return true; }
    return false;
  }
  if (card.answered) {
    if (e.key === 'p' || e.key === 'P') { say(card.word.kana); return true; }
    if (session.kind === 'drill') {
      if (e.key === 'Enter' && !onButton) { grade(3); return true; }
      return false;
    }
    if (/^[1-4]$/.test(e.key)) { grade(Number(e.key)); return true; }
    if (e.key === 'Enter' && !onButton) { grade(card.suggested); return true; }
    return false;
  }
  if (e.key === 'Enter' && active !== input && !onButton) { input.focus(); return true; }
  return false;
}
