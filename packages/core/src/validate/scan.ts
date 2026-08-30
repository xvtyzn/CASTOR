/**
 * One pass over the assembled sequence produces every motif index the rules need, on BOTH
 * strands.
 *
 * The point is not speed — a 10 kb sequence is nothing — it is that the IUPAC expander, the
 * overlap handling and the reverse-strand logic exist in exactly one place. A dozen rules
 * each writing their own `indexOf` loop is how a tool ends up reporting polyadenylation
 * signals on the sense strand only, which is precisely the bug that matters here: ITRs have
 * intrinsic promoter activity and antisense transcription through the cassette is real.
 */
import { findMotif, gcContent, reverseComplement } from '../seq/alphabet.js'

export interface MotifHit {
  /** Half-open `[start, end)` in the FORWARD coordinate space of the scanned sequence. */
  start: number
  end: number
  strand: 1 | -1
  motif: string
}

export interface GcWindow {
  start: number
  end: number
  gc: number
}

export interface SequenceScan {
  sequence: string
  length: number
  /** Motif name -> hits on both strands, sorted by start. */
  motifs: Map<string, MotifHit[]>
  /** Runs of a single base at least `homopolymerMin` long. */
  homopolymers: { start: number; end: number; base: string; length: number }[]
  gcWindows: GcWindow[]
  gcOverall: number
  /** Every ATG on the forward strand. */
  startCodons: number[]
}

/** The motifs every rule set shares. Names are stable and referenced by rules. */
export const MOTIFS: Record<string, string> = {
  polyA_AATAAA: 'AATAAA',
  polyA_ATTAAA: 'ATTAAA',
  smaI_xmaI: 'CCCGGG',
  ahdI: 'GACNNNNNGTC',
  bsaI: 'GGTCTC',
  bsmbI: 'CGTCTC',
  sapI: 'GCTCTTC',
  polIII_terminator: 'TTTTT',
  rbe: 'GAGCGAGCGAGCGCGC',
}

export interface ScanOptions {
  gcWindow: number
  homopolymerMin: number
  /** Additional motifs to index, on top of MOTIFS. */
  extraMotifs?: Record<string, string>
}

export function scanSequence(sequence: string, options: ScanOptions): SequenceScan {
  const seq = sequence.toUpperCase()
  const length = seq.length
  const rc = reverseComplement(seq)

  const all = { ...MOTIFS, ...(options.extraMotifs ?? {}) }
  const motifs = new Map<string, MotifHit[]>()

  for (const [name, pattern] of Object.entries(all)) {
    const hits: MotifHit[] = []
    for (const start of findMotif(seq, pattern)) {
      hits.push({ start, end: start + pattern.length, strand: 1, motif: pattern })
    }
    // A hit at index i on the reverse-complement covers forward positions
    // [length - i - patternLength, length - i).
    for (const i of findMotif(rc, pattern)) {
      const start = length - i - pattern.length
      hits.push({ start, end: start + pattern.length, strand: -1, motif: pattern })
    }
    hits.sort((a, b) => a.start - b.start || a.strand - b.strand)
    motifs.set(name, hits)
  }

  const homopolymers: SequenceScan['homopolymers'] = []
  let i = 0
  while (i < length) {
    let j = i
    while (j < length && seq[j] === seq[i]) j++
    if (j - i >= options.homopolymerMin) {
      homopolymers.push({ start: i, end: j, base: seq[i]!, length: j - i })
    }
    i = j
  }

  const gcWindows: GcWindow[] = []
  const w = Math.max(1, options.gcWindow)
  for (let s = 0; s + w <= length; s += w) {
    gcWindows.push({ start: s, end: s + w, gc: gcContent(seq.slice(s, s + w)) })
  }

  const startCodons: number[] = []
  for (let k = 0; k + 3 <= length; k++) {
    if (seq[k] === 'A' && seq[k + 1] === 'T' && seq[k + 2] === 'G') startCodons.push(k)
  }

  return {
    sequence: seq,
    length,
    motifs,
    homopolymers,
    gcWindows,
    gcOverall: gcContent(seq),
    startCodons,
  }
}

export function hitsIn(scan: SequenceScan, motif: string, start: number, end: number): MotifHit[] {
  return (scan.motifs.get(motif) ?? []).filter((h) => h.start < end && h.end > start)
}
