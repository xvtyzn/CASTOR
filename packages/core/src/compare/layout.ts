/**
 * The comparison figure's layout, in BASE PAIRS.
 *
 * gggenomes' central design decision is that the global layout is computed once, up front,
 * as a pure function, and the drawing geoms are dumb. We split it one notch further:
 *
 *   computeLayout  (this file)  bp space, memoised on (model, options) — ordering, row y,
 *                               anchoring, flipping, link filtering, colour assignment
 *   project        (project.ts) px space, called every zoom frame — bp->px, arrowhead
 *                               geometry at the current scale, viewport and label culling
 *
 * That split is what makes x-only zoom geometrically exact. The naive alternative — wrapping
 * everything in `<g transform="scale(k,1)">` — shears every arrowhead and every glyph the
 * moment you zoom. Here the arrowhead is recomputed against the live scale each frame, so a
 * 12 px tip stays a 12 px tip and non-uniform scaling never enters the picture.
 */
import type { GroupId, PartId, RowId } from '../model/ids.js'
import type { PartRole } from '../model/slot.js'
import type { ComparisonModel, ComparisonRow, HomologyLink } from '../model/comparison.js'
import type { CastorTheme } from '../theme.js'
import { defaultTheme } from '../theme.js'
import { reverseComplement } from '../seq/alphabet.js'
import { DEFAULT_GEOM, type GeomOptions } from './geometry.js'
import { groupScale, identityRamp, partTypeScale, type ColorMode } from './colors.js'

export interface LinkPolicy {
  adjacentOnly: boolean
  minIdentity: number
  bestOnly: boolean
  /** Groups the user has hidden via the legend. */
  hiddenGroups: GroupId[]
}

export interface LayoutOptions {
  order: RowId[]
  flipped: Record<string, boolean>
  /** Align every row on this part. gggenomes' `align(.justify=)`. */
  anchor: { partId: PartId; justify: 'left' | 'center' | 'right' } | null
  rowHeight: number
  rowGap: number
  padding: { top: number; right: number; bottom: number; left: number }
  /** Width reserved on the left for row labels, outside the plot area. */
  labelGutter: number
  linkPolicy: LinkPolicy
  colorMode: ColorMode
  geom: GeomOptions
  theme: CastorTheme
}

export const DEFAULT_LAYOUT_OPTIONS: Omit<LayoutOptions, 'order'> = {
  flipped: {},
  anchor: null,
  rowHeight: 34,
  rowGap: 26,
  padding: { top: 16, right: 20, bottom: 42, left: 8 },
  labelGutter: 180,
  linkPolicy: { adjacentOnly: true, minIdentity: 0, bestOnly: false, hiddenGroups: [] },
  colorMode: 'byPartType',
  geom: DEFAULT_GEOM,
  theme: defaultTheme,
}

export interface LaidOutRow {
  rowId: RowId
  y: number
  label: string
  sublabel?: string
  /** Added to every item x in this row, in bp. Non-zero only when anchoring. */
  offsetBp: number
  flipped: boolean
  lengthBp: number
  /**
   * The row's sequence AS DISPLAYED, `lengthBp` bases long, with `offsetBp` still to be added
   * when mapping an index to an x.
   *
   * A flipped row is drawn reverse-complemented, so its sequence is reverse-complemented here
   * too. Showing the forward strand under mirrored features would be a quietly wrong answer to
   * "what base is at this position", which is the only question this data exists to answer.
   */
  sequence?: string
}

export interface LaidOutItem {
  uid: string
  rowId: RowId
  y: number
  /** Base pairs, already offset and flipped. Half-open. */
  x0: number
  x1: number
  strand: 1 | -1
  role: PartRole
  partId: PartId
  fill: string
  stroke: string
  label: string
}

export interface LaidOutRibbon {
  id: string
  aY: number
  bY: number
  /** Base pairs. */
  aX0: number
  aX1: number
  bX0: number
  bX1: number
  inverted: boolean
  fill: string
  opacity: number
}

export interface BpLayout {
  rows: LaidOutRow[]
  items: LaidOutItem[]
  ribbons: LaidOutRibbon[]
  /** bp extent across all rows once offsets are applied. */
  domain: [number, number]
  /** Total drawing height in px, padding included. */
  height: number
  /** Item lookup, so `project` and the React layer never re-scan the array. */
  itemsByUid: Map<string, LaidOutItem>
  /** Every uid that shares a partId, for cross-row hover highlighting. */
  uidsByPartId: Map<PartId, string[]>
}

function rowLength(row: ComparisonRow): number {
  return row.segments.reduce((sum, s) => sum + s.length, 0)
}

export function computeLayout(model: ComparisonModel, options: LayoutOptions): BpLayout {
  const { order, flipped, anchor, rowHeight, rowGap, padding, geom, theme, colorMode } = options

  const byId = new Map(model.rows.map((r) => [r.id, r]))
  const rows = order.map((id) => byId.get(id)).filter((r): r is ComparisonRow => !!r)

  const groupIds = model.groups.map((g) => g.id)
  const byRole = partTypeScale(theme)
  const byGroup = groupScale(theme, groupIds)
  const byIdentity = identityRamp(theme)
  const groupColorOverride = new Map(model.groups.map((g) => [g.id, g.color]))
  const hidden = new Set(options.linkPolicy.hiddenGroups)

  // --- pass 1: per-row geometry in local bp coordinates -------------------------------
  interface Local {
    row: ComparisonRow
    isFlipped: boolean
    length: number
    /** uid -> [x0, x1) in LOCAL bp (flip applied, offset not yet). */
    spans: Map<string, [number, number, 1 | -1]>
    /** Concatenated segment sequences, reverse-complemented when the row is flipped. */
    sequence: string | undefined
  }

  const locals: Local[] = rows.map((row) => {
    const isFlipped = !!flipped[row.id]
    const length = rowLength(row)
    const spans = new Map<string, [number, number, 1 | -1]>()
    let segmentBase = 0
    for (const seg of row.segments) {
      for (const item of seg.items) {
        const s = segmentBase + item.start
        const e = segmentBase + item.end
        if (isFlipped) {
          // Reverse-complementing a row mirrors every feature about the row's midpoint and
          // flips its strand. Ribbons then pick up the inversion automatically.
          spans.set(item.uid, [length - e, length - s, (item.strand * -1) as 1 | -1])
        } else {
          spans.set(item.uid, [s, e, item.strand])
        }
      }
      segmentBase += seg.length
    }

    // Present only when every segment has one; a partial sequence would silently mislabel
    // positions in the segments that do not.
    const parts = row.segments.map((seg) => seg.sequence)
    const joined = parts.every((x) => typeof x === 'string')
      ? (parts as string[]).join('')
      : undefined
    const sequence =
      joined === undefined ? undefined : isFlipped ? reverseComplement(joined) : joined

    return { row, isFlipped, length, spans, sequence }
  })

  // --- pass 2: anchor offsets ---------------------------------------------------------
  // gggenomes `align()`: shift each row so the chosen part lines up. The highest-value
  // single feature in the whole view — it turns a ragged stack into a readable comparison.
  const offsets = new Map<RowId, number>()
  if (anchor) {
    const anchorPos: { rowId: RowId; pos: number }[] = []
    for (const local of locals) {
      const hits = local.row.segments
        .flatMap((s) => s.items)
        .filter((it) => it.partId === anchor.partId)
        .map((it) => local.spans.get(it.uid))
        .filter((v): v is [number, number, 1 | -1] => !!v)
      if (hits.length === 0) continue
      // Several matches are treated as one span from leftmost to rightmost, as gggenomes does.
      const lo = Math.min(...hits.map((h) => h[0]))
      const hi = Math.max(...hits.map((h) => h[1]))
      const pos =
        anchor.justify === 'left' ? lo : anchor.justify === 'right' ? hi : (lo + hi) / 2
      anchorPos.push({ rowId: local.row.id, pos })
    }
    if (anchorPos.length > 0) {
      const target = Math.max(...anchorPos.map((a) => a.pos))
      for (const a of anchorPos) offsets.set(a.rowId, target - a.pos)
    }
  }

  // --- pass 3: emit rows and items ----------------------------------------------------
  const laidRows: LaidOutRow[] = []
  const items: LaidOutItem[] = []
  const itemsByUid = new Map<string, LaidOutItem>()
  const uidsByPartId = new Map<PartId, string[]>()

  let y = padding.top + rowHeight / 2
  for (const local of locals) {
    const offsetBp = offsets.get(local.row.id) ?? 0
    laidRows.push({
      rowId: local.row.id,
      y,
      label: local.row.label,
      ...(local.row.sublabel !== undefined ? { sublabel: local.row.sublabel } : {}),
      offsetBp,
      flipped: local.isFlipped,
      lengthBp: local.length,
      ...(local.sequence !== undefined ? { sequence: local.sequence } : {}),
    })

    for (const seg of local.row.segments) {
      for (const item of seg.items) {
        const span = local.spans.get(item.uid)
        if (!span) continue
        const fill =
          colorMode === 'byHomologyGroup'
            ? (item.groupId && groupColorOverride.get(item.groupId)) ??
              (item.groupId ? byGroup(item.groupId) : byRole(item.role))
            : byRole(item.role)
        const laid: LaidOutItem = {
          uid: item.uid,
          rowId: local.row.id,
          y,
          x0: span[0] + offsetBp,
          x1: span[1] + offsetBp,
          strand: span[2],
          role: item.role,
          partId: item.partId,
          fill,
          stroke: theme.strokeStrong,
          label: item.name,
        }
        items.push(laid)
        itemsByUid.set(laid.uid, laid)
        const arr = uidsByPartId.get(item.partId)
        if (arr) arr.push(laid.uid)
        else uidsByPartId.set(item.partId, [laid.uid])
      }
    }
    y += rowHeight + rowGap
  }

  // --- pass 4: ribbons ----------------------------------------------------------------
  const rowIndex = new Map(laidRows.map((r, i) => [r.rowId, i]))
  const ribbons: LaidOutRibbon[] = []

  for (const link of model.links) {
    if (link.identity < options.linkPolicy.minIdentity) continue
    if (link.groupId && hidden.has(link.groupId)) continue
    const a = itemsByUid.get(link.a)
    const b = itemsByUid.get(link.b)
    if (!a || !b) continue
    const ia = rowIndex.get(a.rowId)
    const ib = rowIndex.get(b.rowId)
    if (ia === undefined || ib === undefined) continue
    if (options.linkPolicy.adjacentOnly && Math.abs(ia - ib) !== 1) continue

    // Always draw from the upper row to the lower one so the inset signs stay consistent.
    const [top, bottom] = ia <= ib ? [a, b] : [b, a]
    const fill =
      colorMode === 'byIdentity'
        ? byIdentity(link.identity)
        : colorMode === 'byHomologyGroup'
          ? (link.groupId && groupColorOverride.get(link.groupId)) ?? theme.strokeMuted
          : theme.strokeMuted

    ribbons.push({
      id: link.id,
      aY: top.y,
      bY: bottom.y,
      aX0: top.x0,
      aX1: top.x1,
      bX0: bottom.x0,
      bX1: bottom.x1,
      inverted: link.inverted,
      fill,
      // Ribbons sit under the arrows; full opacity would swamp them.
      opacity: 0.45 + 0.3 * Math.max(0, Math.min(1, link.identity)),
    })
  }

  // --- extent -------------------------------------------------------------------------
  let lo = 0
  let hi = 0
  for (const r of laidRows) {
    lo = Math.min(lo, r.offsetBp)
    hi = Math.max(hi, r.offsetBp + r.lengthBp)
  }
  if (laidRows.length === 0) hi = 1

  const height =
    laidRows.length === 0
      ? padding.top + padding.bottom
      : padding.top + laidRows.length * rowHeight + (laidRows.length - 1) * rowGap + padding.bottom

  return {
    rows: laidRows,
    items,
    ribbons,
    domain: [lo, hi],
    height,
    itemsByUid,
    uidsByPartId,
  }
}

/** Unused rows in the model, so the UI can offer "add to figure". */
export function missingRows(model: ComparisonModel, order: readonly RowId[]): ComparisonRow[] {
  const inOrder = new Set<string>(order as readonly string[])
  return model.rows.filter((r) => !inOrder.has(r.id))
}

export type { HomologyLink }
