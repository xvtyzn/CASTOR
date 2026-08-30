/** Nucleotide alphabet operations. Pure, allocation-light, no dependencies. */

const COMPLEMENT: Record<string, string> = {
  A: 'T',
  T: 'A',
  G: 'C',
  C: 'G',
  U: 'A',
  R: 'Y',
  Y: 'R',
  S: 'S',
  W: 'W',
  K: 'M',
  M: 'K',
  B: 'V',
  V: 'B',
  D: 'H',
  H: 'D',
  N: 'N',
  a: 't',
  t: 'a',
  g: 'c',
  c: 'g',
  u: 'a',
  r: 'y',
  y: 'r',
  s: 's',
  w: 'w',
  k: 'm',
  m: 'k',
  b: 'v',
  v: 'b',
  d: 'h',
  h: 'd',
  n: 'n',
}

export function complement(seq: string): string {
  let out = ''
  for (const ch of seq) out += COMPLEMENT[ch] ?? 'N'
  return out
}

export function reverseComplement(seq: string): string {
  let out = ''
  for (let i = seq.length - 1; i >= 0; i--) out += COMPLEMENT[seq[i]!] ?? 'N'
  return out
}

/** Alias matching the vocabulary used throughout the codebase. */
export const revcomp = reverseComplement

export function normalizeSeq(seq: string): string {
  return seq.replace(/\s/g, '').toUpperCase()
}

export function gcContent(seq: string): number {
  if (seq.length === 0) return 0
  let gc = 0
  for (const ch of seq) if (ch === 'G' || ch === 'C' || ch === 'g' || ch === 'c') gc++
  return gc / seq.length
}

/** IUPAC ambiguity code -> the concrete bases it stands for. */
export const IUPAC: Record<string, string> = {
  A: 'A',
  C: 'C',
  G: 'G',
  T: 'T',
  U: 'T',
  R: 'AG',
  Y: 'CT',
  S: 'GC',
  W: 'AT',
  K: 'GT',
  M: 'AC',
  B: 'CGT',
  D: 'AGT',
  H: 'ACT',
  V: 'ACG',
  N: 'ACGT',
}

/**
 * Compile an IUPAC pattern (e.g. `GACNNNNNGTC` for AhdI) into a case-insensitive regex
 * with a lookahead so that OVERLAPPING matches are found. Overlap matters: a run of
 * `AATAAAATAAA` contains two polyadenylation signals, and missing the second one is the
 * difference between a warning and a silent pass.
 */
export function iupacToRegex(pattern: string, flags = 'gi'): RegExp {
  let body = ''
  for (const ch of pattern.toUpperCase()) {
    const bases = IUPAC[ch]
    if (!bases) throw new Error(`iupacToRegex: '${ch}' is not an IUPAC code`)
    body += bases.length === 1 ? bases : `[${bases}]`
  }
  return new RegExp(`(?=(${body}))`, flags)
}

/** All start offsets of an IUPAC pattern, overlaps included. */
export function findMotif(seq: string, pattern: string): number[] {
  const re = iupacToRegex(pattern)
  const out: number[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(seq)) !== null) {
    out.push(m.index)
    re.lastIndex = m.index + 1
  }
  return out
}

const CODON_TABLE: Record<string, string> = {
  TTT: 'F',
  TTC: 'F',
  TTA: 'L',
  TTG: 'L',
  CTT: 'L',
  CTC: 'L',
  CTA: 'L',
  CTG: 'L',
  ATT: 'I',
  ATC: 'I',
  ATA: 'I',
  ATG: 'M',
  GTT: 'V',
  GTC: 'V',
  GTA: 'V',
  GTG: 'V',
  TCT: 'S',
  TCC: 'S',
  TCA: 'S',
  TCG: 'S',
  CCT: 'P',
  CCC: 'P',
  CCA: 'P',
  CCG: 'P',
  ACT: 'T',
  ACC: 'T',
  ACA: 'T',
  ACG: 'T',
  GCT: 'A',
  GCC: 'A',
  GCA: 'A',
  GCG: 'A',
  TAT: 'Y',
  TAC: 'Y',
  TAA: '*',
  TAG: '*',
  CAT: 'H',
  CAC: 'H',
  CAA: 'Q',
  CAG: 'Q',
  AAT: 'N',
  AAC: 'N',
  AAA: 'K',
  AAG: 'K',
  GAT: 'D',
  GAC: 'D',
  GAA: 'E',
  GAG: 'E',
  TGT: 'C',
  TGC: 'C',
  TGA: '*',
  TGG: 'W',
  CGT: 'R',
  CGC: 'R',
  CGA: 'R',
  CGG: 'R',
  AGT: 'S',
  AGC: 'S',
  AGA: 'R',
  AGG: 'R',
  GGT: 'G',
  GGC: 'G',
  GGA: 'G',
  GGG: 'G',
}

/** Translate in frame 0. A codon containing an ambiguity code becomes 'X'. */
export function translate(seq: string): string {
  const s = seq.toUpperCase()
  let out = ''
  for (let i = 0; i + 3 <= s.length; i += 3) out += CODON_TABLE[s.slice(i, i + 3)] ?? 'X'
  return out
}

export const STOP_CODONS = ['TAA', 'TAG', 'TGA'] as const

export function isStopCodon(codon: string): boolean {
  return (STOP_CODONS as readonly string[]).includes(codon.toUpperCase())
}

/** Longest run of a single character, and where it starts. */
export function longestHomopolymer(seq: string): { base: string; start: number; length: number } {
  let best = { base: '', start: 0, length: 0 }
  let i = 0
  while (i < seq.length) {
    let j = i
    while (j < seq.length && seq[j] === seq[i]) j++
    if (j - i > best.length) best = { base: seq[i]!, start: i, length: j - i }
    i = j
  }
  return best
}
