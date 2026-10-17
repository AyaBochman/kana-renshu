// Pixel-art scenes: small canvases drawn pixel by pixel and scaled up with crisp edges.
// They follow the season (spring sakura, summer fireflies, autumn maples, winter snow) and the
// theme (daytime for the notebook theme, night for the blackboard theme).
//
// Each scene has a static layer, drawn once per size/theme, and a few animated things on top,
// redrawn about 12 times a second while the scene is on screen.

const FPS = 12;
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const NIGHT_INK = '#0d1714';

/* ---------- colour and randomness ---------- */
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mix = (a, b, t) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
function random(seed) {
  return () => {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function currentSeason(date = new Date()) {
  const forced = new URLSearchParams(location.search).get('season');
  if (['spring', 'summer', 'autumn', 'winter'].includes(forced)) return forced;
  const m = date.getMonth();
  return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
}
export function isNight() {
  const t = document.documentElement.dataset.theme;
  return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
}

/* ---------- palettes ---------- */
const BASE = {
  day: {
    sky: ['#d3e3de', '#e5eee6', '#f5ecdb'], sun: '#f4cf97', halo: '#f1e3c6',
    cloud: '#fbfcf8', cloudShade: '#e1eae5',
    far: '#bccdc8', farShade: '#aabdb7', snow: '#fbfcfa', snowShade: '#dce5e2',
    ground: '#d9d2c0', groundDark: '#c7bea8', groundLight: '#e8e2d3', path: '#ece6d8', pathShade: '#cbc2ad',
    wood: '#b5483b', woodDark: '#8a3429', roof: '#3b3431', roofLight: '#5b524c', spire: '#c9a24a', window: '#4a3f3a',
    torii: '#cc3a2c', toriiDark: '#2b2421',
    stone: '#aaa69b', stoneDark: '#8b887e', stoneLight: '#c6c2b7', lanternLight: '#e8d7b0',
    trunk: '#5b4135', trunkDark: '#41302a',
    cat: '#2b2522', catEye: '#e9c349', catNose: '#2b2522',
    bird: '#fbfcf8', birdDark: '#2b2421', birdRed: '#cc3a2c',
    sand: '#ebe5d6', sandLine: '#d8cfba',
    rock: '#8f8b82', rockLight: '#b1ada3', rockDark: '#6c6961', moss: '#7f9b5b',
    water: '#8fb9b2', waterDark: '#76a69f', waterLight: '#d3ebe5', koi: '#e8793a', koiWhite: '#fbf6ee',
    bamboo: '#8aa653', bambooDark: '#667d3b', bambooLight: '#a9c36f',
    wall: '#e3cb92', wallLine: '#f7f0de', wallShade: '#cdb37b', tile: '#3b3431', tileLight: '#5b524c',
  },
  night: {
    sky: ['#0d1714', '#13211c', '#1c2d27'], moon: '#efe6c8', moonShade: '#d4c9a6', halo: '#22332d',
    cloud: '#21302a', cloudShade: '#1b2823', star: '#e7eee6', starDim: '#6b7e75',
    far: '#1e2d28', farShade: '#192622', snow: '#b8c5c0', snowShade: '#8e9f99',
    ground: '#24302b', groundDark: '#1d2824', groundLight: '#2d3b35', path: '#33413b', pathShade: '#212c28',
    wood: '#6b2b25', woodDark: '#4c1f1b', roof: '#121816', roofLight: '#232c29', spire: '#8a7140', window: '#f2c46d',
    torii: '#8c2e26', toriiDark: '#0f1412',
    stone: '#59605b', stoneDark: '#434944', stoneLight: '#6e756f', lanternLight: '#ffd27a',
    trunk: '#2a211c', trunkDark: '#1d1714',
    cat: '#0b0f0d', catEye: '#ffd54a', catNose: '#0b0f0d',
    bird: '#cfd8d3', birdDark: '#0f1412', birdRed: '#8c2e26',
    sand: '#2c3833', sandLine: '#25302b',
    rock: '#4b524d', rockLight: '#606862', rockDark: '#353b37', moss: '#3d5133',
    water: '#1e3a39', waterDark: '#183130', waterLight: '#4c7471', koi: '#c8652f', koiWhite: '#d9d4c9',
    bamboo: '#4f6531', bambooDark: '#3a4b24', bambooLight: '#62793d',
    wall: '#4e4632', wallLine: '#665e46', wallShade: '#423b2a', tile: '#121816', tileLight: '#232c29',
  },
};

// canopy: [base, shade, light, accent]
const SEASONS = {
  spring: { canopy: ['#f2bccb', '#df98ad', '#fde6ec', '#ffffff'], hills: ['#c4d7b1', '#b0c99b', '#efc6d0'], grass: '#a9c48a', fall: ['#f7c9d4', '#fbe3e9', '#eda9ba'], kind: 'petal' },
  summer: { canopy: ['#6c9f5f', '#4f7f47', '#93c27f', '#b9d98f'], hills: ['#9cc08f', '#86ad7b', '#b3cfa1'], grass: '#86b26f', fall: [], kind: 'firefly' },
  autumn: { canopy: ['#d6582f', '#a93a24', '#ef9a43', '#f5c35d'], hills: ['#d9a46b', '#c97b4a', '#b7c49b'], grass: '#c4a86a', fall: ['#d6582f', '#ef9a43', '#b33a24', '#f5c35d'], kind: 'leaf' },
  winter: { canopy: ['#f7faf9', '#dbe4e1', '#ffffff', '#cdd9d5'], hills: ['#e4ebe8', '#d2dcd8', '#eff4f2'], grass: '#eef3f1', fall: ['#ffffff', '#eef3f1'], kind: 'snow' },
};

function palette(season, night) {
  const C = { ...BASE[night ? 'night' : 'day'] };
  const S = SEASONS[season];
  const dim = c => (night ? mix(c, NIGHT_INK, 0.58) : c);
  C.canopy = S.canopy.map(dim);
  C.hills = S.hills.map(dim);
  C.grass = dim(S.grass);
  C.fall = S.fall.map(c => (night ? mix(c, NIGHT_INK, 0.35) : c));
  if (season === 'winter') {
    Object.assign(C, { ground: dim('#edf2f0'), groundDark: dim('#dbe4e0'), groundLight: dim('#fafcfb'), path: dim('#f6f9f8'), pathShade: dim('#d5dfdb'), sand: dim('#eef3f1'), sandLine: dim('#dce5e1') });
  }
  return C;
}

/* ---------- drawing primitives ---------- */
function rect(g, x, y, w, h, c) {
  if (!c || w <= 0 || h <= 0) return;
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
const dot = (g, x, y, c) => rect(g, x, y, 1, 1, c);
const dither = (x, y, t) => t > (BAYER[((y % 4) + 4) % 4][((x % 4) + 4) % 4] + 0.5) / 16;

function gradient(g, x0, y0, w, h, stops) {
  for (let y = 0; y < h; y++) {
    const t = (y / Math.max(1, h - 1)) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(t));
    for (let x = 0; x < w; x++) dot(g, x0 + x, y0 + y, dither(x, y, t - i) ? stops[i + 1] : stops[i]);
  }
}
function line(g, x0, y0, x1, y1, c, thick = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    rect(g, x0, y0, thick, thick, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function sprite(g, rows, x, y, colors, flip = false) {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = colors[row[i]];
      if (c) dot(g, x + (flip ? row.length - 1 - i : i), y + j, c);
    }
  });
}
// A leafy cluster: lit from the top left, shaded bottom right, with a few accent specks.
function blob(g, cx, cy, r, [base, shade, light, accent], rnd) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (Math.sqrt(x * x + y * y * 1.2) + (rnd() - 0.5) * 1.6 > r) continue;
      const lit = (-x - y) / (r * 2) + 0.5;
      let c = base;
      if (lit > 0.7 && dither(cx + x, cy + y, (lit - 0.7) * 3)) c = light;
      else if (lit < 0.38 && dither(cx + x, cy + y, (0.38 - lit) * 3)) c = shade;
      if (rnd() < 0.04) c = accent;
      dot(g, cx + x, cy + y, c);
    }
  }
}
function ellipse(g, cx, cy, rx, ry, c) {
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.01))));
    rect(g, cx - w, cy + y, w * 2 + 1, 1, c);
  }
}

/* ---------- sprites ---------- */
const CAT = [
  ['k...k..', 'kk.kk..', 'kkkkk..', 'kekek.k', 'kkkkk.k', '.kkk..k', '.kkkkk.', '.k.k...'],
  ['k...k..', 'kk.kk..', 'kkkkk..', 'kekek..', 'kkkkk..', '.kkk.kk', '.kkkkk.', '.k.k...'],
];
const CAT_SLEEP = ['.k.k.........', '.kkkk........', 'kgkkgkkkkkk..', 'kkkkkkkkkkkk.', '.kkkkkkkkkkkk', '..kkkkkkkkkk.'];
const ZZ = ['zzz', '.z.', 'zzz'];
const CLOUDS = [
  ['....####......', '..########.##.', '.############.', '##############', '.====########.'],
  ['...###...', '.#######.', '#########', '.=======.'],
];
const BIRD = [
  ['w.......w', '.w.....w.', '..wwrww..', '....d....'],
  ['....d....', '..wwrww..', '.w.....w.', 'w.......w'],
];

/* ---------- landscape pieces ---------- */
function fuji(g, cx, base, half, height, C, season) {
  const snowFrac = season === 'winter' ? 0.4 : season === 'summer' ? 0.8 : 0.6;
  for (let dx = -half; dx <= half; dx++) {
    const u = Math.abs(dx) / half;
    let h = Math.round(height * Math.pow(1 - u, 1.45));
    if (Math.abs(dx) <= 2) h = height - (Math.abs(dx) === 2 ? 1 : 0);
    const x = cx + dx;
    const snowLine = height * snowFrac + [0, 2, 1, 3, 1, 2][Math.abs(dx) % 6] - 1;
    for (let k = 0; k < h; k++) {
      const y = base - k;
      const shade = dx > 0 && dither(x, y, Math.min(1, dx / half + 0.4));
      dot(g, x, y, k >= snowLine ? (shade ? C.snowShade : C.snow) : (shade ? C.farShade : C.far));
    }
  }
}
function ridge(g, W, base, C, rnd) {
  for (let x = 0; x < W; x++) {
    const h = Math.round(4 + 2.2 * Math.sin(x * 0.11 + 1.3) + 1.4 * Math.sin(x * 0.29 + 0.4) + 0.8 * Math.sin(x * 0.73)) + (x % 5 === 2 ? 1 : 0);
    for (let k = 0; k < h + 4; k++) {
      const y = base - h + k;
      let c = C.hills[0];
      if (k < 2 && dither(x, y, 0.5)) c = C.hills[2];
      else if (rnd() < 0.2) c = C.hills[1];
      dot(g, x, y, c);
    }
  }
}
function ground(g, W, top, H, C, rnd) {
  for (let y = top; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = rnd();
      let c = C.ground;
      if (y === top || (y === top + 1 && r < 0.5)) c = C.grass;
      else if (r < 0.08) c = C.groundDark;
      else if (r < 0.13) c = C.groundLight;
      dot(g, x, y, c);
    }
  }
}
function pagoda(g, cx, gy, C, season) {
  rect(g, cx - 8, gy - 2, 17, 2, C.stoneDark);
  rect(g, cx - 7, gy - 3, 15, 1, C.stone);
  let y = gy - 3;
  for (const [bw, bh] of [[11, 6], [9, 5], [7, 5]]) {
    const x0 = cx - (bw >> 1);
    rect(g, x0, y - bh, bw, bh, C.wood);
    rect(g, x0, y - bh, 1, bh, C.woodDark);
    rect(g, x0 + bw - 1, y - bh, 1, bh, C.woodDark);
    rect(g, x0, y - 2, bw, 1, C.woodDark);
    rect(g, cx - 1, y - bh + 1, 3, bh - 3, C.window);
    y -= bh;
    const rw = bw + 8, rx = cx - (rw >> 1);
    rect(g, rx, y - 1, rw, 1, C.roof);
    dot(g, rx - 1, y - 2, C.roof);
    dot(g, rx + rw, y - 2, C.roof);
    rect(g, rx + 1, y - 2, rw - 2, 1, C.roofLight);
    rect(g, rx + 3, y - 3, rw - 6, 1, C.roof);
    if (season === 'winter') { rect(g, rx + 1, y - 3, rw - 2, 1, C.snow); rect(g, rx + 3, y - 4, rw - 6, 1, C.snow); }
    y -= 3;
  }
  rect(g, cx, y - 8, 1, 8, C.spire);
  for (const k of [2, 4, 6]) rect(g, cx - 1, y - k, 3, 1, C.spire);
  dot(g, cx, y - 9, C.spire);
}
function torii(g, cx, gy, C, season) {
  const h = 15;
  rect(g, cx - 6, gy - h, 2, h, C.torii);
  rect(g, cx + 5, gy - h, 2, h, C.torii);
  rect(g, cx - 6, gy - 1, 2, 1, C.toriiDark);
  rect(g, cx + 5, gy - 1, 2, 1, C.toriiDark);
  rect(g, cx - 9, gy - h - 2, 19, 1, C.toriiDark);
  dot(g, cx - 10, gy - h - 3, C.toriiDark);
  dot(g, cx + 10, gy - h - 3, C.toriiDark);
  rect(g, cx - 8, gy - h - 1, 17, 1, C.torii);
  rect(g, cx - 8, gy - h + 3, 17, 1, C.torii);
  rect(g, cx, gy - h, 1, 3, C.toriiDark);
  if (season === 'winter') rect(g, cx - 9, gy - h - 3, 19, 1, C.snow);
}
function lantern(g, cx, gy, C, night, season) {
  rect(g, cx - 3, gy - 2, 7, 2, C.stoneDark);
  rect(g, cx - 1, gy - 7, 3, 5, C.stone);
  rect(g, cx - 3, gy - 8, 7, 1, C.stoneLight);
  rect(g, cx - 2, gy - 11, 5, 3, C.stone);
  rect(g, cx - 1, gy - 10, 3, 1, night ? C.lanternLight : C.stoneDark);
  rect(g, cx - 4, gy - 12, 9, 1, C.stoneDark);
  rect(g, cx - 3, gy - 13, 7, 1, C.stone);
  rect(g, cx - 1, gy - 14, 3, 1, C.stone);
  dot(g, cx, gy - 15, C.stoneLight);
  if (season === 'winter') { rect(g, cx - 3, gy - 14, 7, 1, C.snow); rect(g, cx - 1, gy - 15, 3, 1, C.snow); }
}
function tree(g, x, gy, C, season, rnd) {
  const T = (x0, y0, x1, y1, t = 2) => line(g, x0, y0, x1, y1, C.trunk, t);
  T(x, gy, x + 1, gy - 7, 3);
  T(x + 1, gy - 7, x + 3, gy - 13);
  T(x + 3, gy - 13, x + 4, gy - 18);
  T(x + 3, gy - 13, x + 11, gy - 19, 1);
  T(x + 2, gy - 10, x - 5, gy - 15, 1);
  T(x + 4, gy - 18, x + 8, gy - 26, 1);
  line(g, x, gy, x + 1, gy - 7, C.trunkDark, 1);
  if (season === 'winter') {
    for (const [bx, by] of [[x + 11, gy - 20], [x - 5, gy - 16], [x + 8, gy - 27], [x + 4, gy - 19], [x + 7, gy - 16]]) blob(g, bx, by, 2, C.canopy, rnd);
    return;
  }
  for (const [bx, by, r] of [[x + 1, gy - 24, 8], [x + 11, gy - 21, 6], [x - 6, gy - 18, 6], [x + 6, gy - 31, 5], [x + 15, gy - 26, 4], [x - 3, gy - 29, 5]]) {
    blob(g, bx, by, r, C.canopy, rnd);
  }
}

/* ---------- particles (petals, leaves, snow, fireflies) ---------- */
function particleKind(season, night) {
  if (season === 'summer') return night ? 'firefly' : 'none';
  return SEASONS[season].kind;
}
function spawn(kind, W, H, r, anywhere) {
  return {
    x: r() * W,
    y: anywhere ? r() * H : -2 - r() * 8,
    vy: kind === 'snow' ? 2.5 + r() * 2.5 : kind === 'firefly' ? 0 : 3 + r() * 3,
    vx: kind === 'snow' ? 0.6 : 1.5 + r() * 2,
    p: r() * 6.28,
    c: Math.floor(r() * 4),
  };
}
function makeParticles(kind, W, H, r) {
  const n = kind === 'none' ? 0 : kind === 'firefly' ? Math.round(W / 14) : Math.round(W / 8);
  return { kind, list: Array.from({ length: n }, () => spawn(kind, W, H, r, true)), r };
}
function drawParticles(g, W, H, C, P, t, dt) {
  for (const p of P.list) {
    if (P.kind === 'firefly') {
      p.x += Math.sin(t * 0.6 + p.p) * 2 * dt;
      p.y += Math.cos(t * 0.5 + p.p * 2) * 1.5 * dt;
      if (p.y < H * 0.35) p.y = H * 0.35;
      if (p.y > H - 4) p.y = H - 4;
      const b = Math.sin(t * 2.2 + p.p);
      if (b > 0.1) {
        if (b > 0.6) { g.globalAlpha = 0.35; rect(g, p.x - 1, p.y - 1, 3, 3, '#e8f27a'); g.globalAlpha = 1; }
        dot(g, p.x, p.y, b > 0.6 ? '#f4ff9c' : '#a9b85a');
      }
      continue;
    }
    p.y += p.vy * dt;
    p.x += (p.vx + Math.sin(t * 1.6 + p.p) * 3) * dt;
    if (p.y > H + 2 || p.x > W + 3) Object.assign(p, spawn(P.kind, W, H, P.r, false));
    const c = C.fall[p.c % C.fall.length];
    const x = Math.round(p.x), y = Math.round(p.y);
    if (P.kind === 'leaf') {
      const f = Math.floor(t * 4 + p.p) % 4;
      dot(g, x, y, c);
      dot(g, x + (f < 2 ? 1 : -1), y, c);
      dot(g, x, y + (f % 2 ? 1 : -1), c);
    } else if (P.kind === 'petal') {
      dot(g, x, y, c);
      if (Math.floor(t * 3 + p.p) % 2) dot(g, x + 1, y, c);
    } else {
      dot(g, x, y, c);
      if (p.c === 0) dot(g, x + 1, y, c);
    }
  }
}

/* ---------- scene: the Today banner ---------- */
const banner = {
  H: 50,
  seed: 11,
  drawStatic(g, W, H, C, season, night, rnd) {
    const horizon = H - 12;
    gradient(g, 0, 0, W, horizon + 2, C.sky);
    const sx = Math.round(W * 0.8), sy = 9;
    if (night) {
      ellipse(g, sx, sy, 6, 6, C.halo);
      ellipse(g, sx, sy, 4, 4, C.moon);
      dot(g, sx + 1, sy - 1, C.moonShade); dot(g, sx - 2, sy + 1, C.moonShade); dot(g, sx + 2, sy + 2, C.moonShade);
    } else {
      ellipse(g, sx, sy, 7, 7, C.halo);
      ellipse(g, sx, sy, 4, 4, C.sun);
    }
    fuji(g, Math.round(W * 0.6), horizon, Math.round(Math.min(46, W * 0.3)), Math.min(24, H - 24), C, season);
    ridge(g, W, horizon, C, rnd);
    pagoda(g, Math.round(W * 0.27), horizon + 5, C, season);
    ground(g, W, horizon + 4, H, C, rnd);
    const tx = Math.round(W * 0.88), lx = Math.round(W * 0.7);
    for (let x = Math.round(W * 0.27) + 10, i = 0; x < tx - 4; x += 6, i++) {
      const y = H - 5 + (i % 2);
      rect(g, x, y, 4, 1, C.path);
      rect(g, x + 1, y + 1, 2, 1, C.pathShade);
    }
    lantern(g, lx, H - 3, C, night, season);
    torii(g, tx, H - 2, C, season);
    tree(g, Math.round(Math.max(5, W * 0.05)), H - 2, C, season, rnd);
  },
  init(W, H, C, season, night, layer) {
    const r = random(29);
    const lx = Math.round(W * 0.7);
    const sky = new Set(C.sky);
    const data = layer.getImageData(0, 0, W, H).data;
    const isSky = (x, y) => { const i = (y * W + x) * 4; return sky.has('#' + [0, 1, 2].map(k => data[i + k].toString(16).padStart(2, '0')).join('')); };
    const stars = [];
    if (night) for (let i = 0; i < W / 4 && stars.length < W / 7; i++) {
      const x = Math.floor(r() * W), y = Math.floor(r() * (H - 22));
      if (isSky(x, y)) stars.push({ x, y, p: r() * 6.28 });
    }
    return {
      clouds: night ? [] : [{ x: W * 0.12, y: 3, s: 0, v: 0.7 }, { x: W * 0.5, y: 9, s: 1, v: 0.45 }, { x: W * 0.95, y: 5, s: 1, v: 0.6 }],
      stars,
      particles: makeParticles(particleKind(season, night), W, H, r),
      bird: { next: 2 + r() * 5, active: false, x: 0, y: 0 },
      cat: { x: lx + 6, y: H - 10 },
      lantern: { x: lx, y: H - 13 },
      r,
    };
  },
  drawDynamic(g, W, H, C, season, night, S, t, dt) {
    for (const s of S.stars) {
      const b = Math.sin(t * 1.3 + s.p);
      if (b > -0.3) dot(g, s.x, s.y, b > 0.7 ? C.star : C.starDim);
    }
    for (const c of S.clouds) {
      c.x += c.v * dt;
      if (c.x > W + 2) c.x = -16;
      sprite(g, CLOUDS[c.s], Math.round(c.x), c.y, { '#': C.cloud, '=': C.cloudShade });
    }
    const B = S.bird;
    if (!night && !B.active && t > B.next) Object.assign(B, { active: true, x: W + 10, y: 8 + S.r() * 9 });
    if (B.active) {
      B.x -= 9 * dt;
      sprite(g, BIRD[Math.floor(t * 4) % 2], Math.round(B.x), Math.round(B.y + Math.sin(t * 2) * 1.2), { w: C.bird, r: C.birdRed, d: C.birdDark });
      if (B.x < -12) Object.assign(B, { active: false, next: t + 14 + S.r() * 16 });
    }
    if (night) {
      g.globalAlpha = 0.18 + 0.08 * Math.sin(t * 7) + 0.05 * Math.sin(t * 13);
      rect(g, S.lantern.x - 3, S.lantern.y - 2, 7, 5, C.lanternLight);
      g.globalAlpha = 1;
      rect(g, S.lantern.x - 1, S.lantern.y, 3, 1, Math.sin(t * 9) > 0.6 ? '#fff0b8' : C.lanternLight);
    }
    const blink = t % 4.3 < 0.18;
    const frame = CAT[Math.floor(t * 1.2) % 2];
    sprite(g, frame, S.cat.x, S.cat.y, { k: C.cat, e: blink ? C.cat : C.catEye });
    drawParticles(g, W, H, C, S.particles, t, dt);
  },
};

/* ---------- scene: zen garden for the end of a session ---------- */
const garden = {
  H: 46,
  seed: 23,
  layout(W, H) {
    const rx = Math.round(Math.min(18, W * 0.15));
    return {
      wallTop: 7,
      sandTop: 20,
      rocks: [[Math.round(W * 0.16), 28, 6, 3], [Math.round(W * 0.34), 36, 5, 3], [Math.round(W * 0.5), 27, 4, 2]],
      pond: { x: Math.round(W - rx - 8), y: H - 11, rx, ry: 6 },
    };
  },
  drawStatic(g, W, H, C, season, night, rnd) {
    const L = this.layout(W, H);
    gradient(g, 0, 0, W, L.wallTop + 2, [C.sky[0], C.sky[1]]);
    // trees peeking over the wall
    for (let x = 4; x < W; x += 14 + Math.floor(rnd() * 8)) blob(g, x, L.wallTop - 1, 5 + Math.floor(rnd() * 3), season === 'winter' ? [C.snow, C.snowShade, '#ffffff', C.snowShade] : C.canopy, rnd);
    // temple wall with white stripes (sujibei) and a tiled top
    rect(g, 0, L.wallTop, W, 2, C.tile);
    for (let x = 0; x < W; x += 3) dot(g, x, L.wallTop, C.tileLight);
    if (season === 'winter') rect(g, 0, L.wallTop - 1, W, 1, C.snow);
    rect(g, 0, L.wallTop + 2, W, L.sandTop - L.wallTop - 2, C.wall);
    for (const dy of [4, 6, 8, 10]) rect(g, 0, L.wallTop + dy, W, 1, C.wallLine);
    rect(g, 0, L.sandTop - 1, W, 1, C.wallShade);
    // raked sand: straight lines, rippling in rings around the rocks
    for (let y = L.sandTop; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let ring = Infinity;
        for (const [rx0, ry0, rw, rh] of L.rocks) ring = Math.min(ring, Math.hypot((x - rx0) / (rw + 1), (y - ry0) / (rh + 1)));
        const lineHere = ring < 3.2 ? Math.floor(ring * 2.6) % 2 === 0 && ring > 1.05 : (y - L.sandTop) % 3 === 1;
        dot(g, x, y, lineHere ? C.sandLine : C.sand);
      }
    }
    for (const [x, y, rw, rh] of L.rocks) {
      ellipse(g, x, y, rw, rh, C.rock);
      ellipse(g, x - 1, y - 1, rw - 2, Math.max(1, rh - 2), C.rockLight);
      rect(g, x - rw + 1, y + rh, rw * 2 - 1, 1, C.rockDark);
      for (let i = 0; i < rw; i++) if (rnd() < 0.5) dot(g, x - rw + 2 + Math.floor(rnd() * (rw * 2 - 3)), y - rh + (rnd() < 0.5 ? 0 : 1), C.moss);
    }
    const P = L.pond;
    ellipse(g, P.x, P.y, P.rx + 2, P.ry + 1, C.rockDark);
    ellipse(g, P.x, P.y, P.rx, P.ry, C.water);
    ellipse(g, P.x + 2, P.y + 2, P.rx - 4, P.ry - 3, C.waterDark);
    // shishi-odoshi: post and the spout that feeds it
    const ox = P.x - P.rx - 5, oy = P.y - 6;
    rect(g, ox, oy, 1, 7, C.bambooDark);
    rect(g, ox - 4, oy + 6, 9, 1, C.rockDark);
    rect(g, ox - 13, oy - 7, 9, 2, C.bamboo);
    rect(g, ox - 13, oy - 7, 1, 2, C.bambooDark);
    rect(g, ox - 6, oy - 7, 1, 2, C.bambooDark);
    rect(g, ox - 14, oy - 7, 1, 9, C.bambooDark);
  },
  init(W, H, C, season, night) {
    const r = random(41);
    return { L: this.layout(W, H), particles: makeParticles(particleKind(season, night), W, H, r), r };
  },
  drawDynamic(g, W, H, C, season, night, S, t, dt) {
    const P = S.L.pond;
    // shimmer
    for (let i = 0; i < 4; i++) {
      const a = t * 0.4 + i * 1.7;
      dot(g, P.x + Math.round(Math.cos(a) * (P.rx - 3)), P.y + Math.round(Math.sin(a * 1.3) * (P.ry - 2)), C.waterLight);
    }
    // two koi swimming in loops
    for (const [phase, speed, colors] of [[0, 0.5, [C.koi, C.koiWhite]], [2.6, 0.38, [C.koiWhite, C.koi]]]) {
      const a = t * speed + phase;
      const x = P.x + Math.cos(a) * (P.rx - 5), y = P.y + Math.sin(a) * (P.ry - 3);
      const dir = -Math.sin(a) >= 0 ? 1 : -1;
      for (let i = 0; i < 4; i++) dot(g, x - dir * i, y, i === 1 ? colors[1] : colors[0]);
      dot(g, x - dir * 4, y + (Math.floor(t * 6) % 2 ? 1 : -1), colors[0]);
    }
    // the bamboo pipe fills, tips, pours into the pond and knocks back
    const ox = P.x - P.rx - 5, oy = P.y - 6;
    const cycle = t % 5;
    let angle = -0.55;
    if (cycle > 3.8 && cycle < 4.1) angle = -0.55 + (cycle - 3.8) / 0.3 * 1.1;
    else if (cycle >= 4.1 && cycle < 4.6) angle = 0.55;
    else if (cycle >= 4.6) angle = 0.55 - (cycle - 4.6) / 0.4 * 1.1;
    // angle < 0: open end raised under the spout; angle > 0: tipped down, pouring.
    const open = [ox - Math.cos(angle) * 6, oy + Math.sin(angle) * 6];
    const back = [ox + Math.cos(angle) * 4, oy - Math.sin(angle) * 4];
    line(g, back[0], back[1], open[0], open[1], C.bamboo, 2);
    dot(g, open[0], open[1], C.bambooDark);
    if (cycle < 3.8 && Math.floor(t * 6) % 3 === 0) dot(g, ox - 5, oy - 4 + Math.floor((t * 12) % 3), C.waterLight);
    if (cycle >= 4.1 && cycle < 4.6) for (let i = 0; i < 3; i++) dot(g, open[0] - 1, open[1] + 1 + i + Math.floor(t * 10) % 2, C.waterLight);
    if (cycle >= 4.95 || cycle < 0.08) { dot(g, back[0] + 2, back[1] - 1, C.rockLight); dot(g, back[0] + 3, back[1] + 1, C.rockLight); }
    // a cat asleep on the wall
    const cx = Math.round(W * 0.28), cy = S.L.wallTop - CAT_SLEEP.length;
    sprite(g, CAT_SLEEP, cx, cy, { k: C.cat, g: night ? '#3a4440' : '#6d625b' });
    const z = (t % 3) / 3;
    g.globalAlpha = 1 - z;
    sprite(g, ZZ, cx + 2 - Math.round(z * 2), cy - 4 - Math.round(z * 5), { z: night ? '#cfd8d3' : '#8a8178' });
    g.globalAlpha = 1;
    drawParticles(g, W, H, C, S.particles, t, dt);
  },
};

/* ---------- scene: a cat asleep on a zabuton cushion, for a finished deck ---------- */
const nap = {
  H: 13,
  W: 22,
  scale: 3,
  transparent: true,
  drawStatic(g, W, H, C, season, night) {
    const cushion = night ? '#8c2e26' : '#cc3a2c', top = night ? '#a8463b' : '#e0614f', tassel = night ? '#8a7140' : '#c9a24a';
    rect(g, 1, H - 3, 18, 3, cushion);
    rect(g, 2, H - 4, 16, 1, top);
    dot(g, 0, H - 1, tassel);
    dot(g, 19, H - 1, tassel);
  },
  init() { return {}; },
  drawDynamic(g, W, H, C, season, night, S, t) {
    const x = 3, y = H - 3 - CAT_SLEEP.length;
    if (night) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]]) sprite(g, CAT_SLEEP, x + dx, y + dy, { k: '#46564f', g: '#46564f' });
    sprite(g, CAT_SLEEP, x, y, { k: C.cat, g: night ? '#3a4440' : '#6d625b' });
    const z = (t % 3) / 3;
    g.globalAlpha = 1 - z;
    sprite(g, ZZ, 6 + Math.round(z * 4), y - 4 - Math.round(z * 3), { z: night ? '#cfd8d3' : '#8a8178' });
    g.globalAlpha = 1;
  },
};

const KINDS = { banner, garden, nap };

/* ---------- engine ---------- */
const scenes = new Set();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let rafId = 0, lastFrame = 0;

function tick(ts) {
  rafId = requestAnimationFrame(tick);
  if (ts - lastFrame < 1000 / FPS) return;
  lastFrame = ts;
  for (const s of scenes) if (s.visible) s.render(ts / 1000);
}
function startLoop() {
  if (!rafId && !reduceMotion.matches && scenes.size) rafId = requestAnimationFrame(tick);
}
function stopLoop() {
  cancelAnimationFrame(rafId);
  rafId = 0;
}

/** Put a scene into `container`. Returns { destroy() }. */
export function mountScene(container, kindName) {
  const spec = KINDS[kindName];
  const canvas = document.createElement('canvas');
  canvas.className = 'pixel-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);
  const g = canvas.getContext('2d');
  const scene = { visible: true, width: -1, render: () => {} };

  scene.build = () => {
    const width = container.clientWidth || 320;
    const scale = spec.scale || (width >= 520 ? 4 : 3);
    const W = spec.W || Math.ceil(width / scale), H = spec.H;
    scene.width = width;
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = W * scale + 'px';
    canvas.style.height = H * scale + 'px';
    const night = isNight(), season = currentSeason();
    const C = palette(season, night);
    const layer = document.createElement('canvas');
    layer.width = W;
    layer.height = H;
    const lg = layer.getContext('2d', { willReadFrequently: true });
    spec.drawStatic(lg, W, H, C, season, night, random(spec.seed));
    const state = spec.init(W, H, C, season, night, lg);
    let last = null;
    scene.render = t => {
      const dt = last == null ? 0 : Math.min(0.3, t - last);
      last = t;
      if (spec.transparent) g.clearRect(0, 0, W, H);
      g.drawImage(layer, 0, 0);
      spec.drawDynamic(g, W, H, C, season, night, state, t, dt);
    };
    scene.render(performance.now() / 1000);
  };

  scene.build();
  const resize = new ResizeObserver(() => {
    const w = container.clientWidth;
    if (w && !spec.W && Math.abs(w - scene.width) > 2) scene.build();
  });
  resize.observe(container);
  const seen = new IntersectionObserver(([e]) => { scene.visible = e.isIntersecting; });
  seen.observe(canvas);
  scenes.add(scene);
  startLoop();
  return {
    destroy() {
      resize.disconnect();
      seen.disconnect();
      scenes.delete(scene);
      canvas.remove();
      if (!scenes.size) stopLoop();
    },
  };
}

// Redraw every scene, e.g. after the theme changes between day and night.
export function rebuildScenes() {
  for (const s of scenes) s.build();
}
reduceMotion.addEventListener('change', () => { if (reduceMotion.matches) stopLoop(); else startLoop(); });
