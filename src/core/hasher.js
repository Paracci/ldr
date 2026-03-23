/**
 * LDR Perceptual Hashing Engine
 *
 * Produces a compact "fingerprint" from any logo image.
 * Two logos that look similar will have similar fingerprints —
 * even if they differ in size, brightness, or minor details.
 *
 * Three algorithms, each with different strengths:
 *   aHash — Average Hash      — fast, good for exact matches
 *   dHash — Difference Hash   — good for detecting edits
 *   pHash — Perceptual Hash   — most robust, used as primary
 *
 * Primary output: pHash (64-bit) as hex string
 * Similarity: Hamming distance (0 = identical, 64 = completely different)
 * Match threshold: distance <= 10 (empirically determined)
 */

'use strict';

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const HASH_SIZE = 8;          // 8x8 = 64 bits
const DCT_SIZE  = 32;         // resize to 32x32 before DCT
const MATCH_THRESHOLD  = 10;  // Hamming distance <= 10 → same logo
const SIMILAR_THRESHOLD = 20; // distance <= 20 → suspiciously similar

// ─────────────────────────────────────────────────────────
// Image normalization
// ─────────────────────────────────────────────────────────

/**
 * Convert RGBA pixel array to grayscale values.
 * Uses luminance weights (human eye sensitivity).
 *
 * @param {Uint8ClampedArray} pixels - Raw RGBA data
 * @returns {Float32Array} Grayscale values 0–255
 */
function toGrayscale(pixels) {
  const len = pixels.length / 4;
  const gray = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    // ITU-R BT.601 luminance weights
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gray;
}

/**
 * Bilinear resize of grayscale image.
 *
 * @param {Float32Array} src     - Source grayscale pixels
 * @param {number}       srcW   - Source width
 * @param {number}       srcH   - Source height
 * @param {number}       dstW   - Target width
 * @param {number}       dstH   - Target height
 * @returns {Float32Array}
 */
function resize(src, srcW, srcH, dstW, dstH) {
  const dst  = new Float32Array(dstW * dstH);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const srcX = x * xRatio;
      const srcY = y * yRatio;
      const x0   = Math.floor(srcX);
      const y0   = Math.floor(srcY);
      const x1   = Math.min(x0 + 1, srcW - 1);
      const y1   = Math.min(y0 + 1, srcH - 1);
      const xFrac = srcX - x0;
      const yFrac = srcY - y0;

      // Bilinear interpolation
      const v  =
        src[y0 * srcW + x0] * (1 - xFrac) * (1 - yFrac) +
        src[y0 * srcW + x1] * xFrac       * (1 - yFrac) +
        src[y1 * srcW + x0] * (1 - xFrac) * yFrac       +
        src[y1 * srcW + x1] * xFrac       * yFrac;

      dst[y * dstW + x] = v;
    }
  }
  return dst;
}

// ─────────────────────────────────────────────────────────
// DCT (Discrete Cosine Transform)
// ─────────────────────────────────────────────────────────

/**
 * 2D DCT-II on a square NxN float array.
 * Returns a new Float32Array of DCT coefficients.
 *
 * @param {Float32Array} pixels - Input NxN grayscale
 * @param {number}       N      - Image side length
 * @returns {Float32Array}
 */
function dct2d(pixels, N) {
  // Pre-compute cosine table for speed
  const cos = new Float32Array(N * N);
  for (let k = 0; k < N; k++) {
    for (let n = 0; n < N; n++) {
      cos[k * N + n] = Math.cos((Math.PI / N) * (n + 0.5) * k);
    }
  }

  const out = new Float32Array(N * N);

  for (let ky = 0; ky < N; ky++) {
    for (let kx = 0; kx < N; kx++) {
      let sum = 0;
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          sum += pixels[y * N + x] * cos[ky * N + y] * cos[kx * N + x];
        }
      }
      // Normalization
      const scaleX = kx === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
      const scaleY = ky === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
      out[ky * N + kx] = sum * scaleX * scaleY;
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────
// Hash algorithms
// ─────────────────────────────────────────────────────────

/**
 * Average Hash (aHash)
 * Fast. Good for quick filtering before pHash.
 *
 * 1. Resize to 8x8
 * 2. Compute mean pixel value
 * 3. Each bit = pixel above mean
 *
 * @param {Float32Array} gray - Grayscale pixels
 * @param {number}       w    - Image width
 * @param {number}       h    - Image height
 * @returns {bigint} 64-bit hash
 */
function aHash(gray, w, h) {
  const small = resize(gray, w, h, HASH_SIZE, HASH_SIZE);
  const mean  = small.reduce((a, b) => a + b, 0) / small.length;

  let hash = 0n;
  for (let i = 0; i < 64; i++) {
    if (small[i] > mean) hash |= (1n << BigInt(63 - i));
  }
  return hash;
}

/**
 * Difference Hash (dHash)
 * Captures gradient direction. Robust to brightness shifts.
 *
 * 1. Resize to 9x8
 * 2. Each bit = left pixel brighter than right
 *
 * @param {Float32Array} gray - Grayscale pixels
 * @param {number}       w    - Image width
 * @param {number}       h    - Image height
 * @returns {bigint} 64-bit hash
 */
function dHash(gray, w, h) {
  const small = resize(gray, w, h, HASH_SIZE + 1, HASH_SIZE);

  let hash = 0n;
  let bit  = 63;
  for (let y = 0; y < HASH_SIZE; y++) {
    for (let x = 0; x < HASH_SIZE; x++) {
      const left  = small[y * (HASH_SIZE + 1) + x];
      const right = small[y * (HASH_SIZE + 1) + x + 1];
      if (left > right) hash |= (1n << BigInt(bit));
      bit--;
    }
  }
  return hash;
}

/**
 * Perceptual Hash (pHash) — Primary algorithm
 * Most robust. Uses DCT to capture structural features.
 *
 * 1. Resize to 32x32
 * 2. Apply 2D DCT
 * 3. Take top-left 8x8 (low frequency components)
 * 4. Each bit = DCT coefficient above median
 *
 * @param {Float32Array} gray - Grayscale pixels
 * @param {number}       w    - Image width
 * @param {number}       h    - Image height
 * @returns {bigint} 64-bit hash
 */
function pHash(gray, w, h) {
  // 1. Resize to DCT_SIZE x DCT_SIZE
  const small = resize(gray, w, h, DCT_SIZE, DCT_SIZE);

  // 2. 2D DCT
  const dct = dct2d(small, DCT_SIZE);

  // 3. Extract top-left 8x8 (skip [0,0] DC component — it encodes brightness)
  const lowFreq = new Float32Array(HASH_SIZE * HASH_SIZE);
  for (let y = 0; y < HASH_SIZE; y++) {
    for (let x = 0; x < HASH_SIZE; x++) {
      lowFreq[y * HASH_SIZE + x] = dct[y * DCT_SIZE + x];
    }
  }

  // 4. Compute median
  const sorted = Float32Array.from(lowFreq).sort();
  const median = (sorted[31] + sorted[32]) / 2;

  // 5. Generate hash bits
  let hash = 0n;
  for (let i = 0; i < 64; i++) {
    if (lowFreq[i] > median) hash |= (1n << BigInt(63 - i));
  }
  return hash;
}

// ─────────────────────────────────────────────────────────
// Similarity
// ─────────────────────────────────────────────────────────

/**
 * Hamming distance between two 64-bit hashes.
 * Counts bits that differ.
 * 0 = identical, 64 = completely different.
 *
 * @param {bigint} a
 * @param {bigint} b
 * @returns {number} 0–64
 */
function hammingDistance(a, b) {
  let xor   = a ^ b;
  let count = 0;
  while (xor > 0n) {
    count += Number(xor & 1n);
    xor >>= 1n;
  }
  return count;
}

/**
 * Classify the relationship between two hashes.
 *
 * @param {number} distance - Hamming distance
 * @returns {'identical'|'match'|'similar'|'different'}
 */
function classify(distance) {
  if (distance === 0)                              return 'identical';
  if (distance <= MATCH_THRESHOLD)                 return 'match';
  if (distance <= SIMILAR_THRESHOLD)               return 'similar';
  return 'different';
}

// ─────────────────────────────────────────────────────────
// Serialization
// ─────────────────────────────────────────────────────────

/**
 * Convert BigInt hash to 16-character hex string.
 * @param {bigint} hash
 * @returns {string}
 */
function toHex(hash) {
  return hash.toString(16).padStart(16, '0');
}

/**
 * Parse hex string back to BigInt hash.
 * @param {string} hex
 * @returns {bigint}
 */
function fromHex(hex) {
  return BigInt('0x' + hex);
}

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────

/**
 * Compute all three hashes from raw RGBA pixel data.
 *
 * @param {Uint8ClampedArray} pixels - Raw RGBA pixels
 * @param {number}            width
 * @param {number}            height
 * @returns {{ ahash: string, dhash: string, phash: string }}
 */
function computeHashes(pixels, width, height) {
  const gray = toGrayscale(pixels);
  return {
    ahash: toHex(aHash(gray, width, height)),
    dhash: toHex(dHash(gray, width, height)),
    phash: toHex(pHash(gray, width, height)),
  };
}

/**
 * Compare two logos by their pHash fingerprints.
 *
 * @param {string} hexA - pHash of logo A
 * @param {string} hexB - pHash of logo B
 * @returns {{
 *   distance: number,
 *   similarity: number,
 *   verdict: 'identical'|'match'|'similar'|'different'
 * }}
 */
function compareHashes(hexA, hexB) {
  const a        = fromHex(hexA);
  const b        = fromHex(hexB);
  const distance = hammingDistance(a, b);
  const verdict  = classify(distance);
  // Similarity as 0–100 percentage
  const similarity = Math.round(((64 - distance) / 64) * 100);
  return { distance, similarity, verdict };
}

/**
 * Check if a candidate logo is too similar to any registered logo.
 * Used during brand registration to detect spoofing attempts.
 *
 * @param {string}   candidateHash  - pHash of the new logo
 * @param {Array<{brand_id: string, phash: string}>} registry - Known logos
 * @returns {{
 *   safe: boolean,
 *   conflicts: Array<{brand_id: string, distance: number, verdict: string}>
 * }}
 */
function checkSpoofing(candidateHash, registry) {
  const conflicts = [];

  for (const entry of registry) {
    const result = compareHashes(candidateHash, entry.phash);
    if (result.verdict !== 'different') {
      conflicts.push({
        brand_id:   entry.brand_id,
        distance:   result.distance,
        similarity: result.similarity,
        verdict:    result.verdict,
      });
    }
  }

  return {
    safe:      conflicts.length === 0,
    conflicts: conflicts.sort((a, b) => a.distance - b.distance),
  };
}

// ─────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────

module.exports = {
  // Core
  computeHashes,
  compareHashes,
  checkSpoofing,

  // Utilities
  toHex,
  fromHex,
  hammingDistance,
  classify,

  // Constants (for testing and tuning)
  MATCH_THRESHOLD,
  SIMILAR_THRESHOLD,
  HASH_SIZE,
  DCT_SIZE,
};
