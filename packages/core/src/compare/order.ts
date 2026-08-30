/**
 * Row ordering and orientation heuristics.
 *
 * Both are ports of published behaviour rather than inventions: the similarity score is
 * clinker's, and the auto-orientation is gggenomes' `sync()`.
 */
import type { RowId } from '../model/ids.js'
import type { ComparisonItem, ComparisonRow, HomologyLink } from '../model/comparison.js'
import { homologyKey } from './links.js'

export interface Similarity {
  /** Fraction of parts shared between the two rows. */
  h: number
  /** Fraction of adjacent part PAIRS shared — a crude synteny term. */
  s: number
  /** clinker's combined score, S = h + i*s with i = 0.5. */
  S: number
}

const SYNTENY_WEIGHT = 0.5

function items(row: ComparisonRow): ComparisonItem[] {
  return row.segments.flatMap((s) => s.items)
}

function keyMultiset(row: ComparisonRow): Map<string, number> {
  const m = new Map<string, number>()
  for (const it of items(row)) {
    const k = String(homologyKey(it))
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

function adjacentPairs(row: ComparisonRow): Set<string> {
  const out = new Set<string>()
  for (const seg of row.segments) {
    const sorted = [...seg.items].sort((a, b) => a.start - b.start)
    for (let i = 0; i + 1 < sorted.length; i++) {
      out.add(`${homologyKey(sorted[i]!)}|${homologyKey(sorted[i + 1]!)}`)
    }
  }
  return out
}

export function similarity(a: ComparisonRow, b: ComparisonRow): Similarity {
  const ma = keyMultiset(a)
  const mb = keyMultiset(b)
  let shared = 0
  for (const [k, na] of ma) shared += Math.min(na, mb.get(k) ?? 0)
  const total = Math.max(
    [...ma.values()].reduce((x, y) => x + y, 0),
    [...mb.values()].reduce((x, y) => x + y, 0),
  )
  const h = total === 0 ? 0 : shared / total

  const pa = adjacentPairs(a)
  const pb = adjacentPairs(b)
  let sharedPairs = 0
  for (const p of pa) if (pb.has(p)) sharedPairs++
  const totalPairs = Math.max(pa.size, pb.size)
  const s = totalPairs === 0 ? 0 : sharedPairs / totalPairs

  return { h, s, S: h + SYNTENY_WEIGHT * s }
}

/**
 * Greedy seriation: start from the row with the highest total similarity, then repeatedly
 * append whichever remaining row is most similar to the last one placed. Simple, stable and
 * good enough — the alternative (optimal seriation) is NP-hard and buys little at a dozen
 * rows.
 */
export function autoOrder(rows: readonly ComparisonRow[]): RowId[] {
  if (rows.length <= 2) return rows.map((r) => r.id)

  const sim = new Map<string, number>()
  const key = (a: RowId, b: RowId) => `${a}|${b}`
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const { S } = similarity(rows[i]!, rows[j]!)
      sim.set(key(rows[i]!.id, rows[j]!.id), S)
      sim.set(key(rows[j]!.id, rows[i]!.id), S)
    }
  }

  const totals = rows.map((r) => ({
    id: r.id,
    total: rows.reduce((sum, o) => (o.id === r.id ? sum : sum + (sim.get(key(r.id, o.id)) ?? 0)), 0),
  }))
  totals.sort((a, b) => b.total - a.total || String(a.id).localeCompare(String(b.id)))

  const remaining = new Set(rows.map((r) => r.id))
  const out: RowId[] = [totals[0]!.id]
  remaining.delete(totals[0]!.id)

  while (remaining.size > 0) {
    const last = out[out.length - 1]!
    let best: RowId | null = null
    let bestScore = -Infinity
    for (const id of remaining) {
      const score = sim.get(key(last, id)) ?? 0
      // Deterministic tie-break, so golden files stay stable.
      if (score > bestScore || (score === bestScore && best !== null && String(id) < String(best))) {
        best = id
        bestScore = score
      }
    }
    out.push(best!)
    remaining.delete(best!)
  }
  return out
}

/**
 * gggenomes' `sync()`: choose each row's flip state to maximise forward-strand link support
 * against the row above it. Essential for AAV, where a cassette is routinely cloned in
 * either orientation and an unflipped figure is a wall of bow-ties.
 *
 * Walks top to bottom, fixing the first row as the reference.
 */
export function autoFlip(
  rows: readonly ComparisonRow[],
  order: readonly RowId[],
  links: readonly HomologyLink[],
): Record<string, boolean> {
  const byId = new Map(rows.map((r) => [String(r.id), r]))
  const uidRow = new Map<string, string>()
  for (const r of rows) for (const it of items(r)) uidRow.set(it.uid, String(r.id))

  const flipped: Record<string, boolean> = {}
  for (const id of order) flipped[String(id)] = false

  for (let i = 1; i < order.length; i++) {
    const prev = String(order[i - 1]!)
    const cur = String(order[i]!)
    if (!byId.has(cur)) continue

    let forward = 0
    let reverse = 0
    for (const l of links) {
      const ra = uidRow.get(l.a)
      const rb = uidRow.get(l.b)
      if (!ra || !rb) continue
      const spansPair = (ra === prev && rb === cur) || (ra === cur && rb === prev)
      if (!spansPair) continue
      // `inverted` already accounts for the previous row's flip state, because links are
      // derived from the model before flipping; combine with the parent's decision.
      const effectivelyInverted = l.inverted !== (flipped[prev] ?? false)
      if (effectivelyInverted) reverse += l.identity
      else forward += l.identity
    }
    flipped[cur] = reverse > forward
  }
  return flipped
}
