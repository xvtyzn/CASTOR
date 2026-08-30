/**
 * The lab registry, assembled from the archive.
 *
 * This is the whole integration: take the constructs a group already has, work out which parts
 * each one used, and hand the picker parts whose `provenance.usages` say where they came from.
 * Everything downstream — the "Where this has been used" panel, the ordering, the counts — is
 * the library reading those records.
 *
 * In a real deployment `search` and `get` would call your API instead of reading these arrays.
 * Nothing else changes.
 */
import { staticCatalogProvider, type Part, type PartProvider, type Usage } from '@castor-bio/core'
import { ARCHIVE, PROJECTS, type ArchivedConstruct } from './projects.js'
import { EXAMPLE_PARTS } from './example-parts.js'

export { PROJECTS, ARCHIVE, EXAMPLE_PARTS }

const projectById = new Map(PROJECTS.map((p) => [p.id, p]))

function usageFor(construct: ArchivedConstruct): Usage {
  const project = projectById.get(construct.projectId)
  return {
    kind: 'project',
    title: project?.name ?? construct.projectId,
    projectId: construct.projectId,
    team: project?.team,
    owner: project?.lead,
    year: project?.year,
    constructName: construct.name,
    ...(construct.note ? { note: construct.note } : {}),
  }
}

/** partId -> the constructs that used it, each counted once however often it appears. */
export function buildUsageIndex(): Map<string, Usage[]> {
  const index = new Map<string, Usage[]>()
  for (const construct of ARCHIVE) {
    const usage = usageFor(construct)
    // A DIO cassette carries loxP four times; that is one construct, not four.
    for (const id of new Set(construct.partIds)) {
      const list = index.get(id)
      if (list) list.push(usage)
      else index.set(id, [usage])
    }
  }
  return index
}

export interface UsageSummary {
  projects: number
  constructs: number
  /** True when every construct that used this part belongs to one project. */
  projectUnique: boolean
  lastYear?: number
}

export function summarise(usages: readonly Usage[] | undefined): UsageSummary {
  if (!usages?.length) return { projects: 0, constructs: 0, projectUnique: false }
  const projects = new Set(usages.map((u) => u.projectId ?? u.title))
  const years = usages.map((u) => u.year).filter((y): y is number => typeof y === 'number')
  return {
    projects: projects.size,
    constructs: usages.length,
    projectUnique: projects.size === 1,
    ...(years.length ? { lastYear: Math.max(...years) } : {}),
  }
}

/**
 * Merge the archive's history onto whatever the shipped catalogue already knows.
 *
 * Curated provenance is kept and the project records are appended, so a part like EGFP shows
 * both where its sequence came from and which of your experiments used it. That combination is
 * the point: neither half answers "should I use this one" on its own.
 */
export function withProjectHistory(catalogParts: readonly Part[]): Part[] {
  const usages = buildUsageIndex()
  const merged = new Map<string, Part>()

  for (const part of [...catalogParts, ...EXAMPLE_PARTS]) {
    const history = usages.get(String(part.id))
    merged.set(String(part.id), {
      ...part,
      provenance: {
        ...part.provenance,
        usages: [...(part.provenance.usages ?? []), ...(history ?? [])],
      },
    })
  }
  return [...merged.values()]
}

/**
 * Candidates ordered by how established they are: parts used across the most projects first,
 * then by how many constructs, then alphabetically. In a registry with real history that
 * ordering is most of the value — the thing five projects already used is usually the thing
 * you want, and the one-off is usually the thing you need to look at carefully.
 */
export function labRegistryProvider(catalogParts: readonly Part[]): PartProvider {
  const parts = withProjectHistory(catalogParts)
  const inner = staticCatalogProvider(parts, { id: 'lab', label: 'Our lab' })

  const rank = (part: Part) => {
    const s = summarise(part.provenance.usages?.filter((u) => u.kind === 'project'))
    return s
  }

  return {
    ...inner,
    async search(query, signal) {
      const page = await inner.search(query, signal)
      const sorted = [...page.parts].sort((a, b) => {
        const ra = rank(a)
        const rb = rank(b)
        return (
          rb.projects - ra.projects ||
          rb.constructs - ra.constructs ||
          (rb.lastYear ?? 0) - (ra.lastYear ?? 0) ||
          a.name.localeCompare(b.name)
        )
      })
      return { ...page, parts: sorted }
    },
  }
}
