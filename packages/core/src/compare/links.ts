/**
 * Homology links, derived from part identity rather than from sequence alignment.
 *
 * Our constructs are assembled from a known registry, so the link graph is combinatorial:
 * two items are homologous because they are the same catalogue entry, not because an
 * aligner said so. This is the same model clustermap.js uses (gene-uid to gene-uid) and it
 * removes the single heaviest dependency such a tool would otherwise need.
 *
 * Sequence-level linking remains possible later through the injectable `identityOf` hook.
 */
import type { PartId, RowId } from '../model/ids.js'
import { groupId as toGroupId } from '../model/ids.js'
import type {
  ComparisonItem,
  ComparisonRow,
  HomologyGroup,
  HomologyLink,
} from '../model/comparison.js'

export interface DeriveLinksOptions {
  /** Row order, top to bottom. Links are drawn between neighbours in THIS order. */
  order: RowId[]
  /**
   * Only link neighbouring rows. gggenomes' default, and the thing that keeps the figure
   * readable — all-pairs links across a dozen rows is an unreadable smear.
   */
  adjacentOnly?: boolean
  /** Drop links below this identity. */
  minIdentity?: number
  /** Keep only the single best link per item. */
  bestOnly?: boolean
  /**
   * Identity between two items. The default treats an exact part match as 1 and a declared
   * variant relationship as `variantIdentity`; it never claims to have aligned anything.
   */
  identityOf?: (a: ComparisonItem, b: ComparisonItem) => number
  /**
   * Identity assigned to a declared variant pair (WPRE vs WPRE3). A stated estimate, not a
   * measurement — surfaced in the UI as a shaded ribbon, not as a number to quote.
   */
  variantIdentity?: number
}

/** The homology key: the variant root when there is one, otherwise the part itself. */
export function homologyKey(item: ComparisonItem): PartId {
  return item.variantOf ?? item.partId
}

function defaultIdentity(a: ComparisonItem, b: ComparisonItem, variantIdentity: number): number {
  if (a.partId === b.partId) return 1
  if (homologyKey(a) === homologyKey(b)) return variantIdentity
  return 0
}

/**
 * Monotonic assignment between two ordered lists.
 *
 * Every construct carries two ITRs, so a part repeating within a row is the common case,
 * not an edge case; naive all-pairs linking would draw an X between the 5' and 3' ITRs of
 * adjacent rows on every single figure. A monotonic matching cannot cross by construction.
 * We maximise the number of pairs first, then minimise total centre distance, which is what
 * makes {ITR5,ITR3} pair with {ITR5,ITR3} rather than with each other.
 */
export function pairNonCrossing<T extends { start: number; end: number }>(
  a: readonly T[],
  b: readonly T[],
): [T, T][] {
  const n = a.length
  const m = b.length
  if (n === 0 || m === 0) return []

  const centre = (x: { start: number; end: number }) => (x.start + x.end) / 2

  // best[i][j] = { count, cost } for matching a[i..] against b[j..]
  const count: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const d = Math.abs(centre(a[i]!) - centre(b[j]!))
      const matchCount = 1 + count[i + 1]![j + 1]!
      const matchCost = d + cost[i + 1]![j + 1]!
      const skipACount = count[i + 1]![j]!
      const skipACost = cost[i + 1]![j]!
      const skipBCount = count[i]![j + 1]!
      const skipBCost = cost[i]![j + 1]!

      let bestCount = matchCount
      let bestCost = matchCost
      if (skipACount > bestCount || (skipACount === bestCount && skipACost < bestCost)) {
        bestCount = skipACount
        bestCost = skipACost
      }
      if (skipBCount > bestCount || (skipBCount === bestCount && skipBCost < bestCost)) {
        bestCount = skipBCount
        bestCost = skipBCost
      }
      count[i]![j] = bestCount
      cost[i]![j] = bestCost
    }
  }

  const out: [T, T][] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    const d = Math.abs(centre(a[i]!) - centre(b[j]!))
    const matchCount = 1 + count[i + 1]![j + 1]!
    const matchCost = d + cost[i + 1]![j + 1]!
    if (matchCount === count[i]![j] && matchCost === cost[i]![j]) {
      out.push([a[i]!, b[j]!])
      i++
      j++
    } else if (count[i + 1]![j] === count[i]![j] && cost[i + 1]![j] === cost[i]![j]) {
      i++
    } else {
      j++
    }
  }
  return out
}

function itemsOf(row: ComparisonRow): ComparisonItem[] {
  return row.segments.flatMap((s) => s.items)
}

export function deriveLinks(
  rows: readonly ComparisonRow[],
  options: DeriveLinksOptions,
): HomologyLink[] {
  const {
    order,
    adjacentOnly = true,
    minIdentity = 0,
    bestOnly = false,
    variantIdentity = 0.75,
  } = options
  const identityOf = options.identityOf ?? ((a, b) => defaultIdentity(a, b, variantIdentity))

  const byId = new Map(rows.map((r) => [r.id, r]))
  const ordered = order.map((id) => byId.get(id)).filter((r): r is ComparisonRow => !!r)

  const pairs: [ComparisonRow, ComparisonRow][] = []
  if (adjacentOnly) {
    for (let i = 0; i + 1 < ordered.length; i++) pairs.push([ordered[i]!, ordered[i + 1]!])
  } else {
    for (let i = 0; i < ordered.length; i++)
      for (let j = i + 1; j < ordered.length; j++) pairs.push([ordered[i]!, ordered[j]!])
  }

  const links: HomologyLink[] = []

  for (const [rowA, rowB] of pairs) {
    // Bucket by homology key so a variant links to its root, then match monotonically
    // within each bucket.
    const bucketsA = new Map<PartId, ComparisonItem[]>()
    for (const it of itemsOf(rowA)) {
      const k = homologyKey(it)
      const arr = bucketsA.get(k)
      if (arr) arr.push(it)
      else bucketsA.set(k, [it])
    }
    const bucketsB = new Map<PartId, ComparisonItem[]>()
    for (const it of itemsOf(rowB)) {
      const k = homologyKey(it)
      const arr = bucketsB.get(k)
      if (arr) arr.push(it)
      else bucketsB.set(k, [it])
    }

    for (const [key, listA] of bucketsA) {
      const listB = bucketsB.get(key)
      if (!listB) continue
      const sortedA = [...listA].sort((x, y) => x.start - y.start)
      const sortedB = [...listB].sort((x, y) => x.start - y.start)
      for (const [a, b] of pairNonCrossing(sortedA, sortedB)) {
        const identity = identityOf(a, b)
        if (identity <= 0 || identity < minIdentity) continue
        links.push({
          id: `${a.uid}->${b.uid}`,
          a: a.uid,
          b: b.uid,
          identity,
          groupId: toGroupId(String(key)),
          inverted: a.strand !== b.strand,
        })
      }
    }
  }

  if (!bestOnly) return links

  const best = new Map<string, HomologyLink>()
  for (const l of links) {
    for (const uid of [l.a, l.b]) {
      const cur = best.get(uid)
      if (!cur || l.identity > cur.identity) best.set(uid, l)
    }
  }
  const keep = new Set([...best.values()].map((l) => l.id))
  return links.filter((l) => keep.has(l.id))
}

/**
 * Homology groups by single linkage over the link graph, the same construction clinker
 * uses. Because our links come from part identity, the groups are effectively "one group
 * per distinct part", but going through the graph keeps variant families together.
 */
export function deriveGroups(
  rows: readonly ComparisonRow[],
  palette: readonly string[],
): HomologyGroup[] {
  const keys = new Map<PartId, { label: string; members: Set<PartId> }>()
  for (const row of rows) {
    for (const it of itemsOf(row)) {
      const k = homologyKey(it)
      const entry = keys.get(k)
      if (entry) entry.members.add(it.partId)
      else keys.set(k, { label: it.name, members: new Set([it.partId]) })
    }
  }
  return [...keys.entries()].map(([key, v], i) => ({
    id: toGroupId(String(key)),
    label: v.label,
    color: palette[i % palette.length] ?? '#888888',
    memberPartIds: [...v.members],
  }))
}
