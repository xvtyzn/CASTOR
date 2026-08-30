/**
 * Where the part picker gets its candidates.
 *
 * The shipped catalogue is one provider. A consuming application supplies its own in-house
 * registry as another — roughly twenty lines against this interface — which is the seam the
 * "which of our projects used this part" requirement needs. The picker renders one tab per
 * provider, so adding a source adds a tab and nothing else changes.
 */
import type { PartId } from '../model/ids.js'
import { partId as toPartId } from '../model/ids.js'
import type { Part } from '../model/part.js'
import type { PartRole } from '../model/slot.js'
import { normalizeSeq } from '../seq/alphabet.js'

export interface PartQuery {
  roles?: PartRole[]
  text?: string
  maxLength?: number
  tags?: string[]
  cursor?: string
  limit?: number
}

export interface PartPage {
  parts: Part[]
  nextCursor?: string
  total?: number
  truncated?: boolean
}

export interface PartProvider {
  id: string
  label: string
  capabilities: { byRole: boolean; freeText: boolean; paste: boolean; paging: boolean }
  /** Role used when a paste-capable provider is opened without a slot role constraint. */
  defaultPasteRole?: PartRole
  search(query: PartQuery, signal?: AbortSignal): Promise<PartPage>
  get(id: PartId, signal?: AbortSignal): Promise<Part | undefined>
}

function matches(part: Part, query: PartQuery): boolean {
  if (query.roles?.length && !query.roles.includes(part.role)) return false
  if (query.maxLength !== undefined && part.length > query.maxLength) return false
  if (query.tags?.length && !query.tags.some((t) => part.tags?.includes(t))) return false
  if (query.text) {
    const needle = query.text.toLowerCase()
    const haystack = [part.name, ...(part.aliases ?? []), part.description ?? '', String(part.id)]
      .join(' ')
      .toLowerCase()
    if (!haystack.includes(needle)) return false
  }
  return true
}

export function staticCatalogProvider(
  parts: readonly Part[],
  options: { id?: string; label?: string } = {},
): PartProvider {
  const index = new Map(parts.map((p) => [p.id, p]))
  return {
    id: options.id ?? 'catalog',
    label: options.label ?? 'Catalogue',
    capabilities: { byRole: true, freeText: true, paste: false, paging: false },
    async search(query) {
      const hits = parts.filter((p) => !p.deprecated && matches(p, query))
      const limit = query.limit ?? hits.length
      return { parts: hits.slice(0, limit), total: hits.length, truncated: hits.length > limit }
    },
    async get(id) {
      return index.get(id)
    },
  }
}

export interface PastedSequenceOptions {
  /** Role assigned to a pasted sequence when the picker does not constrain one. */
  defaultRole?: PartRole
}

/**
 * Turns raw text into a one-off part.
 *
 * Accepts bare sequence or FASTA; anything that is not a base is stripped, and the result is
 * reported so the user can see what was dropped rather than discovering it later.
 */
export function pastedSequenceProvider(options: PastedSequenceOptions = {}): PartProvider {
  return {
    id: 'paste',
    label: 'Paste a sequence',
    capabilities: { byRole: false, freeText: false, paste: true, paging: false },
    defaultPasteRole: options.defaultRole ?? 'custom',
    async search() {
      return { parts: [] }
    },
    async get() {
      return undefined
    },
  }
}

export interface ParsedPaste {
  part: Part
  /** Characters removed because they were not nucleotides. */
  droppedCharacters: number
  /** Name taken from a FASTA header, when there was one. */
  fromFastaHeader: boolean
}

export function parsePastedSequence(
  text: string,
  role: PartRole,
  options: { name?: string; idPrefix?: string } = {},
): ParsedPaste | null {
  const lines = text.split(/\r?\n/)
  let header: string | null = null
  if (lines[0]?.startsWith('>')) header = lines.shift()!.slice(1).trim()

  const raw = lines.join('')
  const sequence = normalizeSeq(raw).replace(/[^ACGTURYSWKMBDHVN]/g, '')
  if (sequence.length === 0) return null

  const name = options.name?.trim() || header || `Pasted ${role}`
  const id = toPartId(`${options.idPrefix ?? 'pasted'}/${slugify(name)}@0.0.0`)

  return {
    droppedCharacters: normalizeSeq(raw).length - sequence.length,
    fromFastaHeader: header !== null,
    part: {
      id,
      name,
      role,
      sequence,
      length: sequence.length,
      checksum: `inline:${sequence.length}`,
      attributes: { role } as Part['attributes'],
      provenance: {
        origin: 'user',
        confidence: 'low',
        note: 'Pasted by the user. Not annotated, not verified against any reference.',
      },
      license: { spdx: 'NOASSERTION', redistributable: false },
      version: '0.0.0',
    },
  }
}

function slugify(s: string): string {
  return s.replace(/[^A-Za-z0-9._+()-]+/g, '-').replace(/^-|-$/g, '') || 'part'
}

/** Presents several providers as one, preserving order. Used for "search everything". */
export function compositeProvider(
  providers: readonly PartProvider[],
  options: { id?: string; label?: string } = {},
): PartProvider {
  return {
    id: options.id ?? 'all',
    label: options.label ?? 'All sources',
    capabilities: {
      byRole: providers.some((p) => p.capabilities.byRole),
      freeText: providers.some((p) => p.capabilities.freeText),
      paste: providers.some((p) => p.capabilities.paste),
      paging: false,
    },
    async search(query, signal) {
      const pages = await Promise.all(providers.map((p) => p.search(query, signal)))
      const seen = new Set<PartId>()
      const parts: Part[] = []
      for (const page of pages) {
        for (const part of page.parts) {
          if (seen.has(part.id)) continue
          seen.add(part.id)
          parts.push(part)
        }
      }
      return { parts, total: parts.length }
    },
    async get(id, signal) {
      for (const p of providers) {
        const hit = await p.get(id, signal)
        if (hit) return hit
      }
      return undefined
    },
  }
}

/** Caches search results for a short window; useful in front of a network-backed registry. */
export function memoizedProvider(provider: PartProvider, ttlMs = 30_000): PartProvider {
  const cache = new Map<string, { at: number; page: PartPage }>()
  return {
    ...provider,
    async search(query, signal) {
      const key = JSON.stringify(query)
      const hit = cache.get(key)
      if (hit && Date.now() - hit.at < ttlMs) return hit.page
      const page = await provider.search(query, signal)
      cache.set(key, { at: Date.now(), page })
      return page
    },
  }
}
