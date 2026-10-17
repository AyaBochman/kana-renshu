// Kana tables, rōmaji for every reading unit, and tips for telling lookalike characters apart.

// Gojūon order. Each entry is [hiragana, katakana, rōmaji]; extra spellings are separated by "|",
// and the first one is the one shown to the learner. null marks an empty slot in the chart.
export const BASE_ROWS = [
  [['あ','ア','a'],['い','イ','i'],['う','ウ','u'],['え','エ','e'],['お','オ','o']],
  [['か','カ','ka'],['き','キ','ki'],['く','ク','ku'],['け','ケ','ke'],['こ','コ','ko']],
  [['さ','サ','sa'],['し','シ','shi|si'],['す','ス','su'],['せ','セ','se'],['そ','ソ','so']],
  [['た','タ','ta'],['ち','チ','chi|ti'],['つ','ツ','tsu|tu'],['て','テ','te'],['と','ト','to']],
  [['な','ナ','na'],['に','ニ','ni'],['ぬ','ヌ','nu'],['ね','ネ','ne'],['の','ノ','no']],
  [['は','ハ','ha'],['ひ','ヒ','hi'],['ふ','フ','fu|hu'],['へ','ヘ','he'],['ほ','ホ','ho']],
  [['ま','マ','ma'],['み','ミ','mi'],['む','ム','mu'],['め','メ','me'],['も','モ','mo']],
  [['や','ヤ','ya'],null,['ゆ','ユ','yu'],null,['よ','ヨ','yo']],
  [['ら','ラ','ra'],['り','リ','ri'],['る','ル','ru'],['れ','レ','re'],['ろ','ロ','ro']],
  [['わ','ワ','wa'],null,null,null,['を','ヲ','o|wo']],
  [['ん','ン','n|nn'],null,null,null,null],
];

export const DAKU_ROWS = [
  [['が','ガ','ga'],['ぎ','ギ','gi'],['ぐ','グ','gu'],['げ','ゲ','ge'],['ご','ゴ','go']],
  [['ざ','ザ','za'],['じ','ジ','ji|zi'],['ず','ズ','zu'],['ぜ','ゼ','ze'],['ぞ','ゾ','zo']],
  [['だ','ダ','da'],['ぢ','ヂ','ji|di|dji'],['づ','ヅ','zu|du|dzu'],['で','デ','de'],['ど','ド','do']],
  [['ば','バ','ba'],['び','ビ','bi'],['ぶ','ブ','bu'],['べ','ベ','be'],['ぼ','ボ','bo']],
  [['ぱ','パ','pa'],['ぴ','ピ','pi'],['ぷ','プ','pu'],['ぺ','ペ','pe'],['ぽ','ポ','po']],
];

const YOON_HEADS = [
  ['き','キ','ky'],['し','シ','sh|sy'],['ち','チ','ch|ty|cy'],['に','ニ','ny'],['ひ','ヒ','hy'],['み','ミ','my'],
  ['り','リ','ry'],['ぎ','ギ','gy'],['じ','ジ','j|jy|zy'],['び','ビ','by'],['ぴ','ピ','py'],
];
const SMALL_Y = [['ゃ','ャ','a'],['ゅ','ュ','u'],['ょ','ョ','o']];

export const YOON_ROWS = YOON_HEADS.map(([h, k, p]) =>
  SMALL_Y.map(([sh, sk, v]) => [h + sh, k + sk, p.split('|').map(x => x + v).join('|')]));

// Katakana-only combinations used for foreign sounds. Entries are [katakana, rōmaji].
export const EXT_ROWS = [
  [['ファ','fa'],['フィ','fi'],['フェ','fe'],['フォ','fo']],
  [['ティ','ti|thi'],['ディ','di|dhi'],['シェ','she|sye'],['ジェ','je|jye|zye']],
  [['チェ','che|tye'],['ウィ','wi|ui'],['ウェ','we|ue'],['ウォ','wo|uo']],
  [['ヴァ','va|ba'],['ヴィ','vi|bi'],['ヴ','vu|bu'],['デュ','dyu|du']],
];

const EXTRA_UNITS = {
  'フュ':'fyu','トゥ':'tu|to','ドゥ':'du|do','テュ':'tyu','ヴェ':'ve|be','ヴォ':'vo|bo','イェ':'ye',
  'ツァ':'tsa','ツォ':'tso','クァ':'kwa','グァ':'gwa',
  'ぁ':'a','ぃ':'i','ぅ':'u','ぇ':'e','ぉ':'o','ァ':'a','ィ':'i','ゥ':'u','ェ':'e','ォ':'o',
  'ゃ':'ya','ゅ':'yu','ょ':'yo','ャ':'ya','ュ':'yu','ョ':'yo',
};

// Every reading unit (single kana or kana + small kana) mapped to its accepted rōmaji spellings.
export const UNIT = {};
const addUnit = (k, r) => { if (!UNIT[k]) UNIT[k] = r.split('|'); };
[BASE_ROWS, DAKU_ROWS, YOON_ROWS].forEach(rows => rows.forEach(row => row.forEach(x => {
  if (x) { addUnit(x[0], x[2]); addUnit(x[1], x[2]); }
})));
EXT_ROWS.forEach(row => row.forEach(x => x && addUnit(x[0], x[1])));
Object.entries(EXTRA_UNITS).forEach(([k, r]) => addUnit(k, r));

export const isKatakana = c => /[゠-ヿ]/.test(c);

// Rōmaji back to kana, per script, used to say "you read it as シ".
export const REVERSE = { h: {}, k: {} };
Object.entries(UNIT).forEach(([k, alts]) => {
  if (/^[ぁぃぅぇぉゃゅょァィゥェォャュョ]$/.test(k)) return;
  const s = isKatakana(k) ? 'k' : 'h';
  alts.forEach(a => { if (!REVERSE[s][a]) REVERSE[s][a] = k; });
});

const LOOKALIKES = [
  ['h', 'ぬめ', 'ぬ ends in a small loop. め does not.'],
  ['h', 'ねれわ', 'Same left stroke. ね ends in a loop, れ kicks out to the right, わ curls back in.'],
  ['h', 'るろ', 'る closes with a loop at the bottom. ろ stays open.'],
  ['h', 'さち', 'さ curves like a c at the bottom. ち bulges the other way, like a 5.'],
  ['h', 'きさ', 'き has two crossbars. さ has one.'],
  ['h', 'はほ', 'ほ has a flat cap over its right side. In は the vertical pokes up through the bar.'],
  ['h', 'いり', 'り has one long sweeping stroke on the right. Both strokes of い are short.'],
  ['h', 'あお', 'お has a separate dot at the top right. あ has a stroke crossing through its loop.'],
  ['h', 'こに', 'に is こ with a vertical stroke in front.'],
  ['h', 'たな', 'な has a dot and a loop. た has two short bars on the right.'],
  ['h', 'うら', 'ら drops straight down on the left before it curves. う curves right away.'],
  ['h', 'くへ', 'く points left like <. へ is a low roof.'],
  ['h', 'しつ', 'し hangs down and hooks right. つ arches over to the right.'],
  ['k', 'シツ', 'シ: dots stacked on the left, long stroke rises from the bottom. ツ: dots side by side on top, long stroke falls from the top.'],
  ['k', 'ソン', 'ソ: both strokes fall from the top. ン: the dot sits on the left and the long stroke rises from the bottom.'],
  ['k', 'シンツソ', 'Long stroke rises from the bottom left: シ and ン. Long stroke falls from the top: ツ and ソ.'],
  ['k', 'クケタ', 'ケ has a bar that runs straight out to the right. タ has a short stroke inside. ク has neither.'],
  ['k', 'ウワフ', 'ウ has a dot on top. ワ has a short left side and no dot. フ is only the hook.'],
  ['k', 'コユロ', 'コ is open on the left. ユ has a bottom line that runs past its side. ロ is closed.'],
  ['k', 'チテ', 'チ starts with a slanted stroke and its vertical cuts through the bar. テ has two flat bars and drops from the lower one.'],
  ['k', 'スヌ', 'ヌ has an extra short stroke crossing its tail.'],
  ['k', 'ナメ', 'ナ is a cross with a flat bar. メ is a tilted x.'],
  ['k', 'マムア', 'マ is a hook with a short stroke tucked under it. ム is a closed corner with a dot on the right. ア is a hook with a long drop.'],
  ['k', 'ルレ', 'ル has two strokes. レ has one.'],
  ['k', 'セヤ', 'セ has a vertical that turns flat at the bottom. ヤ has no bottom.'],
].map(([script, chars, hint]) => ({ script, set: [...chars], hint }));

export function lookalikeHint(script, a, b) {
  const g = LOOKALIKES.find(g => g.script === script && g.set.includes(a) && g.set.includes(b));
  return g ? g.hint : '';
}
