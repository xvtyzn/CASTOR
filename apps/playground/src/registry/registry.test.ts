/**
 * The archive -> usages derivation.
 *
 * This is example data, but the logic that turns a pile of constructs into "which projects used
 * this part" is exactly what a real integration writes, so it is worth holding to the same
 * standard as the library.
 */
import { describe, expect, it } from 'vitest'
import { loadCatalog } from '@castor-bio/catalog'
import { indexBy, partId, type Part } from '@castor-bio/core'
import { ARCHIVE, EXAMPLE_PARTS, PROJECTS, buildUsageIndex, labRegistryProvider, summarise, withProjectHistory } from './index.js'

const catalog = await loadCatalog()
const known = new Set<string>([
  ...catalog.parts.map((p) => String(p.id)),
  ...EXAMPLE_PARTS.map((p) => String(p.id)),
])

describe('the archive', () => {
  it('only references parts that exist', () => {
    for (const construct of ARCHIVE) {
      for (const id of construct.partIds) {
        expect(known.has(id), `${construct.name} references unknown part ${id}`).toBe(true)
      }
    }
  })

  it('names a project that exists', () => {
    const ids = new Set(PROJECTS.map((p) => p.id))
    for (const c of ARCHIVE) expect(ids.has(c.projectId), `${c.name}: ${c.projectId}`).toBe(true)
  })

  it('every construct runs ITR to ITR', () => {
    for (const c of ARCHIVE) {
      expect(c.partIds[0], c.name).toBe('itr/AAV2-ITR-145-flip@1.0.0')
      expect(c.partIds.at(-1), c.name).toBe('itr/AAV2-ITR-145-3prime@1.0.0')
    }
  })

  it('contains both shared and project-unique parts, which is the whole point', () => {
    const index = buildUsageIndex()
    const summaries = [...index.values()].map((u) => summarise(u))
    expect(summaries.some((s) => s.projects >= 3)).toBe(true)
    expect(summaries.some((s) => s.projectUnique)).toBe(true)
  })
})

describe('usage derivation', () => {
  const index = buildUsageIndex()

  it('counts a part once per construct, however often it appears in it', () => {
    // The DIO cassettes carry loxP four times each; that is one usage per construct.
    const dioConstructs = ARCHIVE.filter((c) => c.partIds.filter((p) => p === 'switch/loxP@1.0.0').length > 1)
    expect(dioConstructs.length).toBeGreaterThan(0)
    const loxP = index.get('switch/loxP@1.0.0') ?? []
    expect(loxP).toHaveLength(dioConstructs.length)
  })

  it('records the construct each usage came from', () => {
    for (const [id, usages] of index) {
      for (const u of usages) {
        expect(u.kind, id).toBe('project')
        expect(u.constructName, id).toBeTruthy()
        expect(u.projectId, id).toBeTruthy()
      }
    }
  })

  it('keeps curated provenance and appends the project history to it', () => {
    const merged = indexBy(withProjectHistory(catalog.parts), (p: Part) => String(p.id))
    const egfp = merged.get('cds/EGFP@1.0.0')!
    // The GenBank accession the sequence came from survives...
    expect(egfp.provenance.accessions?.[0]?.id).toBe('U55762')
    // ...alongside the lab's own history, because neither answers "should I use this" alone.
    const projects = egfp.provenance.usages?.filter((u) => u.kind === 'project') ?? []
    expect(projects.length).toBeGreaterThan(1)
  })
})

describe('the provider', () => {
  it('offers the most-established candidates first', async () => {
    const provider = labRegistryProvider(catalog.parts)
    const page = await provider.search({ roles: ['promoter'] })
    const counts = page.parts.map(
      (p) => summarise(p.provenance.usages?.filter((u) => u.kind === 'project')).projects,
    )
    // Non-increasing: whatever the most projects have standardised on comes first.
    for (let i = 1; i < counts.length; i++) expect(counts[i]!).toBeLessThanOrEqual(counts[i - 1]!)
    expect(counts[0]).toBeGreaterThanOrEqual(3)
  })

  it('resolves a part by id', async () => {
    const provider = labRegistryProvider(catalog.parts)
    expect((await provider.get(partId('cds/microDys-lab@1.0.0')))?.length).toBe(3702)
  })
})

describe('example parts are unmistakably example data', () => {
  it('are marked low confidence, user origin, non-redistributable, with a note', () => {
    for (const p of EXAMPLE_PARTS) {
      expect(p.provenance.origin, String(p.id)).toBe('user')
      expect(p.provenance.confidence, String(p.id)).toBe('low')
      expect(p.license.redistributable, String(p.id)).toBe(false)
      expect(p.provenance.note, String(p.id)).toMatch(/bases are generated/)
    }
  })

  it('are still well-formed enough not to drown the designer in findings', () => {
    for (const p of EXAMPLE_PARTS.filter((x) => x.role === 'cds')) {
      expect(p.length % 3, p.name).toBe(0)
      expect(p.sequence.startsWith('ATG'), p.name).toBe(true)
      expect(['TAA', 'TAG', 'TGA']).toContain(p.sequence.slice(-3))
      for (let i = 0; i < p.sequence.length - 3; i += 3) {
        expect(['TAA', 'TAG', 'TGA'], `${p.name} at ${i}`).not.toContain(p.sequence.slice(i, i + 3))
      }
    }
  })

  it('never reach the shipped catalogue', () => {
    const shipped = new Set(catalog.parts.map((p) => String(p.id)))
    for (const p of EXAMPLE_PARTS) expect(shipped.has(String(p.id))).toBe(false)
  })
})
