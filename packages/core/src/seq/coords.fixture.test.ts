/**
 * THE GATE TEST.
 *
 * This file does not test our arithmetic — it tests our *beliefs about other people's
 * libraries*. Both conventions below are measured against the real dependency, so that
 * a silent convention change in an upgrade fails here loudly instead of surfacing months
 * later as "the highlight is one base off".
 *
 * Do not replace these with assertions about constants. The point is the round trip
 * through the foreign library.
 */
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { circularRangeLength, circularSlice, teselagen } from './circular.js'

const { getRangeLength, getSequenceWithinRange } = teselagen.raw
import {
  containsPosition,
  fromGenBankRange,
  fromSeqVizRange,
  fromTeselagenRange,
  fromTeselagenRangeSplit,
  isEmptyRange,
  rangeLength,
  rangeOfLength,
  sliceRange,
  toGenBankRange,
  toSeqVizRange,
  toTeselagenRange,
  translateRangeBy,
  type Range,
} from './coords.js'

/** 16 bp, four homopolymer blocks, so a boundary error is visible by eye. */
const SEQ = 'AAAACCCCGGGGTTTT'

/** The three features of the fixture, expressed in OUR convention. */
const FIXTURE: { name: string; range: Range; expected: string }[] = [
  { name: 'blockA', range: { start: 0, end: 4 }, expected: 'AAAA' },
  { name: 'blockC', range: { start: 4, end: 8 }, expected: 'CCCC' },
  { name: 'blockT', range: { start: 12, end: 16 }, expected: 'TTTT' },
]

describe('our convention: 0-based, half-open [start, end)', () => {
  it('sliceRange is the operational definition of a Range', () => {
    for (const f of FIXTURE) {
      expect(sliceRange(SEQ, f.range)).toBe(f.expected)
      expect(sliceRange(SEQ, f.range)).toBe(SEQ.slice(f.range.start, f.range.end))
    }
  })

  it('length is end - start, with no +1 anywhere', () => {
    for (const f of FIXTURE) expect(rangeLength(f.range)).toBe(f.expected.length)
  })

  it('adjacent ranges abut without overlap or gap — the property that makes concatenation additive', () => {
    // blockA ends exactly where blockC begins.
    expect(FIXTURE[0]!.range.end).toBe(FIXTURE[1]!.range.start)
    expect(sliceRange(SEQ, FIXTURE[0]!.range) + sliceRange(SEQ, FIXTURE[1]!.range)).toBe(
      'AAAACCCC',
    )
  })

  it('containment excludes the end position', () => {
    const r = { start: 4, end: 8 }
    expect(containsPosition(r, 4)).toBe(true)
    expect(containsPosition(r, 7)).toBe(true)
    expect(containsPosition(r, 8)).toBe(false)
  })

  it('the empty range is legal and slices to ""', () => {
    expect(isEmptyRange({ start: 3, end: 3 })).toBe(true)
    expect(sliceRange(SEQ, { start: 3, end: 3 })).toBe('')
  })
})

describe('MEASURED: @teselagen/range-utils uses 0-based INCLUSIVE [start, end]', () => {
  it('getSequenceWithinRange({start:0,end:3}) returns 4 bases, not 3', () => {
    // This single assertion is the whole reason toTeselagenRange subtracts one.
    expect(getSequenceWithinRange({ start: 0, end: 3 }, SEQ)).toBe('AAAA')
  })

  it('getRangeLength is end - start + 1', () => {
    expect(getRangeLength({ start: 0, end: 3 }, SEQ.length)).toBe(4)
    expect(getRangeLength({ start: 4, end: 7 }, SEQ.length)).toBe(4)
  })

  it('our own containment helper is used instead of the library\'s, which has a surprising default', () => {
    // @teselagen/range-utils exposes isPositionWithinRange(pos, range, seqLength,
    // includeStartEdge, includeEndEdge). With the edge flags omitted it EXCLUDES the start
    // position -- the opposite of what the name implies. circular.ts deliberately does not
    // re-export it; containsPosition() from coords.ts is the sanctioned helper.
    expect(containsPosition({ start: 0, end: 4 }, 0)).toBe(true)
    expect(containsPosition({ start: 0, end: 4 }, 3)).toBe(true)
    expect(containsPosition({ start: 0, end: 4 }, 4)).toBe(false)
  })

  it('an origin-spanning range is encoded as start > end', () => {
    // indices 14,15,0,1 -> "TT" + "AA"
    expect(getSequenceWithinRange({ start: 14, end: 1 }, SEQ)).toBe('TTAA')
    expect(getRangeLength({ start: 14, end: 1 }, SEQ.length)).toBe(4)
  })

  it('our circular helpers agree with the library on wrapping ranges', () => {
    // Ours: end < start means "wraps". Indices 14,15,0,1.
    expect(circularSlice(SEQ, { start: 14, end: 2 })).toBe('TTAA')
    expect(circularRangeLength({ start: 14, end: 2 }, SEQ.length)).toBe(4)
    // Same span, expressed inclusively, through the library.
    expect(getSequenceWithinRange({ start: 14, end: 1 }, SEQ)).toBe('TTAA')
    expect(getRangeLength({ start: 14, end: 1 }, SEQ.length)).toBe(4)
  })
})

describe('adapter: ours <-> Teselagen', () => {
  it('a converted range selects the SAME bases in the foreign library as in ours', () => {
    // The only test that actually matters. Everything else is bookkeeping.
    for (const f of FIXTURE) {
      const foreign = toTeselagenRange(f.range)
      expect(getSequenceWithinRange(foreign, SEQ)).toBe(sliceRange(SEQ, f.range))
      expect(getRangeLength(foreign, SEQ.length)).toBe(rangeLength(f.range))
    }
  })

  it('round-trips', () => {
    for (const f of FIXTURE) {
      expect(fromTeselagenRange(toTeselagenRange(f.range))).toEqual(f.range)
    }
  })

  it('refuses to encode an empty range rather than producing a bogus origin-spanning one', () => {
    // {start:3,end:3} half-open -> naive {start:3,end:2} inclusive, which Teselagen reads
    // as spanning the origin: bases 3..15 plus 0..2, i.e. the ENTIRE 16 bp sequence.
    // A zero-length range silently becoming a full-length one is exactly the class of bug
    // that surfaces months later as a mysteriously mis-annotated map, so we throw instead.
    expect(() => toTeselagenRange({ start: 3, end: 3 })).toThrow(RangeError)
    expect(getRangeLength({ start: 3, end: 2 }, SEQ.length)).toBe(SEQ.length) // the bug we avoid
  })

  it('splits an origin-spanning foreign range into two half-open ranges', () => {
    const parts = fromTeselagenRangeSplit({ start: 14, end: 1 }, SEQ.length)
    expect(parts).toEqual([
      { start: 14, end: 16 },
      { start: 0, end: 2 },
    ])
    expect(parts.map((p) => sliceRange(SEQ, p)).join('')).toBe(
      getSequenceWithinRange({ start: 14, end: 1 }, SEQ),
    )
  })

  it('rejects a foreign origin-spanning range in the non-splitting adapter', () => {
    expect(() => fromTeselagenRange({ start: 14, end: 1 })).toThrow(RangeError)
  })
})

describe('adapter: ours <-> seqviz (documented half-open; identity on coordinates)', () => {
  it('is the identity, and stays greppable so a seqviz change is a one-line fix', () => {
    for (const f of FIXTURE) {
      expect(toSeqVizRange(f.range)).toEqual({ start: f.range.start, end: f.range.end })
      expect(fromSeqVizRange(toSeqVizRange(f.range))).toEqual(f.range)
    }
  })
})

describe('adapter: ours <-> GenBank (1-based inclusive)', () => {
  it('shifts the start by one and leaves the end alone', () => {
    // GenBank writes blockA as "1..4".
    expect(toGenBankRange({ start: 0, end: 4 })).toEqual({ start: 1, end: 4 })
    expect(toGenBankRange({ start: 4, end: 8 })).toEqual({ start: 5, end: 8 })
  })

  it('round-trips', () => {
    for (const f of FIXTURE) {
      expect(fromGenBankRange(toGenBankRange(f.range))).toEqual(f.range)
    }
  })
})

describe('properties', () => {
  const arbRange = (max = 500) =>
    fc
      .tuple(fc.integer({ min: 0, max }), fc.integer({ min: 1, max: 200 }))
      .map(([start, len]) => rangeOfLength(start, len))

  it('Teselagen round-trip is the identity for every non-empty range', () => {
    fc.assert(
      fc.property(arbRange(), (r) => {
        expect(fromTeselagenRange(toTeselagenRange(r))).toEqual(r)
      }),
    )
  })

  it('GenBank round-trip is the identity for every non-empty range', () => {
    fc.assert(
      fc.property(arbRange(), (r) => {
        expect(fromGenBankRange(toGenBankRange(r))).toEqual(r)
      }),
    )
  })

  it('translation preserves length and the bases selected', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 8 }), fc.integer({ min: 1, max: 8 }), (start, len) => {
        const r = rangeOfLength(start, Math.min(len, SEQ.length - start))
        fc.pre(rangeLength(r) > 0)
        const shifted = translateRangeBy(r, 0)
        expect(rangeLength(shifted)).toBe(rangeLength(r))
        expect(sliceRange(SEQ, shifted)).toBe(sliceRange(SEQ, r))
      }),
    )
  })

  it('concatenating abutting ranges reconstructs the sequence — the invariant assemble() relies on', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 1, maxLength: 6 }), (lens) => {
        const total = lens.reduce((a, b) => a + b, 0)
        const seq = 'ACGT'.repeat(Math.ceil(total / 4)).slice(0, total)
        let cursor = 0
        const ranges = lens.map((len) => {
          const r = rangeOfLength(cursor, len)
          cursor += len
          return r
        })
        expect(cursor).toBe(total)
        expect(ranges.map((r) => sliceRange(seq, r)).join('')).toBe(seq)
      }),
    )
  })
})
