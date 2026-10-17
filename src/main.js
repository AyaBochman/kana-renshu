// Start-up: load the decks, wire up navigation and the keyboard, and keep the app fresh and offline-ready.
import { app, $, esc, go, refresh, applyTheme } from './app.js';
import { loadDecks } from './decks.js';
import { load, STORAGE_KEY } from './storage.js';
import { UNIT } from './kana.js';
import { rebuildScenes } from './scenes.js';
import { icon } from './icons.js';
import { inSession, handleSessionKey } from './session.js';
import { renderToday } from './today.js';
import './words.js';
import './progress.js';
import './settings.js';

// Navigation: pixel icons, and the tab buttons.
document.querySelectorAll('#tabs [data-view]').forEach(b => {
  b.insertAdjacentHTML('afterbegin', icon(b.dataset.icon, 20));
  b.addEventListener('click', () => go(b.dataset.view));
});
$('undoBtn').insertAdjacentHTML('afterbegin', icon('undo', 14));
$('playBtn').insertAdjacentHTML('afterbegin', icon('sound', 18));

document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (app.view === 'session') {
    if (handleSessionKey(e)) e.preventDefault();
    return;
  }
  const active = document.activeElement;
  if (app.view === 'today' && e.key === 'Enter' && (!active || active === document.body)) {
    const start = document.querySelector('#todayBody [data-act="start"]');
    if (start) { e.preventDefault(); start.click(); }
  }
});

// Another tab changed the progress, or the app came back after a while (maybe a new day).
window.addEventListener('storage', e => {
  if (e.key === STORAGE_KEY && !inSession()) { app.state = load(); applyTheme(); refresh(); }
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !inSession()) refresh();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => rebuildScenes());

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  let updateRequested = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updateRequested) location.reload(); });
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = worker => {
      if (!worker || !navigator.serviceWorker.controller) return;
      $('updateToast').hidden = false;
      $('updateBtn').onclick = () => { updateRequested = true; worker.postMessage('skip-waiting'); };
    };
    offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (worker) worker.addEventListener('statechange', () => { if (worker.state === 'installed') offer(worker); });
    });
  }).catch(() => { /* offline support is optional */ });
}

async function start() {
  applyTheme();
  go('today', { scroll: false });
  try {
    app.decks = await loadDecks();
    for (const script of Object.keys(app.decks)) for (const w of app.decks[script]) app.byKey.set(w.key, w);
    renderToday();
  } catch (err) {
    $('todayBody').innerHTML = `<p class="load-error">The word lists didn't load (${esc(err.message)}). Check your connection and reload.</p>`;
  }
  if (document.fonts && document.fonts.load) {
    const sample = Object.keys(UNIT).join('') + 'ーっッ';
    ['600 40px "Klee One"', '500 40px "Zen Kaku Gothic New"', '500 40px "Shippori Mincho"', '500 40px "Zen Maru Gothic"']
      .forEach(f => document.fonts.load(f, sample).catch(() => {}));
  }
  registerServiceWorker();
}
start();
