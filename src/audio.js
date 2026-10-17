// Speaking words aloud with the device's own Japanese voice (Web Speech API). Works offline.
//
// Browsers have a few known quirks this works around:
// - Chrome can drop a word that's started right after stopping the previous one, so after a stop
//   we wait a moment before speaking.
// - Chrome on macOS can get stuck "paused"; we resume before speaking.
// - Chrome can garbage-collect an utterance mid-sentence unless something keeps a reference to it.
// - Voice objects can be replaced when the voice list reloads, so we look the voice up by name each time.

const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
let voiceName = '';
let current = null;
const listeners = new Set();

const japaneseVoices = () => (synth ? synth.getVoices().filter(v => /^ja([-_]|$)/i.test(v.lang)) : []);

// Prefer high-quality voices: enhanced/premium ones, then well-known Japanese voices, then on-device ones.
function chooseVoice() {
  const score = v =>
    (/premium|enhanced|natural|neural/i.test(v.name) ? 4 : 0) +
    (/kyoko|otoya|o-ren|hattori|nanami|keita|ayumi|haruka|google/i.test(v.name) ? 2 : 0) +
    (v.localService ? 1 : 0);
  const best = japaneseVoices().sort((a, b) => score(b) - score(a))[0];
  voiceName = best ? best.name : '';
  listeners.forEach(fn => fn());
}
const currentVoice = () => japaneseVoices().find(v => v.name === voiceName) || japaneseVoices()[0] || null;

if (synth) {
  chooseVoice();
  if (synth.addEventListener) synth.addEventListener('voiceschanged', chooseVoice);
  else synth.onvoiceschanged = chooseVoice;
}

export const speechSupported = () => !!synth;
export const hasVoice = () => !!currentVoice();
export const getVoiceName = () => (currentVoice() ? currentVoice().name : '');
export function onVoicesChanged(fn) { listeners.add(fn); }

/**
 * Speak kana (not kanji, which can have several readings).
 * Returns false if there's no Japanese voice. `onFail(reason)` runs if the browser refuses or stays silent.
 */
export function speak(text, { onFail } = {}) {
  const voice = currentVoice();
  if (!synth || !voice) return false;
  const say = () => {
    const u = new SpeechSynthesisUtterance(text.replace(/\s+/g, ''));
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.9;
    let started = false;
    u.onstart = () => { started = true; };
    u.onerror = e => {
      if (e.error !== 'interrupted' && e.error !== 'canceled' && onFail) onFail(e.error || 'error');
    };
    u.onend = () => { if (current === u) current = null; };
    current = u;
    if (synth.paused) synth.resume();
    synth.speak(u);
    setTimeout(() => {
      if (!started && current === u && onFail) onFail('silent');
    }, 3000);
  };
  if (synth.speaking || synth.pending) {
    synth.cancel();
    setTimeout(say, 80);
  } else {
    say();
  }
  return true;
}
