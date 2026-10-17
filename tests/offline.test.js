// Every file the app loads has to be in the service worker's list, or the installed app breaks offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const sw = readFileSync(new URL('sw.js', root), 'utf8');
const listed = new Set([...sw.match(/const ASSETS = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]));

test('the service worker caches every app file', () => {
  const files = ['index.html', 'manifest.webmanifest'];
  for (const dir of ['src', 'data', 'icons', 'fonts']) {
    for (const f of readdirSync(new URL(dir, root))) {
      if (f.startsWith('.') || f.endsWith('.txt')) continue;
      files.push(`${dir}/${f}`);
    }
  }
  const missing = files.filter(f => !listed.has(f));
  assert.deepEqual(missing, [], 'add these to ASSETS in sw.js');
});

test('everything in the list exists', () => {
  for (const f of listed) {
    if (f === './') continue;
    assert.doesNotThrow(() => readFileSync(new URL(f, root)), f);
  }
});

test('the app and the service worker agree on the version', () => {
  const app = readFileSync(new URL('src/app.js', root), 'utf8').match(/APP_VERSION = '([^']+)'/)[1];
  const worker = sw.match(/VERSION = '([^']+)'/)[1];
  const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')).version;
  assert.equal(app, worker);
  assert.equal(pkg, worker);
});
