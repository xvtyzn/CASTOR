/**
 * The shipped catalogue.
 *
 * Everything here is static JSON bundled into the package. There is no network access at
 * runtime, by design: Addgene sends no CORS header and its API is token-gated behind a data
 * licence, so a browser-only library cannot call it. Provenance — Addgene ids, PMIDs, the
 * construct a part was used in — is baked in at curation time and rendered as outbound links.
 *
 * Collections are loaded through per-role dynamic imports so an app that only ever shows
 * promoters does not ship the CDS collection. JSON does not tree-shake, so this is the only
 * mechanism that actually keeps the payload down.
 */
import type {
  Backbone,
  CassetteTemplate,
  Part,
  PartId,
  PartRole,
} from '@castor-bio/core'

export interface CatalogBundle {
  parts: Part[]
  backbones: Backbone[]
  templates: CassetteTemplate[]
}

/** Roles that have a shipped collection file. */
export const AVAILABLE_COLLECTIONS = [
  'cds',
  'itr',
  'joiner',
  'kozak',
  'linker',
  'polya',
  'promoter',
  'switch',
  'tag',
  'wpre',
] as const satisfies readonly PartRole[]

export type AvailableCollection = (typeof AVAILABLE_COLLECTIONS)[number]

type PartFile = { collection: string; version?: string; parts: Part[] }

/**
 * Note the absence of an `with: { type: 'json' }` import attribute.
 *
 * The attribute makes a browser enforce a JSON MIME type on the response, but every bundler
 * in practice — Vite, webpack, Rollup — transforms a .json import into a JavaScript module and
 * serves it as text/javascript. With the attribute present the browser rejects it and the
 * whole catalogue fails to load. Node honours the attribute correctly, so this only shows up
 * in a real browser, never in a Node test run.
 */

const LOADERS: Record<AvailableCollection, () => Promise<{ default: PartFile }>> = {
  cds: () => import('../data/parts/cds.json') as never,
  itr: () => import('../data/parts/itr.json') as never,
  joiner: () => import('../data/parts/joiner.json') as never,
  kozak: () => import('../data/parts/kozak.json') as never,
  linker: () => import('../data/parts/linker.json') as never,
  polya: () => import('../data/parts/polya.json') as never,
  promoter: () => import('../data/parts/promoter.json') as never,
  switch: () => import('../data/parts/switch.json') as never,
  tag: () => import('../data/parts/tag.json') as never,
  wpre: () => import('../data/parts/wpre.json') as never,
}

export async function loadParts(
  collections: readonly AvailableCollection[] = AVAILABLE_COLLECTIONS,
): Promise<Part[]> {
  const files = await Promise.all(collections.map((c) => LOADERS[c]()))
  return files.flatMap((f) => f.default.parts)
}

export async function loadBackbones(): Promise<Backbone[]> {
  const mod = (await import('../data/backbones.json')) as never as {
    default: { backbones: Backbone[] }
  }
  return mod.default.backbones
}

export async function loadTemplates(): Promise<CassetteTemplate[]> {
  const mod = (await import('../data/templates.json')) as never as {
    default: { templates: CassetteTemplate[] }
  }
  return mod.default.templates
}

export async function loadCatalog(
  collections?: readonly AvailableCollection[],
): Promise<CatalogBundle> {
  const [parts, backbones, templates] = await Promise.all([
    loadParts(collections),
    loadBackbones(),
    loadTemplates(),
  ])
  return { parts, backbones, templates }
}

/** Index a bundle for O(1) lookup, which is what `assemble` wants. */
export function indexParts(parts: readonly Part[]): Map<PartId, Part> {
  return new Map(parts.map((p) => [p.id, p]))
}
