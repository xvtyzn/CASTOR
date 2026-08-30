/**
 * Cart -> ComparisonModel.
 *
 * The comparison view shows the pGOI only: ITR to ITR, backbone excluded. That is the
 * question the user is actually asking ("how do these cassettes differ?"), and it also means
 * the shared backbone does not consume most of the horizontal space.
 */
import type { PartId, RowId } from '../model/ids.js'
import { rowId as toRowId } from '../model/ids.js'
import type { Cart, CartItem } from '../model/cart.js'
import type { ComparisonItem, ComparisonModel, ComparisonRow } from '../model/comparison.js'
import type { Part } from '../model/part.js'
import type { AssemblyResult } from '../seq/assemble.js'
import type { CastorTheme } from '../theme.js'
import { defaultTheme } from '../theme.js'
import { deriveGroups, deriveLinks, type DeriveLinksOptions } from './links.js'

export interface BuildComparisonOptions {
  /** Assembly per cart item, keyed by `CartItem.itemId`. */
  assemblies: Map<string, AssemblyResult>
  parts: (id: PartId) => Part | undefined
  theme?: CastorTheme
  links?: Omit<DeriveLinksOptions, 'order'>
  /** Defaults to cart order. */
  order?: RowId[]
}

function formatKb(bp: number): string {
  return `${(bp / 1000).toFixed(2)} kb`
}

function sublabelFor(item: CartItem, assembly: AssemblyResult): string {
  const c = item.construct
  return `AAV${c.genomeSerotype.replace(/^AAV/, '')}/${c.capsidSerotype.replace(/^AAV/, '')} · ${
    c.packaging
  } · ${formatKb(assembly.cassette.length)}`
}

export function buildComparisonModel(cart: Cart, options: BuildComparisonOptions): ComparisonModel {
  const theme = options.theme ?? defaultTheme
  const rows: ComparisonRow[] = []

  for (const item of cart.items) {
    if (!item.visible) continue
    const assembly = options.assemblies.get(item.itemId)
    if (!assembly) continue

    const rid = toRowId(item.itemId)
    const items: ComparisonItem[] = assembly.cassette.features.map((f) => {
      const instance = assembly.instances.find((i) => i.instanceId === f.instanceId)
      const part = instance ? options.parts(instance.partId) : undefined
      const base: ComparisonItem = {
        uid: `${rid}:${f.instanceId ?? f.id}`,
        instanceId: f.instanceId!,
        partId: instance?.partId ?? (f.id as unknown as PartId),
        name: f.name,
        role: f.role,
        start: f.start,
        end: f.end,
        strand: f.strand,
      }
      if (part?.variantOf) base.variantOf = part.variantOf
      return base
    })

    rows.push({
      id: rid,
      label: item.label ?? item.construct.name,
      sublabel: sublabelFor(item, assembly),
      segments: [
        {
          id: `${rid}:pgoi`,
          label: 'pGOI',
          length: assembly.cassette.length,
          items,
          sequence: assembly.cassette.sequence,
        },
      ],
    })
  }

  const groups = deriveGroups(rows, theme.groupPalette)
  const groupByKey = new Map(groups.map((g) => [g.id, g]))

  // Stamp the group id onto each item so the 'byHomologyGroup' colour mode has something to
  // read, and so legend toggles can hide a whole family.
  for (const row of rows) {
    for (const seg of row.segments) {
      for (const it of seg.items) {
        const key = (it.variantOf ?? it.partId) as unknown as string
        const g = groupByKey.get(key as never)
        if (g) it.groupId = g.id
      }
    }
  }

  const order = options.order ?? rows.map((r) => r.id)
  const links = deriveLinks(rows, { ...(options.links ?? {}), order })

  return { rows, links, groups }
}
