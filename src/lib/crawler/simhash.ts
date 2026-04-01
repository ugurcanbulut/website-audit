/**
 * Lightweight simhash for near-duplicate content detection.
 * Produces a 64-bit hash as a hex string. Pages with similar content
 * will have hashes that differ in only a few bit positions.
 */

/** Generate simhash from text content */
export function simhash(text: string): string {
  const tokens = tokenize(text);
  if (tokens.length === 0) return "0000000000000000";

  // 64-bit vector accumulator
  const v = new Array(64).fill(0);

  for (const token of tokens) {
    const hash = fnv1a64(token);
    for (let i = 0; i < 64; i++) {
      if ((hash[i >> 5] >>> (i & 31)) & 1) {
        v[i]++;
      } else {
        v[i]--;
      }
    }
  }

  // Convert accumulator to hash
  const result = [0, 0];
  for (let i = 0; i < 64; i++) {
    if (v[i] > 0) {
      result[i >> 5] |= 1 << (i & 31);
    }
  }

  return (result[1] >>> 0).toString(16).padStart(8, "0") +
         (result[0] >>> 0).toString(16).padStart(8, "0");
}

/** Calculate Hamming distance between two simhash hex strings */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let distance = 0;
  for (let i = 0; i < a.length; i += 8) {
    const va = parseInt(a.slice(i, i + 8), 16) >>> 0;
    const vb = parseInt(b.slice(i, i + 8), 16) >>> 0;
    let xor = va ^ vb;
    while (xor) {
      distance++;
      xor &= xor - 1; // clear lowest set bit
    }
  }
  return distance;
}

/** Check if two pages are near-duplicates (distance <= threshold) */
export function isNearDuplicate(hashA: string, hashB: string, threshold = 10): boolean {
  return hammingDistance(hashA, hashB) <= threshold;
}

/** Find duplicate clusters from a list of pages */
export function findDuplicateClusters(
  pages: Array<{ url: string; hash: string }>
): Array<{ urls: string[]; similarity: number }> {
  const clusters: Array<{ urls: string[]; similarity: number }> = [];
  const assigned = new Set<string>();

  for (let i = 0; i < pages.length; i++) {
    if (assigned.has(pages[i].url)) continue;

    const cluster = [pages[i].url];
    let minDistance = 64;

    for (let j = i + 1; j < pages.length; j++) {
      if (assigned.has(pages[j].url)) continue;
      const dist = hammingDistance(pages[i].hash, pages[j].hash);
      if (dist <= 10) {
        cluster.push(pages[j].url);
        assigned.add(pages[j].url);
        minDistance = Math.min(minDistance, dist);
      }
    }

    if (cluster.length > 1) {
      assigned.add(pages[i].url);
      const similarity = Math.round((1 - minDistance / 64) * 100);
      clusters.push({ urls: cluster, similarity });
    }
  }

  return clusters;
}

// ── Internal helpers ────────────────────────────────────────────────

function tokenize(text: string): string[] {
  // Normalize: lowercase, collapse whitespace, extract word n-grams
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  const words = normalized.split(" ").filter((w) => w.length > 2);

  // Use 3-word shingles for better duplicate detection
  const shingles: string[] = [];
  for (let i = 0; i <= words.length - 3; i++) {
    shingles.push(words.slice(i, i + 3).join(" "));
  }
  return shingles.length > 0 ? shingles : words;
}

function fnv1a64(str: string): [number, number] {
  // FNV-1a hash producing two 32-bit values (simulating 64-bit)
  let h0 = 0x811c9dc5;
  let h1 = 0xcbf29ce4;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h0 ^= c;
    h0 = Math.imul(h0, 0x01000193);
    h1 ^= c >> 8;
    h1 = Math.imul(h1, 0x01000193);
  }
  return [h0 >>> 0, h1 >>> 0];
}
