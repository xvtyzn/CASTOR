/**
 * THE ONLY PLACE @teselagen/range-utils IS IMPORTED.
 *
 * Three things about that package make a single wrapper worth the indirection:
 *
 *  1. Its coordinate convention is 0-based INCLUSIVE `[start, end]`, not ours. Every call
 *     needs an adapter, and adapters scattered across call sites are how off-by-ones breed.
 *
 *  2. Its shipped `.d.ts` files are inconsistent — some functions are typed `(...args: any[])
 *     => any`, others declare five parameters where the implementation defaults four of them.
 *     Typing them honestly once is cheaper than fighting them everywhere.
 *
 *  3. Some of its defaults are surprising. `isPositionWithinRange(pos, range)` EXCLUDES the
 *     start position unless you pass `includeStartEdge`, which is the opposite of what the
 *     name suggests. We do not re-export it; use `containsPosition` from coords.ts.
 *
 * Also note the package declares no `main` and no `exports`, so Node resolves it through the
 * deprecated "default index lookup" path (DEP0151). It works today on Node 20–24 and in
 * every bundler, but it is a reason to keep the blast radius to this file.
 */
import {
  getRangeLength as tgGetRangeLength,
  getSequenceWithinRange as tgGetSequenceWithinRange,
  doesRangeSpanOrigin as tgDoesRangeSpanOrigin,
  normalizeRange as tgNormalizeRange,
} from '@teselagen/range-utils'
import {
  fromTeselagenRangeSplit,
  toTeselagenRange,
  type InclusiveRange,
  type Range,
} from './coords.js'

const getRangeLength_ = tgGetRangeLength as (range: InclusiveRange, rangeMax?: number) => number
const getSequenceWithinRange_ = tgGetSequenceWithinRange as (
  range: InclusiveRange,
  sequence: string,
) => string
const doesRangeSpanOrigin_ = tgDoesRangeSpanOrigin as (
  range: InclusiveRange,
  sequenceLength?: number,
) => boolean
const normalizeRange_ = tgNormalizeRange as (
  range: InclusiveRange,
  sequenceLength: number,
) => InclusiveRange

/**
 * Length of a range that may wrap the origin of a circular sequence.
 * Takes and returns OUR convention.
 */
export function circularRangeLength(r: Range, seqLength: number): number {
  if (r.end >= r.start) return r.end - r.start
  // Wrapping range expressed in our half-open terms: [start, seqLength) + [0, end)
  return seqLength - r.start + r.end
}

/** The bases a possibly-wrapping range denotes, in OUR convention. */
export function circularSlice(seq: string, r: Range): string {
  if (r.end >= r.start) return seq.slice(r.start, r.end)
  return seq.slice(r.start) + seq.slice(0, r.end)
}

export function spansOrigin(r: Range): boolean {
  return r.end < r.start
}

/**
 * Bring a range into `[0, seqLength)` after arithmetic has pushed it out of bounds — the
 * case that appears when a plasmid map is rotated for display.
 */
export function normalizeCircularRange(r: Range, seqLength: number): Range {
  const normalized = normalizeRange_(
    { start: mod(r.start, seqLength), end: mod(r.end - 1, seqLength) },
    seqLength,
  )
  const parts = fromTeselagenRangeSplit(normalized, seqLength)
  // Two parts means the range wraps; express that in our convention as end < start.
  return parts.length === 1 ? parts[0]! : { start: parts[0]!.start, end: parts[1]!.end }
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

/**
 * Cross-check helpers, used by the fixture test to prove our arithmetic agrees with the
 * library's on non-wrapping ranges. Not part of the hot path.
 */
export const teselagen = {
  rangeLength: (r: Range, seqLength: number): number =>
    getRangeLength_(toTeselagenRange(r), seqLength),
  slice: (seq: string, r: Range): string => getSequenceWithinRange_(toTeselagenRange(r), seq),
  spansOrigin: (r: InclusiveRange, seqLength: number): boolean =>
    doesRangeSpanOrigin_(r, seqLength),
  raw: {
    getRangeLength: getRangeLength_,
    getSequenceWithinRange: getSequenceWithinRange_,
  },
}
