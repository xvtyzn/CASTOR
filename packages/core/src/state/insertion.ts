/**
 * What can legally go at a given position in the cassette.
 *
 * This is what makes an "insert here" affordance on the map useful rather than a second, worse
 * version of the slot list: clicking between the promoter and the CDS should offer a Kozak, an
 * intron and an N-terminal tag — not all twelve slots, and not a free-text box.
 *
 * "Legally" is the template's cardinality plus the canonical order. It is still advice: the
 * caller may insert anything anywhere, and the ordering rule will report on the result.
 */
import type { Construct, PartInstance } from '../model/construct.js'
import type { CassetteTemplate } from '../model/template.js'
import { canonicalRank, flattenSlots, isSlotSpec, type SlotSpec } from '../model/slot.js'

export interface InsertionSite {
  /** Index in `construct.cassette.parts` where a new instance would be spliced in. */
  index: number
  /** The part immediately before the site, if any. */
  before?: PartInstance
  /** The part immediately after the site, if any. */
  after?: PartInstance
  /** Slots that fit here, in canonical order. */
  slots: SlotSpec[]
}

function countBySlot(parts: readonly PartInstance[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const p of parts) counts.set(String(p.slotKey), (counts.get(String(p.slotKey)) ?? 0) + 1)
  return counts
}

function hasCapacity(slot: SlotSpec, counts: Map<string, number>): boolean {
  if (slot.locked) return false
  const have = counts.get(String(slot.key)) ?? 0
  return slot.max === null || have < slot.max
}

/**
 * @param index where the new part would be spliced in, 0..parts.length
 */
export function insertionSiteAt(
  construct: Construct,
  template: CassetteTemplate,
  index: number,
): InsertionSite {
  const parts = construct.cassette.parts
  const clamped = Math.max(0, Math.min(parts.length, index))
  const before = parts[clamped - 1]
  const after = parts[clamped]
  const counts = countBySlot(parts)

  // Bound by the neighbours' canonical ranks. An unknown neighbour rank (a slot key the
  // template does not define) leaves that side unbounded rather than excluding everything.
  const lo = before ? canonicalRank(before.slotKey) : Number.NEGATIVE_INFINITY
  const hi = after ? canonicalRank(after.slotKey) : Number.POSITIVE_INFINITY
  const loBound = Number.isFinite(lo) ? lo : Number.NEGATIVE_INFINITY
  const hiBound = Number.isFinite(hi) ? hi : Number.POSITIVE_INFINITY

  const slots = flattenSlots(template.nodes.filter(isSlotSpec))
    .filter((slot) => hasCapacity(slot, counts))
    .filter((slot) => {
      const r = canonicalRank(slot.key)
      if (!Number.isFinite(r)) return true
      return r >= loBound && r <= hiBound
    })
    .sort((a, b) => canonicalRank(a.key) - canonicalRank(b.key))

  return {
    index: clamped,
    ...(before ? { before } : {}),
    ...(after ? { after } : {}),
    slots,
  }
}

/** The insertion site immediately before / after a given instance. */
export function insertionSiteAround(
  construct: Construct,
  template: CassetteTemplate,
  instanceId: PartInstance['instanceId'],
  side: 'before' | 'after',
): InsertionSite {
  const i = construct.cassette.parts.findIndex((p) => p.instanceId === instanceId)
  if (i === -1) return insertionSiteAt(construct, template, construct.cassette.parts.length)
  return insertionSiteAt(construct, template, side === 'before' ? i : i + 1)
}

/**
 * Which instance, if any, covers a base position in the cassette; and if none does, the
 * insertion site at that position. Used to turn a click on the map into something actionable.
 */
export function resolveCassettePosition(
  construct: Construct,
  template: CassetteTemplate,
  ranges: Map<PartInstance['instanceId'], { start: number; end: number }>,
  position: number,
): { kind: 'instance'; instance: PartInstance } | { kind: 'site'; site: InsertionSite } {
  const parts = construct.cassette.parts
  for (const part of parts) {
    const r = ranges.get(part.instanceId)
    if (r && position >= r.start && position < r.end) return { kind: 'instance', instance: part }
  }
  // Between parts: count how many parts end at or before the position.
  let index = 0
  for (const part of parts) {
    const r = ranges.get(part.instanceId)
    if (r && r.end <= position) index++
  }
  return { kind: 'site', site: insertionSiteAt(construct, template, index) }
}
