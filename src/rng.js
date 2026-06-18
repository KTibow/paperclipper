// Deterministic, dependency-free PRNG utilities.
// Same seed -> same sequence, on every platform. Critical for a
// reproducible, verifiable production ledger.

/** 32-bit FNV-1a hash of a string -> unsigned int. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG. Returns a function producing floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build a seeded RNG from an arbitrary string seed. */
export function makeRng(seedString) {
  const rng = mulberry32(hashString(String(seedString)));
  return {
    next: rng,
    /** Float in [min, max). */
    range(min, max) {
      return min + (max - min) * rng();
    },
    /** Integer in [min, max] inclusive. */
    int(min, max) {
      return Math.floor(min + (max - min + 1) * rng());
    },
    /** Pick a random element. */
    pick(arr) {
      return arr[Math.floor(rng() * arr.length)];
    },
  };
}
