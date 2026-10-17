// The Progress screen: streak, what's coming up, progress per JLPT level, misread characters and the kana chart.
import { app, $, esc, registerView, squareHTML } from './app.js';
import { BASE_ROWS, DAKU_ROWS, YOON_ROWS, EXT_ROWS, UNIT } from './kana.js';
import { DECKS, LEVELS } from './decks.js';
import { streak, forecast, todayString, addDays, parseDay, isMet, MATURE_DAYS } from './srs.js';

export function heatmapHTML() {
  const today = todayString();
  const monday = (parseDay(today).getDay() + 6) % 7;
  const start = addDays(today, -(14 * 7 + monday));
  let cells = '';
  for (let i = 0; i < 105; i++) {
    const d = addDays(start, i);
    const n = app.state.days[d] ? app.state.days[d].n || 0 : 0;
    const cls = [n >= 40 ? 'l3' : n >= 15 ? 'l2' : n > 0 ? 'l1' : '', d === today ? 'today' : '', d > today ? 'future' : ''].join(' ').trim();
    cells += `<i class="${cls}" title="${d}: ${n} words"></i>`;
  }
  return cells;
}

export function forecastHTML() {
  const h = forecast(app.decks.h, app.state), k = forecast(app.decks.k, app.state);
  const max = Math.max(1, ...h.map((v, i) => v + k[i]));
  const today = todayString();
  return h.map((hv, i) => {
    const kv = k[i], total = hv + kv;
    const label = i === 0 ? 'Today' : i === 1 ? 'Tmrw' : parseDay(addDays(today, i)).toLocaleDateString(undefined, { weekday: 'short' });
    return `<div class="fc-col" title="${total} due: ${hv} hiragana, ${kv} katakana">
      <span class="fc-n">${total || ''}</span>
      <div class="fc-bar"><i class="fc-k" style="height:${kv / max * 100}%"></i><i class="fc-h" style="height:${hv / max * 100}%"></i></div>
      <span class="fc-d">${label}</span></div>`;
  }).join('');
}

// Words met and well known per JLPT level of a deck. Everyday words count with N5.
export function levelStats(script) {
  const start = app.state.settings.startLevel;
  return LEVELS.map(lv => {
    let total = 0, met = 0, known = 0;
    for (const w of app.decks[script]) {
      if ((w.jlpt || 5) !== lv) continue;
      total++;
      const st = app.state.cards[w.key];
      if (!isMet(st)) continue;
      met++;
      if (st.s === 'r' && st.ivl >= MATURE_DAYS) known++;
    }
    return { lv, total, met, known, skipped: lv > start };
  });
}

function levelsHTML() {
  return ['h', 'k'].map(script => {
    const rows = levelStats(script).map(({ lv, total, met, known, skipped }) => {
      const pct = x => (total ? x / total * 100 : 0).toFixed(1) + '%';
      return `<div class="lvl-row${skipped ? ' skipped' : ''}">
        <b>N${lv}</b>
        <div class="lvl-bar" role="img" aria-label="N${lv}: ${known} well known, ${met} met of ${total}"><i class="known" style="width:${pct(known)}"></i><i class="met" style="width:${pct(met - known)}"></i></div>
        <span>${met}/${total}</span></div>`;
    }).join('');
    return `<div class="lvl-deck"><h3><span lang="ja">${DECKS[script].ja}</span>${DECKS[script].en}</h3>${rows}</div>`;
  }).join('');
}

export function troubleHTML(limit = 8) {
  const rows = ['h', 'k'].map(script => {
    const list = Object.entries(app.state.kana[script]).filter(([, v]) => v.m > 0)
      .map(([k, v]) => ({ k, m: v.m, total: v.m + (v.o || 0), score: v.m / (v.m + (v.o || 0)) * Math.log(1 + v.m) }))
      .sort((a, b) => b.score - a.score).slice(0, limit);
    if (!list.length) return '';
    const label = k => (UNIT[k] ? UNIT[k][0] : k === 'っ' || k === 'ッ' ? 'small tsu' : '');
    return `<div><h3><span lang="ja">${DECKS[script].ja}</span>${DECKS[script].en}</h3><div class="trouble-row">${list.map(x =>
      `<figure>${squareHTML(x.k)}<figcaption>${label(x.k)} · ${x.m}/${x.total}</figcaption></figure>`).join('')}</div></div>`;
  }).join('');
  return rows || '<p class="muted">Nothing yet. When you misread a character inside a word, it shows up here with how often it happened.</p>';
}

const LEVEL_NAMES = ['Not read yet', 'Often misread', 'Learning', 'Good', 'Solid'];
function kanaLevel(script, kana) {
  const st = app.state.kana[script][kana];
  const total = st ? (st.o || 0) + (st.m || 0) : 0;
  if (!total) return 0;
  const acc = (st.o || 0) / total;
  if (st.m && acc < 0.75) return 1;
  if (total < 3 || acc < 0.9) return 2;
  if (total < 8) return 3;
  return 4;
}
function chartFor(script) {
  const col = script === 'h' ? 0 : 1;
  const block = (rows, cols, label, ext) => {
    let html = `<h4>${label}</h4><div class="cgrid c${cols}">`;
    rows.forEach(row => row.forEach(x => {
      if (!x) { html += '<span class="cell empty"></span>'; return; }
      const kana = ext ? x[0] : x[col];
      const romaji = (ext ? x[1] : x[2]).split('|')[0];
      const lv = kanaLevel(script, kana);
      html += `<button type="button" class="cell lv${lv}" title="${esc(LEVEL_NAMES[lv])}"><span class="k" lang="ja">${kana}</span><span class="r">${romaji}</span></button>`;
    }));
    return html + '</div>';
  };
  let out = block(BASE_ROWS, 5, 'Basic') + block(DAKU_ROWS, 5, 'Dakuten ゛゜') + block(YOON_ROWS, 3, 'Combinations');
  if (script === 'k') out += block(EXT_ROWS, 4, 'Extended', true);
  return out;
}

function render() {
  const n = streak(app.state.days);
  $('streakNum').innerHTML = `${n}<small>${n === 1 ? 'day' : 'days'} in a row</small>`;
  $('heat').innerHTML = heatmapHTML();
  $('forecast').innerHTML = forecastHTML();
  $('levels').innerHTML = levelsHTML();
  $('trouble').innerHTML = troubleHTML();
  $('chartH').innerHTML = chartFor('h');
  $('chartK').innerHTML = chartFor('k');
}

$('hideRoma').addEventListener('change', e => {
  $('chartCols').classList.toggle('hide-roma', e.target.checked);
  document.querySelectorAll('.cell.peek').forEach(c => c.classList.remove('peek'));
});
$('chartCols').addEventListener('click', e => {
  const c = e.target.closest('.cell:not(.empty)');
  if (!c || !$('chartCols').classList.contains('hide-roma')) return;
  c.classList.toggle('peek');
  c.setAttribute('aria-pressed', String(c.classList.contains('peek')));
});

registerView('progress', render);
