// The Today screen: the seasonal scene, a greeting, the two decks and what's due.
import { app, $, plan, commit, go, registerView } from './app.js';
import { DECKS, LEVELS } from './decks.js';
import { streak, todayString, daysBetween, isMet } from './srs.js';
import { mountScene, currentSeason } from './scenes.js';
import { startDeck } from './session.js';
import { heatmapHTML, forecastHTML, troubleHTML } from './progress.js';

const SEASON_KANJI = { spring: ['春', 'spring'], summer: ['夏', 'summer'], autumn: ['秋', 'autumn'], winter: ['冬', 'winter'] };
const LEVEL_NOTES = { 5: 'Beginner', 4: 'Elementary', 3: 'Intermediate', 2: 'Upper intermediate', 1: 'Advanced' };

let banner = null;
let naps = [];

function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return ['おはよう', 'Good morning'];
  if (h >= 11 && h < 18) return ['こんにちは', 'Good afternoon'];
  return ['こんばんは', 'Good evening'];
}

// Progress through each JLPT level of a deck. Everyday words count with N5.
export function levelProgress(script) {
  const start = app.state.settings.startLevel;
  return LEVELS.map(lv => {
    const words = app.decks[script].filter(w => (w.jlpt || 5) === lv);
    const met = words.filter(w => isMet(app.state.cards[w.key])).length;
    return { lv, total: words.length, met, skipped: lv > start };
  });
}

function deckCard(script) {
  const d = DECKS[script];
  const p = plan(script);
  const track = levelProgress(script);
  const current = track.find(t => !t.skipped && t.met < t.total) || track[track.length - 1];
  const today = todayString();
  let nextDue = '';
  for (const w of app.decks[script]) {
    const st = app.state.cards[w.key];
    if (isMet(st) && !st.sus && st.due > today && (!nextDue || st.due < nextDue)) nextDue = st.due;
  }
  const dueThen = nextDue ? app.decks[script].filter(w => { const st = app.state.cards[w.key]; return st && !st.sus && st.due === nextDue; }).length : 0;
  const gap = nextDue ? daysBetween(today, nextDue) : 0;

  let body;
  if (p.total === 0) {
    body = `<div class="deck-done"><div class="nap" data-nap></div><div><b>Done for today</b><span class="muted">${nextDue ? `${dueThen} ${dueThen === 1 ? 'word' : 'words'} due ${gap === 1 ? 'tomorrow' : `in ${gap} days`}` : 'Nothing due yet'}</span></div></div>
      ${p.unseen.length ? `<div class="deck-actions"><button type="button" class="btn" data-act="more" data-d="${script}">Learn 5 more words</button></div>` : ''}`;
  } else {
    const mins = Math.max(2, Math.round((p.learning.length * 10 + p.review.length * 9 + p.fresh.length * 14) / 60));
    body = `<div class="deck-counts">
        <span><b class="c-new">${p.fresh.length}</b>new</span>
        <span><b class="c-learn">${p.learning.length}</b>learning</span>
        <span><b class="c-rev">${p.review.length}</b>to review</span>
      </div>
      <div class="deck-actions"><button type="button" class="btn primary" data-act="start" data-d="${script}">Start ${d.en.toLowerCase()} · about ${mins} min</button></div>`;
  }
  const steps = track.map(t => {
    const pct = t.total ? Math.round(t.met / t.total * 100) : 0;
    const cls = t.skipped ? 'skipped' : t === current ? 'current' : t.met >= t.total ? 'complete' : '';
    return `<span class="lv ${cls}" title="N${t.lv}: ${t.met} of ${t.total} met${t.skipped ? ' (skipped)' : ''}"><i style="width:${pct}%"></i><b>N${t.lv}</b></span>`;
  }).join('');
  return `<article class="deck">
    <div class="deck-title"><span class="deck-jp" lang="ja">${d.ja}</span><span class="deck-en">${d.en} words</span></div>
    ${body}
    <div class="track" aria-label="Progress by JLPT level">${steps}</div>
    <p class="deck-meta">Now on <b>N${current.lv}</b>: ${current.met} of ${current.total} words met</p>
  </article>`;
}

function introCard() {
  if (app.state.settings.seenIntro) return '';
  const start = app.state.settings.startLevel;
  const levels = LEVELS.map(lv => `<label><input type="radio" name="introLevel" value="${lv}" ${lv === start ? 'checked' : ''}><span><b>N${lv}</b><small>${LEVEL_NOTES[lv]}</small></span></label>`).join('');
  return `<section class="intro" aria-labelledby="introTitle">
    <h2 id="introTitle">How it works</h2>
    <ol>
      <li><b>Read</b> the word and type how it sounds in rōmaji.</li>
      <li><b>Check</b> the reading, hear it, and learn what it means.</li>
      <li><b>Grade</b> yourself. Words you know come back less and less often.</li>
    </ol>
    <p class="intro-q">Where should new words start? Pick the JLPT level that matches your vocabulary. You can change it any time in Settings.</p>
    <div class="levels-pick">${levels}</div>
    <button type="button" class="btn primary" data-act="intro-done">Got it</button>
  </section>`;
}

function backupNote() {
  const s = app.state.settings;
  const met = Object.values(app.state.cards).filter(isMet).length;
  if (met < 30) return '';
  const days = s.lastExport ? daysBetween(s.lastExport, todayString()) : Infinity;
  if (days < 30) return '';
  return `<p class="nudge">${s.lastExport ? `Your last backup was ${days} days ago.` : "You haven't backed up your progress yet."} It only lives on this device. <button type="button" class="link-inline" data-act="backup">Back up now</button></p>`;
}

// A summary of progress under the decks; the Progress tab has the full picture.
function progressSummary() {
  const n = streak(app.state.days);
  return `<section class="section today-progress" aria-label="Your progress">
    <div class="two-col">
      <div>
        <h2 class="section-title">Streak</h2>
        <p class="streak-num">${n}<small>${n === 1 ? 'day' : 'days'} in a row</small></p>
        <div class="heat" role="img" aria-label="Practice over the last 15 weeks">${heatmapHTML()}</div>
        <p class="cap">Last 15 weeks. Darker squares mean more words reviewed.</p>
      </div>
      <div>
        <h2 class="section-title">Coming up</h2>
        <div class="forecast">${forecastHTML()}</div>
        <p class="cap"><i class="key key-h"></i>Hiragana <i class="key key-k"></i>Katakana · words due each day</p>
      </div>
    </div>
    <h2 class="section-title misread-title">Characters you misread</h2>
    <div class="trouble">${troubleHTML(6)}</div>
    <p class="see-all"><button type="button" class="link-inline" data-act="progress">See all progress, by JLPT level and the kana chart</button></p>
  </section>`;
}

function render() {
  const [ja, en] = greeting();
  const [sk, sen] = SEASON_KANJI[currentSeason()];
  const n = streak(app.state.days);
  $('greeting').innerHTML = `<span class="hello"><span lang="ja">${ja}</span>${en}</span>
    <span class="season" title="${sen}"><span lang="ja">${sk}</span></span>
    ${n ? `<span class="pill">${n} ${n === 1 ? 'day' : 'days'} in a row</span>` : ''}`;
  if (!banner) banner = mountScene($('banner'), 'banner');
  naps.forEach(s => s.destroy());
  naps = [];
  const loaded = app.decks.h.length || app.decks.k.length;
  $('todayBody').innerHTML = introCard() + (loaded ? `<div class="decks">${deckCard('h')}${deckCard('k')}</div>` : '<p class="muted">Loading words…</p>') + backupNote() + (loaded ? progressSummary() : '');
  document.querySelectorAll('#todayBody [data-nap]').forEach(el => naps.push(mountScene(el, 'nap')));
}

$('todayBody').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'start' || act === 'more') startDeck(b.dataset.d, act === 'more' ? 'more' : 'daily');
  if (act === 'intro-done') {
    const picked = document.querySelector('input[name="introLevel"]:checked');
    if (picked) app.state.settings.startLevel = Number(picked.value);
    app.state.settings.seenIntro = true;
    commit();
    render();
  }
  if (act === 'backup') go('settings');
  if (act === 'progress') go('progress');
});

registerView('today', render);
export const renderToday = render;
