/**
 * Deterministic placeholder sequences for the example registry.
 *
 * These are NOT real sequences and every part built from them says so in its provenance:
 * `origin: 'user'`, `confidence: 'low'`, and a note. The shipped catalogue in
 * @castor-bio/catalog is the opposite — every base there is a slice of a named GenBank
 * record, checked against its expected length on every build — and the two must stay
 * distinguishable at a glance, because a scientist who cannot tell which is which has to
 * treat all of it as unverified.
 *
 * What is real about them is the LENGTHS, which are the published sizes of the elements they
 * stand in for. Length is what drives the capacity meter, the ruler and the comparison figure,
 * so the demo behaves the way the real thing would.
 */

/** mulberry32: small, seeded, and identical across runs so the demo never shifts. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFrom(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const BASES = 'ACGT'

/** Non-coding filler at a given GC content. */
export function syntheticRegulatory(name: string, length: number, gc = 0.52): string {
  const next = rng(seedFrom(name))
  let out = ''
  for (let i = 0; i < length; i++) {
    out += next() < gc ? (next() < 0.5 ? 'G' : 'C') : next() < 0.5 ? 'A' : 'T'
  }
  return out
}

const STOPS = new Set(['TAA', 'TAG', 'TGA'])

/**
 * An open reading frame: ATG, `length / 3 - 2` sense codons, one stop. No internal stop, so
 * the frame rules see a well-formed CDS rather than a stream of findings about placeholder
 * data.
 */
export function syntheticCds(name: string, length: number): string {
  if (length % 3 !== 0) throw new Error(`syntheticCds(${name}): ${length} is not a multiple of 3`)
  const next = rng(seedFrom(name))
  let out = 'ATG'
  while (out.length < length - 3) {
    let codon: string
    do {
      codon = ''
      for (let i = 0; i < 3; i++) codon += BASES[Math.floor(next() * 4)]
    } while (STOPS.has(codon))
    out += codon
  }
  return out + 'TAA'
}
