// A small seeded random generator (mulberry32): the same seed always gives the same sequence.
// Used so every device introduces words in the same order, and pixel scenes look the same each time.
export function seededRandom(seed) {
  return function () {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
