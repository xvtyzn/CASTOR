/**
 * Rendering the sequence at high zoom.
 *
 * The properties that matter here are all about honesty: a base must be drawn at the position
 * it actually occupies, a flipped row must show the strand it is actually displaying, and the
 * view must draw none rather than some when it cannot draw them all.
 */
import { describe, expect, it } from 'vitest'
import { groupId, partId, rowId } from '../model/ids.js'
import type { ComparisonModel } from '../model/comparison.js'
import { reverseComplement } from '../seq/alphabet.js'
import { defaultTheme } from '../theme.js'
import { DEFAULT_GEOM } from './geometry.js'
import { computeLayout, DEFAULT_LAYOUT_OPTIONS } from './layout.js'
import { project } from './project.js'

const SEQ_A = 'ATGCCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAA' // 39 bp
const SEQ_B = 'ATGCCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAA'

function model(): ComparisonModel {
  const mk = (id: string, seq: string) => ({
    id: rowId(id),
    label: id,
    segments: [
      {
        id: `${id}:seg`,
        length: seq.length,
        sequence: seq,
        items: [
          {
            uid: `${id}:cds`,
            instanceId: `${id}-i` as never,
            partId: partId('cds/X@1.0.0'),
            name: 'X',
            role: 'cds' as const,
            start: 0,
            end: seq.length,
            strand: 1 as const,
            groupId: groupId('cds/X@1.0.0'),
          },
        ],
      },
    ],
  })
  return {
    rows: [mk('a', SEQ_A), mk('b', SEQ_B)],
    links: [],
    groups: [
      {
        id: groupId('cds/X@1.0.0'),
        label: 'X',
        color: '#000',
        memberPartIds: [partId('cds/X@1.0.0')],
      },
    ],
  }
}

const PLOT_LEFT = 100

function layoutOf(flipped: Record<string, boolean> = {}) {
  return computeLayout(model(), {
    ...DEFAULT_LAYOUT_OPTIONS,
    order: [rowId('a'), rowId('b')],
    flipped,
    labelGutter: PLOT_LEFT,
    theme: defaultTheme,
  })
}

/** A scale giving exactly `pxPerBase` px per base, starting at the plot's left edge. */
const scaleAt = (pxPerBase: number) => (bp: number) => PLOT_LEFT + bp * pxPerBase

function projectAt(pxPerBase: number, flipped: Record<string, boolean> = {}, width = 600) {
  const layout = layoutOf(flipped)
  return {
    layout,
    px: project(layout, scaleAt(pxPerBase), { width, plotLeft: PLOT_LEFT }, {
      geom: DEFAULT_GEOM,
      rowHeight: DEFAULT_LAYOUT_OPTIONS.rowHeight,
      minLabelWidthPx: 34,
      overscanPx: 0,
    }),
  }
}

describe('sequence rendering', () => {
  it('draws nothing below the legibility threshold, and something above it', () => {
    expect(projectAt(6.9).px.bases).toHaveLength(0)
    expect(projectAt(7).px.bases.length).toBeGreaterThan(0)
  })

  it('reports px per base so the UI can explain itself', () => {
    expect(projectAt(9).px.pxPerBase).toBeCloseTo(9, 6)
  })

  it('places each base at the centre of the span it occupies', () => {
    const { px } = projectAt(10)
    const rowA = px.bases.filter((b) => String(b.rowId) === 'a')
    // Base 0 covers [0, 1) bp, i.e. px 100..110, so its centre is 105.
    expect(rowA[0]!.x).toBeCloseTo(105, 6)
    expect(rowA[1]!.x).toBeCloseTo(115, 6)
    expect(rowA[0]!.base).toBe('A')
    expect(rowA[1]!.base).toBe('T')
  })

  it('reads out the row sequence in order', () => {
    const { px } = projectAt(10)
    const rowA = px.bases.filter((b) => String(b.rowId) === 'a').map((b) => b.base)
    expect(rowA.join('')).toBe(SEQ_A.slice(0, rowA.length))
  })

  it('shows the reverse complement for a flipped row, because that is what is drawn', () => {
    // A flipped row is mirrored on screen; printing the forward strand under mirrored features
    // would answer "what base is here" incorrectly, which is the only thing this data is for.
    const { layout, px } = projectAt(10, { b: true })
    expect(layout.rows.find((r) => String(r.rowId) === 'b')!.sequence).toBe(
      reverseComplement(SEQ_B),
    )
    const rowB = px.bases.filter((b) => String(b.rowId) === 'b').map((b) => b.base)
    expect(rowB.join('')).toBe(reverseComplement(SEQ_B).slice(0, rowB.length))
  })

  it('culls to the viewport rather than emitting the whole sequence', () => {
    // 600 px wide, 100 px gutter, 10 px per base -> at most ~50 bases per row.
    const { px } = projectAt(10, {}, 600)
    const perRow = px.bases.filter((b) => String(b.rowId) === 'a').length
    expect(perRow).toBeLessThanOrEqual(51)
  })

  it('draws no bases at all rather than an arbitrary subset when over budget', () => {
    const layout = layoutOf()
    const px = project(layout, scaleAt(10), { width: 600, plotLeft: PLOT_LEFT }, {
      geom: DEFAULT_GEOM,
      rowHeight: DEFAULT_LAYOUT_OPTIONS.rowHeight,
      minLabelWidthPx: 34,
      overscanPx: 0,
      maxBaseGlyphs: 10,
    })
    expect(px.basesTruncated).toBe(true)
    // Half a figure's sequence is worse than none: the user cannot tell which rows were
    // dropped or why.
    expect(px.bases).toHaveLength(0)
  })

  it('moves part labels above the arrow when bases take the space below', () => {
    const zoomedOut = projectAt(2)
    const zoomedIn = projectAt(10)
    const rowY = zoomedOut.layout.rows[0]!.y
    expect(zoomedOut.px.labels[0]!.y).toBeGreaterThan(rowY)
    expect(zoomedIn.px.labels[0]!.y).toBeLessThan(rowY)
  })

  it('anchoring puts the same sequence position at the same x in every row', () => {
    const m = model()
    // Give row b a 5 bp head start so the rows are naturally out of phase.
    m.rows[1]!.segments[0]!.sequence = 'GGGGG' + SEQ_B
    m.rows[1]!.segments[0]!.length = SEQ_B.length + 5
    m.rows[1]!.segments[0]!.items[0]!.start = 5
    m.rows[1]!.segments[0]!.items[0]!.end = SEQ_B.length + 5

    const layout = computeLayout(m, {
      ...DEFAULT_LAYOUT_OPTIONS,
      order: [rowId('a'), rowId('b')],
      anchor: { partId: partId('cds/X@1.0.0'), justify: 'left' },
      labelGutter: PLOT_LEFT,
      theme: defaultTheme,
    })
    const starts = layout.items.map((i) => i.x0)
    expect(new Set(starts).size).toBe(1)

    const px = project(layout, scaleAt(10), { width: 900, plotLeft: PLOT_LEFT }, {
      geom: DEFAULT_GEOM,
      rowHeight: DEFAULT_LAYOUT_OPTIONS.rowHeight,
      minLabelWidthPx: 34,
      overscanPx: 0,
    })
    // At the x where the anchored CDS starts, both rows must show the same base.
    const cdsX = layout.items[0]!.x0
    const at = (row: string) =>
      px.bases
        .filter((b) => String(b.rowId) === row)
        .filter((b) => Math.abs(b.x - scaleAt(10)(cdsX + 0.5)) < 0.001)
        .map((b) => b.base)
    expect(at('a')).toEqual(['A'])
    expect(at('b')).toEqual(['A'])
  })
})
