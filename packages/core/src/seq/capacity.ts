/**
 * AAV packaging capacity — the single most important domain-specific readout in the tool.
 *
 * All thresholds are DATA with sources attached, never bare constants, because a user who
 * trusts a green meter and loses three months deserves to be able to see where the number
 * came from.
 */
import type { Citation } from '../model/provenance.js'

export type CapacityBand =
  | 'underfilled'
  | 'low'
  | 'optimal'
  | 'near-limit'
  | 'over-limit'
  | 'error'

export const CAPACITY_SEVERITY: Record<CapacityBand, 'ok' | 'info' | 'warning' | 'error'> = {
  underfilled: 'info',
  low: 'ok',
  optimal: 'ok',
  'near-limit': 'warning',
  'over-limit': 'warning',
  error: 'error',
}

interface BandSpec {
  band: CapacityBand
  /** Half-open on the upper end: applies while `itrToItr < max`. */
  max: number
  message: string
}

/** Single-stranded AAV, measured ITR-to-ITR inclusive of both ITRs. */
export const SS_BANDS: readonly BandSpec[] = [
  {
    band: 'underfilled',
    max: 2400,
    message:
      'Below ~2.4 kb a large fraction of particles are overfilled (two genomes packaged). ' +
      'Consider adding a stuffer to reach 3.0–4.4 kb.',
  },
  { band: 'low', max: 3000, message: 'Packages, but below the cleanest size window.' },
  {
    band: 'optimal',
    max: 4400,
    message: 'Optimal: minimal partial and overfilled particles.',
  },
  {
    band: 'near-limit',
    max: 4700,
    message:
      'Approaching the classic ~4.7 kb packaging limit (Dong et al. 1996). Titre typically falls.',
  },
  {
    band: 'over-limit',
    max: 5000,
    message:
      'Above the wild-type genome size. Expect heterogeneous 5′-truncated genomes, a high ' +
      'partial-particle fraction and substantial yield loss.',
  },
  {
    band: 'error',
    max: Number.POSITIVE_INFINITY,
    message:
      'Beyond ~5.0–5.2 kb, genomes are not packaged intact regardless of capsid. Split the ' +
      'cargo (dual-AAV overlap / trans-splicing / hybrid / split-intein) or shorten it.',
  },
]

/** Self-complementary AAV: the genome is an inverted repeat, so capacity roughly halves. */
export const SC_BANDS: readonly BandSpec[] = [
  {
    band: 'underfilled',
    max: 1200,
    message: 'Very small scAAV genome; overfilled particles are likely.',
  },
  { band: 'optimal', max: 2200, message: 'Optimal for self-complementary AAV.' },
  {
    band: 'near-limit',
    max: 2400,
    message: 'At the scAAV capacity ceiling (~2.2–2.4 kb between ITRs).',
  },
  {
    band: 'error',
    max: Number.POSITIVE_INFINITY,
    message:
      'Exceeds scAAV capacity. Switch to single-stranded packaging or shorten the cassette.',
  },
]

export const CAPACITY_CITATIONS: Citation[] = [
  {
    title: 'Quantitative analysis of the packaging capacity of recombinant adeno-associated virus',
    pmid: '8934224',
    year: 1996,
    url: 'https://pubmed.ncbi.nlm.nih.gov/8934224/',
  },
  {
    title: 'Packaging capacity of adeno-associated virus serotypes: impact of larger genomes',
    doi: '10.1128/jvi.79.15.9933-9944.2005',
    year: 2005,
    url: 'https://journals.asm.org/doi/full/10.1128/jvi.79.15.9933-9944.2005',
  },
  {
    title:
      'AAV vector yield, bioactivity and particle heterogeneity as a function of genome size',
    year: 2025,
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12207685/',
  },
]

export interface CapacityReport {
  /** ITR-to-ITR, inclusive of both ITRs. The number packaging limits refer to. */
  itrToItr: number
  /** The user-editable payload: itrToItr minus both ITRs. */
  cargo: number
  packaging: 'ss' | 'sc'
  band: CapacityBand
  severity: 'ok' | 'info' | 'warning' | 'error'
  /** The size beyond which nothing packages intact. */
  limit: number
  optimalRange: [number, number]
  message: string
  /** `limit - itrToItr`; negative when over. */
  headroom: number
  citations: Citation[]
}

const SS_LIMIT = 5000
const SC_LIMIT = 2400
const SS_OPTIMAL: [number, number] = [3000, 4400]
const SC_OPTIMAL: [number, number] = [1200, 2200]

/**
 * @param itrToItr total assembled cassette length, ITRs included
 * @param itrLength combined length of the two ITRs, read from the actual parts rather than
 *        assumed — AAV2 ITRs ship as both the 145 nt wild-type and the 130 nt "stable" form
 */
export function computeCapacity(
  itrToItr: number,
  itrLength: number,
  packaging: 'ss' | 'sc',
): CapacityReport {
  const bands = packaging === 'sc' ? SC_BANDS : SS_BANDS
  const limit = packaging === 'sc' ? SC_LIMIT : SS_LIMIT
  const optimalRange = packaging === 'sc' ? SC_OPTIMAL : SS_OPTIMAL

  const spec = bands.find((b) => itrToItr < b.max) ?? bands[bands.length - 1]!

  return {
    itrToItr,
    cargo: Math.max(0, itrToItr - itrLength),
    packaging,
    band: spec.band,
    severity: CAPACITY_SEVERITY[spec.band],
    limit,
    optimalRange,
    message: spec.message,
    headroom: limit - itrToItr,
    citations: CAPACITY_CITATIONS,
  }
}
