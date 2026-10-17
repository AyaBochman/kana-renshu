// Settings: level, daily new words, sound, display, and backing up progress.
import { app, $, commit, applyTheme, isTouch, registerView, APP_VERSION } from './app.js';
import { exportFile, parseImport, mergeStates, freshState } from './storage.js';
import { todayString, daysBetween, isMet } from './srs.js';
import { speak, hasVoice, getVoiceName, speechSupported, onVoicesChanged } from './audio.js';

const form = $('settingsForm');
let pendingImport = null;

function voiceStatus() {
  const el = $('voiceStatus');
  if (!speechSupported()) { el.textContent = "This browser can't speak words aloud."; $('testVoice').hidden = true; return; }
  if (!hasVoice()) {
    el.innerHTML = 'No Japanese voice on this device yet. To add one: <b>iPhone/iPad</b> Settings → Accessibility → Spoken Content → Voices → Japanese. <b>Android</b> Settings → Text-to-speech → install Japanese. <b>Mac</b> System Settings → Accessibility → Spoken Content → System voice → Manage voices.';
    $('testVoice').hidden = true;
    return;
  }
  el.textContent = `Voice: ${getVoiceName()}.`;
  $('testVoice').hidden = false;
}
onVoicesChanged(() => { if (app.view === 'settings') voiceStatus(); });

function backupStatus() {
  const s = app.state.settings;
  const met = Object.values(app.state.cards).filter(isMet).length;
  $('backupStatus').textContent = s.lastExport
    ? `Last backup: ${s.lastExport} (${daysBetween(s.lastExport, todayString())} days ago). ${met} words on this device.`
    : `No backup yet. ${met} words on this device.`;
}

function render() {
  const s = app.state.settings;
  form.elements.startLevel.value = String(s.startLevel);
  form.elements.newPerDay.value = String(s.newPerDay);
  form.elements.audio.checked = !!s.audio;
  form.elements.fonts.checked = !!s.fonts;
  form.elements.kanji.checked = !!s.kanji;
  form.elements.theme.value = s.theme || 'system';
  voiceStatus();
  backupStatus();
  $('importChoice').hidden = !pendingImport;
  $('appVersion').textContent = APP_VERSION;
}

form.addEventListener('change', () => {
  const s = app.state.settings;
  s.startLevel = Number(form.elements.startLevel.value) || 5;
  s.newPerDay = Number(form.elements.newPerDay.value) || 10;
  s.audio = form.elements.audio.checked;
  s.fonts = form.elements.fonts.checked;
  s.kanji = form.elements.kanji.checked;
  const themeChanged = s.theme !== form.elements.theme.value;
  s.theme = form.elements.theme.value || 'system';
  commit();
  if (themeChanged) applyTheme();
});
form.addEventListener('submit', e => e.preventDefault());
$('testVoice').addEventListener('click', () => {
  voiceStatus();
  speak('こんにちは', {
    onFail: reason => {
      $('voiceStatus').textContent = reason === 'not-allowed'
        ? 'The browser blocked the sound. Try the button again.'
        : `No sound played with ${getVoiceName()}. Check that your volume is on. On a Mac, also check System Settings → Accessibility → Spoken Content, and that the Japanese voice is downloaded.`;
    },
  });
});

/* ---------- backup ---------- */
function message(text, isError = false) {
  const el = $('dataMsg');
  el.textContent = text;
  el.className = 'data-msg' + (isError ? ' err' : '');
}

$('exportBtn').addEventListener('click', async () => {
  const today = todayString();
  app.state.settings.lastExport = today;
  const { filename, blob } = exportFile(app.state, today);
  const file = new File([blob], filename, { type: 'application/json' });
  let done = false;
  if (isTouch() && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Kana Renshū progress' });
      done = true;
    } catch (e) {
      if (e && e.name === 'AbortError') { app.state.settings.lastExport = ''; return; }
    }
  }
  if (!done) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  commit();
  backupStatus();
  message(`Saved ${filename}.`);
});

$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    pendingImport = parseImport(await file.text());
    const words = Object.values(pendingImport.cards).filter(isMet).length;
    const last = Object.keys(pendingImport.days).sort().pop();
    $('importSummary').textContent = `This file has ${words} words${last ? `, last practised ${last}` : ''}.`;
    $('importChoice').hidden = false;
    message('');
  } catch (err) {
    pendingImport = null;
    $('importChoice').hidden = true;
    message(err.message, true);
  }
});
$('importChoice').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || !pendingImport) return;
  if (b.dataset.act === 'merge') {
    app.state = mergeStates(app.state, pendingImport);
    message('Merged. Each word kept whichever copy was practised most recently.');
  } else if (b.dataset.act === 'replace') {
    const settings = app.state.settings;
    app.state = pendingImport;
    app.state.settings = { ...pendingImport.settings, theme: settings.theme };
    message("Replaced this device's progress with the file.");
  } else {
    message('Import cancelled.');
  }
  pendingImport = null;
  commit();
  applyTheme();
  render();
});

$('resetBtn').addEventListener('click', () => {
  if (!confirm('Delete all progress on this device? Your settings stay. Export first if you want a backup.')) return;
  const settings = app.state.settings;
  app.state = freshState();
  app.state.settings = { ...settings, lastExport: '' };
  commit();
  render();
  message('Progress reset.');
});

registerView('settings', render);
