import type { GroupId, InstanceId, PartId, RowId } from './ids.js'
import type { PartRole } from './slot.js'

/**
 * The comparison figure's data model, adopted from clustermap.js (clinker's viewer) and
 * typed: cluster -> loci -> genes becomes row -> segments -> items.
 *
 * The important inherited decision is that LINKS ARE BETWEEN ITEM UIDS, not between
 * coordinate ranges. Our homology is known by part identity, so a coordinate-based link
 * model would throw away information and then require an aligner to recover it.
 */

export interface ComparisonItem {
  /** Unique within the figure: `${rowId}:${instanceId}`. */
  uid: string
  instanceId: InstanceId
  partId: PartId
  name: string
  role: PartRole
  /** Half-open `[start, end)` in bp, relative to the segment. */
  start: number
  end: number
  strand: 1 | -1
  groupId?: GroupId
  /** Set when the part is a variant of the group's representative. */
  variantOf?: PartId
}

/** A contiguous stretch of one row. Normally one per row (the pGOI), but the shape allows
 *  multi-locus rows, which dual-AAV designs will need. */
export interface ComparisonSegment {
  id: string
  label?: string
  length: number
  items: ComparisonItem[]
  /**
   * The segment's own sequence, forward strand, `length` bases long.
   *
   * Optional because a caller may build a figure from part identities alone. When present the
   * view can render individual bases once the zoom gives each one enough room, which is what
   * lets you read an actual junction across several designs at once.
   */
  sequence?: string
}

export interface ComparisonRow {
  id: RowId
  label: string
  /** e.g. 'AAV2/9 · ss · 4.31 kb'. */
  sublabel?: string
  segments: ComparisonSegment[]
}

export interface HomologyLink {
  id: string
  /** Item uids. */
  a: string
  b: string
  /** 1 = same part; < 1 = variant family; drives the grey ramp. */
  identity: number
  groupId?: GroupId
  /** Strands differ — the ribbon quad self-crosses into a bowtie. */
  inverted: boolean
}

export interface HomologyGroup {
  id: GroupId
  label: string
  color: string
  hidden?: boolean
  memberPartIds: PartId[]
}

export interface ComparisonModel {
  rows: ComparisonRow[]
  links: HomologyLink[]
  groups: HomologyGroup[]
}
