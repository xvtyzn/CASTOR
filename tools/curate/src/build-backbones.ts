import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { loadRecord } from './ncbi.ts'
import { BACKBONE_RECIPES } from './backbones.ts'

const OUT_DIR = new URL('../../../packages/catalog/data/_incoming/', import.meta.url).pathname
const sha1 = (s: string) => `sha1:${createHash('sha1').update(s.toUpperCase()).digest('hex')}`

const out: Record<string, unknown>[] = []
const problems: string[] = []

for (const r of BACKBONE_RECIPES) {
  process.stderr.write(`  ${r.id} … `)
  const rec = await loadRecord(r.accession)
  const start = r.start ?? 0
  const end = r.end ?? rec.sequence.length
  const sequence = rec.sequence.slice(start, end)

  if (sequence.length !== r.expectLength) {
    problems.push(`${r.id}: expected ${r.expectLength} bp, extracted ${sequence.length} bp`)
    process.stderr.write(`PROBLEM (${sequence.length} bp)\n`)
    continue
  }

  const features = (r.featurePicks ?? []).flatMap((pick) =>
    rec.features
      .filter((f) =>
        Object.values(f.qualifiers).some((v) => v.toLowerCase().includes(pick.match.toLowerCase())),
      )
      .filter((f) => f.start >= start && f.end <= end)
      .map((f) => ({
        name: pick.name,
        role: pick.role,
        start: f.start - start,
        end: f.end - start,
        strand: f.strand,
      })),
  )

  out.push({
    id: r.id,
    name: r.name,
    sequence,
    length: sequence.length,
    checksum: sha1(sequence),
    features,
    providesItrs: r.providesItrs,
    ...(r.itr5PartId ? { itr5PartId: r.itr5PartId } : {}),
    ...(r.itr3PartId ? { itr3PartId: r.itr3PartId } : {}),
    ...(r.compatibleTemplates ? { compatibleTemplates: r.compatibleTemplates } : {}),
    selectionMarker: r.selectionMarker,
    origin: r.origin,
    description: r.description,
    provenance: {
      origin: 'curated',
      confidence: 'high',
      curatedAt: new Date().toISOString().slice(0, 10),
      accessions: [
        {
          db: 'GenBank',
          id: r.accession,
          url: `https://www.ncbi.nlm.nih.gov/nuccore/${r.accession}`,
        },
      ],
      note: `Extracted from ${r.accession} ${start + 1}..${end}. Source record: ${rec.definition}`,
      usages: rec.pubmedIds.map((pmid) => ({
        kind: 'publication' as const,
        title: rec.definition,
        pmid,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      })),
    },
    license: r.license,
  })
  process.stderr.write(`ok (${sequence.length} bp, ${features.length} features)\n`)
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(
  `${OUT_DIR}backbones.json`,
  JSON.stringify(
    { $schema: '../../schema/backbone.schema.json', collection: 'backbones', backbones: out },
    null,
    2,
  ) + '\n',
)
console.error(`\nbuilt ${out.length}/${BACKBONE_RECIPES.length} backbones`)
if (problems.length) {
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
