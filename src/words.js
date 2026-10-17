// The word list: every word with its reading, meaning, level and schedule. Tap a word for details.
import { app, $, esc, commit, registerView } from './app.js';
import { DECKS, levelLabel } from './decks.js';
import { matcher, normalizeInput } from './romaji.js';
import { todayString, daysBetween, formatInterval, isMet, MATURE_DAYS } from './srs.js';
import { speak, hasVoice } from './audio.js';
import { icon } from './icons.js';

const PAGE = 150;
const view = { deck: 'h', status: 'met', level: 'all', q: '', limit: PAGE, open: '' };

function status(st) {
  if (st && st.sus) return '<span class="muted">suspended</span>';
  if (!isMet(st)) return '<span class="muted">not yet</span>';
  if (st.s === 'l') return '<span class="c-learn">learning</span>';
  const d = daysBetween(todayString(), st.due || todayString());
  if (d <= 0) return '<span class="c-rev">due today</span>';
  return `<span${st.ivl >= MATURE_DAYS ? ' class="c-rev"' : ''}>in ${formatInterval(d)}</span>`;
}

function details(w) {
  const st = app.state.cards[w.key];
  const met = isMet(st);
  const facts = [
    `<span><b>${levelLabel(w.jlpt)}</b> level</span>`,
    met ? `<span><b>${st.reps}</b> reviews</span>` : '',
    met ? `<span><b>${st.lapses || 0}</b> times forgotten</span>` : '',
    met && st.s === 'r' ? `<span>next <b>${st.due}</b></span>` : '',
  ].filter(Boolean).join('');
  return `<tr class="detail"><td colspan="4">
    <div class="detail-box">
      <p class="detail-word"><span lang="ja">${esc(w.kana)}</span>${w.kanji ? `<span class="wkj" lang="ja">${esc(w.kanji)}</span>` : ''}</p>
      <p>${esc(w.meaning)}</p>
      <p class="facts">${facts}</p>
      <div class="opts">
        ${hasVoice() ? `<button type="button" class="btn small" data-act="say">${icon('sound', 14)} Play</button>` : ''}
        <button type="button" class="btn small" data-act="suspend">${st && st.sus ? 'Unsuspend' : 'Suspend'}</button>
        ${met ? '<button type="button" class="btn small" data-act="forget">Reset to new</button>' : ''}
      </div>
      <p class="muted small-note">${st && st.sus ? "Suspended words don't come up in practice." : 'Suspend a word to stop practising it, for example names you don’t need.'}</p>
    </div>
  </td></tr>`;
}

function render() {
  const words = app.decks[view.deck];
  const q = view.q.trim().toLowerCase();
  const nq = normalizeInput(q);
  const rows = words.filter(w => {
    const st = app.state.cards[w.key];
    if (view.status === 'met' && (!isMet(st) || st.sus)) return false;
    if (view.status === 'suspended' && !(st && st.sus)) return false;
    if (view.level !== 'all' && String(w.jlpt || 0) !== view.level) return false;
    if (!q) return true;
    const r = matcher(w).romaji;
    return w.kana.includes(q) || w.kanji.includes(q) || r.toLowerCase().includes(q) || (nq && normalizeInput(r).includes(nq)) || w.meaning.toLowerCase().includes(q);
  });
  const met = words.filter(w => isMet(app.state.cards[w.key])).length;
  $('wlSummary').textContent = `${met} of ${words.length} ${DECKS[view.deck].en.toLowerCase()} words met · showing ${Math.min(rows.length, view.limit)} of ${rows.length}`
    + (view.status === 'met' && !met ? '. Start a practice to meet your first words, or switch to All to browse.' : '');
  $('wlBody').innerHTML = rows.slice(0, view.limit).map(w => {
    const st = app.state.cards[w.key];
    const open = view.open === w.key;
    const kanji = app.state.settings.kanji && w.kanji ? `<span class="wkj" lang="ja">${esc(w.kanji)}</span>` : '';
    return `<tr class="${isMet(st) ? '' : 'unseen'}${open ? ' open' : ''}" data-key="${esc(w.key)}">
      <td class="wk"><button type="button" class="row-btn" aria-expanded="${open}" lang="ja">${esc(w.kana)}</button></td>
      <td class="wr">${esc(matcher(w).romaji)}</td>
      <td class="wm">${esc(w.meaning)}${kanji}<span class="lvtag">${levelLabel(w.jlpt)}</span></td>
      <td class="ws">${status(st)}</td>
    </tr>${open ? details(w) : ''}`;
  }).join('') || '<tr><td colspan="4" class="muted">No words match.</td></tr>';
  $('wlMore').hidden = rows.length <= view.limit;
}

$('wlTools').addEventListener('change', e => {
  const t = e.target;
  if (t.name === 'wlDeck') { view.deck = t.value; view.open = ''; }
  if (t.name === 'wlStatus') view.status = t.value;
  if (t.id === 'wlLevel') view.level = t.value;
  view.limit = PAGE;
  render();
});
$('wlSearch').addEventListener('input', e => { view.q = e.target.value; view.limit = PAGE; render(); });
$('wlMore').addEventListener('click', () => { view.limit += PAGE; render(); });
$('wlBody').addEventListener('click', e => {
  const row = e.target.closest('tr[data-key]');
  const detail = e.target.closest('tr.detail');
  if (row && !detail) { view.open = view.open === row.dataset.key ? '' : row.dataset.key; render(); return; }
  const b = e.target.closest('[data-act]');
  if (!b || !view.open) return;
  const w = app.byKey.get(view.open);
  const st = app.state.cards[w.key];
  if (b.dataset.act === 'say') speak(w.kana);
  if (b.dataset.act === 'suspend') {
    app.state.cards[w.key] = { ...(st || { s: 'n' }), sus: !(st && st.sus), mod: Date.now() };
    commit();
    render();
  }
  if (b.dataset.act === 'forget' && confirm(`Reset ${w.kana} to a new word? Its review history is cleared.`)) {
    app.state.cards[w.key] = { s: 'n', mod: Date.now(), ...(st && st.sus ? { sus: true } : {}) };
    commit();
    render();
  }
});

registerView('words', render);
