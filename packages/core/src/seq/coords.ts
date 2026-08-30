/**
 * The single coordinate convention for @castor-bio/core, and the adapters to every
 * foreign convention we touch.
 *
 * INTERNAL CONVENTION — 0-based, half-open `[start, end)`.
 *   length      = end - start
 *   concatenation is addition (this is the whole reason for the choice: `assemble()`
 *   walks parts accumulating a cursor, and no +1/-1 ever appears in that loop)
 *   `[3, 3)` is a legal empty range at position 3
 *
 * OBSERVED FOREIGN CONVENTIONS (measured, not assumed — see coords.fixture.test.ts):
 *
 *   seqviz            0-based, half-open `[start, end)`.  IDENTITY mapping.
 *                     Documented in its README: "Each `Annotation` requires 0-based
 *                     start (inclusive) and end (exclusive) indexes."
 *
 *   @teselagen/*      0-based, INCLUSIVE `[start, end]`.  length = end - start + 1.
 *                     Origin-spanning ranges are encoded as `start > end`.
 *                     Measured: getSequenceWithinRange({start:0,end:3}, "AAAACCCC...")
 *                     returns "AAAA" (4 bases), and getRangeLength({start:0,end:3}, 16)
 *                     returns 4.
 *
 *   GenBank / EMBL    1-based, INCLUSIVE `[start, end]`.
 *
 * Every boundary crossing goes through a function in this file. Do not inline the
 * arithmetic at a call site; every off-by-one bug in a sequence tool starts that way.
 */

/** A half-open interval in a linear sequence. */
export interface Range {
  /** 0-based, inclusive. */
  start: number
  /** 0-based, exclusive. */
  end: number
}

/** A half-open interval that carries an orientation. */
export interface StrandedRange extends Range {
  strand: 1 | -1
}

/** 0-based inclusive `[start, end]`, the Teselagen shape. `start > end` spans the origin. */
export interface InclusiveRange {
  start: number
  end: number
}

/** 1-based inclusive `[start, end]`, the GenBank shape. */
export interface GenBankRange {
  start: number
  end: number
}

/** A seqviz `AnnotationProp` / `HighlightProp` coordinate pair. Half-open, like ours. */
export interface SeqVizRange {
  start: number
  end: number
}

// ---------------------------------------------------------------------------
// Constructors and predicates
// ---------------------------------------------------------------------------

export function range(start: number, end: number): Range {
  return { start, end }
}

/** A range of `length` bases starting at `start`. */
export function rangeOfLength(start: number, length: number): Range {
  return { start, end: start + length }
}

export function rangeLength(r: Range): number {
  return r.end - r.start
}

export function isEmptyRange(r: Range): boolean {
  return r.end <= r.start
}

/** Half-open containment: `[3, 5)` contains 3 and 4, not 5. */
export function containsPosition(r: Range, position: number): boolean {
  return position >= r.start && position < r.end
}

export function rangesOverlap(a: Range, b: Range): boolean {
  return a.start < b.end && b.start < a.end
}

/** Shift a range along the sequence. Used to lift cassette coords into plasmid coords. */
export function translateRangeBy(r: Range, delta: number): Range {
  return { start: r.start + delta, end: r.end + delta }
}

/**
 * The slice a range denotes. This is the operational definition of the convention:
 * `sliceRange` must always equal `seq.slice(r.start, r.end)`.
 */
export function sliceRange(seq: string, r: Range): string {
  return seq.slice(r.start, r.end)
}

// ---------------------------------------------------------------------------
// Adapters — Teselagen (0-based inclusive)
// ---------------------------------------------------------------------------

/**
 * Half-open -> Teselagen inclusive.
 *
 * An empty range has no inclusive representation (an inclusive range always covers at
 * least one base), so this throws rather than silently producing `{start: n, end: n-1}`,
 * which Teselagen would read as an origin-spanning range covering nearly the whole
 * sequence. Callers must filter empty ranges first.
 */
export function toTeselagenRange(r: Range): InclusiveRange {
  if (isEmptyRange(r)) {
    throw new RangeError(
      `toTeselagenRange: cannot represent the empty range [${r.start}, ${r.end}) as an ` +
        `inclusive range. Filter empty ranges before crossing this boundary.`,
    )
  }
  return { start: r.start, end: r.end - 1 }
}

/**
 * Teselagen inclusive -> half-open.
 *
 * `seqLength` is required only to expand an origin-spanning range (`start > end`), which
 * has no single half-open representation. Pass it whenever the source range could span
 * the origin; use {@link fromTeselagenRangeSplit} when it can.
 */
export function fromTeselagenRange(r: InclusiveRange): Range {
  if (r.end < r.start) {
    throw new RangeError(
      `fromTeselagenRange: [${r.start}, ${r.end}] spans the origin and has no single ` +
        `half-open representation. Use fromTeselagenRangeSplit(r, seqLength).`,
    )
  }
  return { start: r.start, end: r.end + 1 }
}

/**
 * Teselagen inclusive -> one or two half-open ranges.
 * An origin-spanning range becomes `[start, seqLength)` plus `[0, end + 1)`.
 */
export function fromTeselagenRangeSplit(r: InclusiveRange, seqLength: number): Range[] {
  if (r.end >= r.start) return [{ start: r.start, end: r.end + 1 }]
  return [
    { start: r.start, end: seqLength },
    { start: 0, end: r.end + 1 },
  ]
}

// ---------------------------------------------------------------------------
// Adapters — seqviz (0-based half-open; identity on coordinates)
// ---------------------------------------------------------------------------

/**
 * seqviz shares our convention, so this is the identity on numbers. It exists anyway so
 * that the boundary is greppable and so a future seqviz change is a one-line fix here
 * rather than a hunt through the component tree.
 */
export function toSeqVizRange(r: Range): SeqVizRange {
  return { start: r.start, end: r.end }
}

export function fromSeqVizRange(r: SeqVizRange): Range {
  return { start: r.start, end: r.end }
}

// ---------------------------------------------------------------------------
// Adapters — GenBank (1-based inclusive)
// ---------------------------------------------------------------------------

export function toGenBankRange(r: Range): GenBankRange {
  if (isEmptyRange(r)) {
    throw new RangeError(
      `toGenBankRange: cannot represent the empty range [${r.start}, ${r.end}) in GenBank.`,
    )
  }
  return { start: r.start + 1, end: r.end }
}

export function fromGenBankRange(r: GenBankRange): Range {
  return { start: r.start - 1, end: r.end }
}
