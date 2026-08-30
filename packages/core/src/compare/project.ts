/**
 * bp -> px, once per zoom frame.
 *
 * Everything here is O(n) arithmetic over the layout. It is the only part of the comparison
 * pipeline that runs on every pointer move during a pan, so it culls aggressively and
 * allocates as little as it can. The CI bench holds it under 2 ms for 40 rows x 20 parts.
 */
import type { PartId, RowId } from '../model/ids.js'
import { arrowPolygon, linkQuad, linkRibbonPath, pointsAttr, type GeomOptions } from './geometry.js'
import type { BpLayout } from './layout.js'

export interface Viewport {
  width: number
  /** Left edge of the plot area in px; labels live to the left of it. */
  plotLeft: number
}

export interface ProjectOptions {
  geom: GeomOptions
  rowHeight: number
  /**
   * Below this width in px an arrow gets no label. Text is by far the most expensive SVG
   * node — culling labels, not shapes, is what keeps a 40-row figure smooth.
   */
  minLabelWidthPx: number
  /** Extra px of margin outside the viewport kept rendered, so panning does not pop. */
  overscanPx: number
  /** Average glyph width of the label font, used for collision culling. */
  charWidthPx?: number
  /**
   * Below this many px per base, individual bases are not drawn. Seven is about where a
   * monospace glyph stops being legible; there is no point emitting thousands of nodes to
   * render a grey smear.
   */
  minPxPerBase?: number
  /**
   * Hard cap on base glyphs across the whole figure. Text is the most expensive SVG node
   * there is, and forty rows of zoomed-in sequence would produce tens of thousands of them.
   * Past the cap we draw none and say so, rather than dropping some rows and leaving the user
   * to wonder why one design has no sequence.
   */
  maxBaseGlyphs?: number
  /** Items to draw with the selection treatment. */
  highlightedUids?: ReadonlySet<string>
  /** When set, everything not highlighted is dimmed. */
  dimUnhighlighted?: boolean
}

export const DEFAULT_PROJECT_OPTIONS: Omit<ProjectOptions, 'geom' | 'rowHeight'> = {
  minLabelWidthPx: 34,
  overscanPx: 200,
  charWidthPx: 5.6,
  minPxPerBase: 7,
  maxBaseGlyphs: 6000,
}

export interface ProjectedArrow {
  uid: string
  rowId: RowId
  partId: PartId
  points: string
  fill: string
  stroke: string
  opacity: number
  /** px, for hit-testing and tooltip placement. */
  x0: number
  x1: number
  y: number
}

export interface ProjectedRibbon {
  id: string
  /** Set for the straight style. */
  points?: string
  /** Set for the curved style. */
  d?: string
  fill: string
  opacity: number
}

/** One rendered base. Emitted only when the zoom gives each base enough room to read. */
export interface ProjectedBase {
  rowId: RowId
  /** Centre of the base, in px. */
  x: number
  y: number
  base: string
  /** Font size that fits the current bp width, in px. */
  fontSize: number
}

export interface ProjectedLabel {
  uid: string
  x: number
  y: number
  text: string
  anchor: 'middle'
}

export interface ProjectedRowLabel {
  rowId: RowId
  y: number
  label: string
  sublabel?: string
  flipped: boolean
}

export interface ProjectedBackbone {
  rowId: RowId
  x0: number
  x1: number
  y: number
}

export interface PxLayout {
  arrows: ProjectedArrow[]
  ribbons: ProjectedRibbon[]
  labels: ProjectedLabel[]
  rowLabels: ProjectedRowLabel[]
  backbones: ProjectedBackbone[]
  /** Individual bases, present only above `minPxPerBase`. Empty otherwise. */
  bases: ProjectedBase[]
  /** px per base at the current zoom, so the UI can explain why bases are or are not shown. */
  pxPerBase: number
  /** True when bases were suppressed because the glyph budget would have been exceeded. */
  basesTruncated: boolean
  height: number
}

export function project(
  layout: BpLayout,
  xScale: (bp: number) => number,
  viewport: Viewport,
  options: ProjectOptions,
): PxLayout {
  const {
    geom,
    rowHeight,
    minLabelWidthPx,
    overscanPx,
    highlightedUids,
    dimUnhighlighted,
    charWidthPx = 5.6,
    minPxPerBase = 7,
    maxBaseGlyphs = 6000,
  } = options
  const left = viewport.plotLeft - overscanPx
  const right = viewport.plotLeft + viewport.width + overscanPx

  const pxPerBase = xScale(1) - xScale(0)
  // Two tiers, never both in the same place: zoomed out, a part's name sits under its arrow;
  // zoomed in far enough to read bases, the sequence takes that spot and the names move above.
  const showBases = pxPerBase >= minPxPerBase
  const belowY = geom.bodyHeight / 2 + geom.tipHeight + 10
  const aboveY = -(geom.bodyHeight / 2 + geom.tipHeight + 5)

  const backbones: ProjectedBackbone[] = layout.rows.map((r) => ({
    rowId: r.rowId,
    x0: xScale(r.offsetBp),
    x1: xScale(r.offsetBp + r.lengthBp),
    y: r.y,
  }))

  const arrows: ProjectedArrow[] = []
  const labels: ProjectedLabel[] = []
  // Labels are culled left to right, per row, against the right edge of the last one kept.
  // Width alone is not sufficient: a 221 bp polyA next to a 145 bp ITR clears any per-segment
  // threshold and then the two centred labels sit on top of each other, which is what every
  // real cassette does at its 3' end.
  const lastLabelRight = new Map<RowId, number>()

  for (const item of layout.items) {
    const x0 = xScale(item.x0)
    const x1 = xScale(item.x1)
    if (x1 < left || x0 > right) continue // viewport cull

    const highlighted = highlightedUids?.has(item.uid) ?? false
    const opacity = dimUnhighlighted && !highlighted ? 0.25 : 1

    arrows.push({
      uid: item.uid,
      rowId: item.rowId,
      partId: item.partId,
      points: pointsAttr(arrowPolygon(x0, x1, item.y, item.strand, geom)),
      fill: item.fill,
      stroke: highlighted ? item.stroke : item.stroke,
      opacity,
      x0,
      x1,
      y: item.y,
    })

    // Label culling: the shape stays, the text goes.
    if (x1 - x0 >= minLabelWidthPx) {
      const text = item.label
      const halfText = (text.length * charWidthPx) / 2
      const centre = (x0 + x1) / 2
      const prevRight = lastLabelRight.get(item.rowId) ?? Number.NEGATIVE_INFINITY
      if (centre - halfText >= prevRight + 4) {
        lastLabelRight.set(item.rowId, centre + halfText)
        labels.push({
          uid: item.uid,
          x: centre,
          y: item.y + (showBases ? aboveY : belowY),
          text,
          anchor: 'middle',
        })
      }
    }
  }

  const ribbons: ProjectedRibbon[] = []
  for (const r of layout.ribbons) {
    const aX0 = xScale(r.aX0)
    const aX1 = xScale(r.aX1)
    const bX0 = xScale(r.bX0)
    const bX1 = xScale(r.bX1)
    if (Math.max(aX1, bX1) < left || Math.min(aX0, bX0) > right) continue

    if (geom.linkStyle === 'curved') {
      ribbons.push({
        id: r.id,
        d: linkRibbonPath(aX0, aX1, r.aY, bX0, bX1, r.bY, r.inverted, geom, rowHeight),
        fill: r.fill,
        opacity: r.opacity,
      })
    } else {
      ribbons.push({
        id: r.id,
        points: pointsAttr(
          linkQuad(aX0, aX1, r.aY, bX0, bX1, r.bY, r.inverted, geom, rowHeight),
        ),
        fill: r.fill,
        opacity: r.opacity,
      })
    }
  }

  // --- bases -----------------------------------------------------------------------------
  // One <text> per base, positioned at the base's centre. A single stretched <text> per row
  // would be far cheaper, but SVG's textLength distributes slack between glyphs rather than
  // placing each one on its own base, and in a sequence tool "which base is under this
  // boundary" has to be exactly right. The viewport cull keeps the count small in practice.
  const bases: ProjectedBase[] = []
  let basesTruncated = false

  if (showBases) {
    const visibleLeft = viewport.plotLeft
    const visibleRight = viewport.plotLeft + viewport.width
    let budget = maxBaseGlyphs

    const planned: ProjectedBase[] = []
    outer: for (const row of layout.rows) {
      const seq = row.sequence
      if (!seq) continue
      // Solve for the base indices whose centres fall inside the viewport.
      const firstBp = Math.max(0, Math.floor(invert(xScale, visibleLeft) - row.offsetBp) - 1)
      const lastBp = Math.min(seq.length, Math.ceil(invert(xScale, visibleRight) - row.offsetBp) + 1)
      for (let i = firstBp; i < lastBp; i++) {
        if (planned.length >= budget) {
          basesTruncated = true
          break outer
        }
        planned.push({
          rowId: row.rowId,
          x: xScale(row.offsetBp + i + 0.5),
          y: row.y + belowY,
          base: seq[i]!,
          fontSize: Math.min(13, pxPerBase * 0.95),
        })
      }
    }
    if (!basesTruncated) bases.push(...planned)
  }

  const rowLabels: ProjectedRowLabel[] = layout.rows.map((r) => ({
    rowId: r.rowId,
    y: r.y,
    label: r.label,
    ...(r.sublabel !== undefined ? { sublabel: r.sublabel } : {}),
    flipped: r.flipped,
  }))

  return {
    arrows,
    ribbons,
    labels,
    rowLabels,
    backbones,
    bases,
    pxPerBase,
    basesTruncated,
    height: layout.height,
  }
}

/** Inverse of a linear bp -> px scale, recovered from two samples. */
function invert(xScale: (bp: number) => number, px: number): number {
  const x0 = xScale(0)
  const perBase = xScale(1) - x0
  return perBase === 0 ? 0 : (px - x0) / perBase
}
