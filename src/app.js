// Shared app state, navigation between screens, and small drawing helpers used by several screens.
import { load, save } from './storage.js';
import { deckPlan } from './srs.js';
import { rebuildScenes } from './scenes.js';

// Keep in step with VERSION in sw.js (a test checks this).
export const APP_VERSION = '1.2.0';

export const app = {
  state: load(),
  decks: { h: [], k: [] },
  byKey: new Map(),
  view: 'today',
};

export function commit() {
  app.state.updatedAt = Date.now();
  save(app.state);
}
export const plan = script => deckPlan(script, app.decks[script], app.state);

export const $ = id => document.getElementById(id);
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const isTouch = () => matchMedia('(pointer: coarse)').matches;

/* ---------- navigation ---------- */
const VIEWS = ['today', 'session', 'words', 'progress', 'settings'];
const renderers = {};
export function registerView(name, render) { renderers[name] = render; }
export function go(name, { scroll = true } = {}) {
  app.view = name;
  for (const v of VIEWS) $(v).hidden = v !== name;
  document.body.classList.toggle('in-session', name === 'session');
  document.querySelectorAll('#tabs [data-view]').forEach(b => b.setAttribute('aria-current', String(b.dataset.view === name)));
  if (renderers[name]) renderers[name]();
  if (scroll) window.scrollTo({ top: 0 });
}
export const refresh = () => renderers[app.view] && renderers[app.view]();

/* ---------- theme ---------- */
const themeMetas = [...document.querySelectorAll('meta[name="theme-color"]')].map(m => [m, m.content]);
export function applyTheme() {
  const t = app.state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  themeMetas.forEach(([m, original]) => { m.content = t === 'light' ? '#f3f5f1' : t === 'dark' ? '#18241f' : original; });
  rebuildScenes();
}

/* ---------- kana squares and the teacher's red pen ---------- */
export const FONTS = [
  { ja: '教科書体', en: 'Textbook', css: 'var(--font-hand)', w: 600 },
  { ja: 'ゴシック', en: 'Gothic', css: 'var(--font-gothic)', w: 500 },
  { ja: '明朝', en: 'Mincho', css: 'var(--font-mincho)', w: 500 },
  { ja: '丸ゴシック', en: 'Rounded', css: 'var(--font-maru)', w: 500 },
];
export const pickFont = () => (app.state.settings.fonts ? FONTS[Math.floor(Math.random() * FONTS.length)] : FONTS[0]);

export function squareHTML(text, font = FONTS[0], extra = '') {
  return `<div class="sq" style="--glyph-font:${font.css};--glyph-weight:${font.w}"${extra}><span class="glyph${[...text].length > 1 ? ' two' : ''}" lang="ja">${text}</span><svg class="mark" viewBox="0 0 100 100" aria-hidden="true"></svg></div>`;
}
export function drawCross(svg) {
  svg.innerHTML = '<path pathLength="1" d="M22 21 C40 41 60 61 80 82"/><path pathLength="1" style="animation-delay:.16s" d="M79 19 C60 40 41 61 21 83"/>';
  svg.classList.remove('draw');
  void svg.getBoundingClientRect();
  svg.classList.add('draw');
}
// A red-pen ring around a whole word.
export function drawRing(row) {
  const w = row.offsetWidth, h = row.offsetHeight;
  const pw = w + 30, ph = h + 24, cx = pw / 2, cy = ph / 2, rx = pw / 2 - 3, ry = ph / 2 - 3;
  let d = '';
  const a0 = -Math.PI * 0.62, span = Math.PI * 2 + 0.5;
  for (let i = 0; i <= 72; i++) {
    const t = i / 72, a = a0 + span * t, k = 1 - 0.05 * t + 0.012 * Math.sin(a * 3);
    d += (i ? 'L' : 'M') + (cx + rx * k * Math.cos(a)).toFixed(1) + ' ' + (cy + ry * k * Math.sin(a)).toFixed(1);
  }
  row.insertAdjacentHTML('beforeend', `<svg class="ring draw" style="left:-15px;top:-12px;width:${pw}px;height:${ph}px" viewBox="0 0 ${pw} ${ph}" aria-hidden="true"><path pathLength="1" d="${d}"/></svg>`);
}
// The teacher's hanamaru: a spiral with petals around it.
export function hanamaruSVG(cls = '') {
  const cx = 60, cy = 60;
  let d = '';
  for (let i = 0; i <= 140; i++) {
    const t = i / 140 * Math.PI * 2 * 2.4, r = 2 + t * 2.25;
    d += (i ? 'L' : 'M') + (cx + r * Math.cos(t)).toFixed(1) + ' ' + (cy + r * Math.sin(t) * 0.94).toFixed(1);
  }
  const n = 9, R = 44, rr = (R * Math.sin(Math.PI / n) * 1.15).toFixed(1);
  let p = '';
  for (let k = 0; k <= n; k++) {
    const a = k / n * Math.PI * 2 - Math.PI / 2;
    const x = (cx + R * Math.cos(a)).toFixed(1), y = (cy + R * Math.sin(a)).toFixed(1);
    p += k ? ` A${rr} ${rr} 0 0 1 ${x} ${y}` : `M${x} ${y}`;
  }
  return `<svg class="hanamaru ${cls}" viewBox="0 0 120 120" aria-hidden="true"><path pathLength="1" d="${d}"/><path pathLength="1" style="animation-delay:.5s" d="${p}"/></svg>`;
}
