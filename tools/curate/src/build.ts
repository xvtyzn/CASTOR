/**
 * Build the shipped catalogue from RECIPES.
 *
 * Every extracted sequence is checked against the length (and optionally the terminal bases)
 * declared in the recipe. A mismatch is a hard failure: it means a coordinate is wrong, and
 * shipping wrong DNA silently is the worst thing this tool could do.
 *
 * Output goes to packages/catalog/data/_incoming/ for human review, never straight into the
 * shipped set.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { loadRecord } from './ncbi.ts'
import { RECIPES, type Recipe } from './recipes.ts'

const OUT_DIR = new URL('../../../packages/catalog/data/_incoming/', import.meta.url).pathname

const COMPLEMENT: Record<string, string> = { A: 'T', T: 'A', G: 'C', C: 'G', N: 'N' }
const revcomp = (s: string) =>
  s
    .split('')
    .reverse()
    .map((c) => COMPLEMENT[c] ?? 'N')
    .join('')

const sha1 = (s: string) => `sha1:${createHash('sha1').update(s.toUpperCase()).digest('hex')}`

interface Built {
  part: Record<string, unknown>
  problems: string[]
}

async function build(recipe: Recipe): Promise<Built> {
  const problems: string[] = []
  let sequence: string
  let provenance: Record<string, unknown>

  if (recipe.kind === 'literal') {
    sequence = recipe.sequence.toUpperCase()
    provenance = {
      origin: 'curated',
      confidence: 'high',
      curatedAt: new Date().toISOString().slice(0, 10),
      note: recipe.rationale,
      usages: recipe.usages ?? [],
    }
  } else {
    const rec = await loadRecord(recipe.accession)
    if (recipe.end > rec.sequence.length) {
      problems.push(
        `${recipe.id}: end ${recipe.end} exceeds ${recipe.accession} length ${rec.sequence.length}`,
      )
    }
    const slice = rec.sequence.slice(recipe.start, recipe.end)
    sequence = recipe.revcomp ? revcomp(slice) : slice

    if (sequence.length !== recipe.expectLength) {
      problems.push(
        `${recipe.id}: expected ${recipe.expectLength} bp, extracted ${sequence.length} bp`,
      )
    }
    if (recipe.expectStartsWith && !sequence.startsWith(recipe.expectStartsWith)) {
      problems.push(
        `${recipe.id}: expected to start with ${recipe.expectStartsWith}, got ${sequence.slice(0, recipe.expectStartsWith.length)}`,
      )
    }
    if (recipe.expectEndsWith && !sequence.endsWith(recipe.expectEndsWith)) {
      problems.push(
        `${recipe.id}: expected to end with ${recipe.expectEndsWith}, got ${sequence.slice(-recipe.expectEndsWith.length)}`,
      )
    }

    provenance = {
      origin: 'curated',
      confidence: 'high',
      curatedAt: new Date().toISOString().slice(0, 10),
      accessions: [
        {
          db: 'GenBank',
          id: recipe.accession,
          url: `https://www.ncbi.nlm.nih.gov/nuccore/${recipe.accession}`,
        },
      ],
      note:
        `Extracted from ${recipe.accession} ${recipe.start + 1}..${recipe.end}` +
        `${recipe.revcomp ? ' (reverse complement)' : ''}. Source record: ${rec.definition}`,
      usages: [
        ...rec.pubmedIds.map((pmid) => ({
          kind: 'publication' as const,
          title: rec.definition,
          pmid,
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        })),
        ...(recipe.usages ?? []),
      ],
    }
    if (recipe.addgene) {
      provenance.addgene = {
        ...recipe.addgene,
        url: `https://www.addgene.org/${recipe.addgene.plasmidId}/`,
      }
    }
  }

  return {
    problems,
    part: {
      id: recipe.id,
      name: recipe.name,
      ...(recipe.aliases ? { aliases: recipe.aliases } : {}),
      role: recipe.role,
      sequence,
      length: sequence.length,
      checksum: sha1(sequence),
      attributes: recipe.attributes,
      provenance,
      license: recipe.license,
      version: recipe.id.split('@')[1] ?? '1.0.0',
      ...(recipe.variantOf ? { variantOf: recipe.variantOf } : {}),
      ...(recipe.tags ? { tags: recipe.tags } : {}),
      ...(recipe.description ? { description: recipe.description } : {}),
    },
  }
}

const results: Built[] = []
for (const recipe of RECIPES) {
  process.stderr.write(`  ${recipe.id} … `)
  try {
    const built = await build(recipe)
    results.push(built)
    process.stderr.write(
      built.problems.length === 0
        ? `ok (${built.part.length} bp)\n`
        : `PROBLEM\n${built.problems.map((p) => `      ${p}`).join('\n')}\n`,
    )
  } catch (err) {
    process.stderr.write(`FAILED: ${(err as Error).message}\n`)
    results.push({ part: {}, problems: [`${recipe.id}: ${(err as Error).message}`] })
  }
}

const problems = results.flatMap((r) => r.problems)
const parts = results.filter((r) => r.problems.length === 0).map((r) => r.part)

// Group by role so each file can be a separate subpath export.
const byRole = new Map<string, Record<string, unknown>[]>()
for (const p of parts) {
  const role = String(p.role)
  const arr = byRole.get(role)
  if (arr) arr.push(p)
  else byRole.set(role, [p])
}

mkdirSync(OUT_DIR, { recursive: true })
for (const [role, list] of byRole) {
  writeFileSync(
    `${OUT_DIR}${role}.json`,
    JSON.stringify(
      {
        $schema: '../../schema/part.schema.json',
        collection: role,
        version: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
        parts: list,
      },
      null,
      2,
    ) + '\n',
  )
}

console.error('')
console.error(`built ${parts.length}/${RECIPES.length} parts into ${OUT_DIR}`)
if (problems.length > 0) {
  console.error(`\n${problems.length} PROBLEM(S) — these parts were NOT written:`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
