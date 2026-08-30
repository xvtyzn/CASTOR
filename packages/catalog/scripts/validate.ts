/**
 * CI gate for the shipped catalogue.
 *
 * Schema conformance is the easy half. The checks that matter are the cross-field ones:
 * a `length` that disagrees with the sequence, a stale checksum, a duplicate id, a
 * `variantOf` pointing at nothing, and — the one with legal rather than scientific
 * consequences — a part marked non-redistributable that has reached the shipped set.
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
// The default `ajv` export only understands draft-07; our schemas declare draft 2020-12.
import Ajv from 'ajv/dist/2020.js'

const ROOT = new URL('../', import.meta.url).pathname
const PARTS_DIR = join(ROOT, 'data/parts')

const ajv = new Ajv({ allErrors: true, strict: false })
const partSchema = JSON.parse(readFileSync(join(ROOT, 'schema/part.schema.json'), 'utf8'))
const validatePartFile = ajv.compile(partSchema)

/** The shape of a shipped collection file, as far as the cross-field checks need it. */
interface PartRecord {
  id: string
  role: string
  sequence: string
  length: number
  checksum: string
  variantOf?: string
  attributes?: { role?: string }
  license?: { redistributable?: boolean }
}
interface CollectionFile {
  collection: string
  parts: PartRecord[]
}

const problems: string[] = []
const ids = new Set<string>()
const allParts: PartRecord[] = []

for (const file of readdirSync(PARTS_DIR).filter((f) => f.endsWith('.json')).sort()) {
  const path = join(PARTS_DIR, file)
  const data = JSON.parse(readFileSync(path, 'utf8')) as CollectionFile

  if (!validatePartFile(data)) {
    for (const e of validatePartFile.errors ?? []) {
      problems.push(`${file}${e.instancePath}: ${e.message}`)
    }
    continue
  }

  for (const part of data.parts) {
    allParts.push(part)
    const where = `${file} ${part.id}`

    if (ids.has(part.id)) problems.push(`${where}: duplicate id`)
    ids.add(part.id)

    if (part.length !== part.sequence.length) {
      problems.push(`${where}: length ${part.length} != sequence.length ${part.sequence.length}`)
    }

    const expected = `sha1:${createHash('sha1').update(String(part.sequence).toUpperCase()).digest('hex')}`
    if (part.checksum !== expected) problems.push(`${where}: checksum does not match sequence`)

    if (part.attributes?.role !== part.role) {
      problems.push(`${where}: attributes.role '${part.attributes?.role}' != role '${part.role}'`)
    }

    if (!part.license?.redistributable) {
      problems.push(
        `${where}: license.redistributable is false — this part must not ship. ` +
          `Remove it or clear the licence.`,
      )
    }

    if (part.role !== data.collection) {
      problems.push(`${where}: role '${part.role}' does not match collection '${data.collection}'`)
    }

    if (part.sequence.length === 0) problems.push(`${where}: empty sequence`)
  }
}

for (const part of allParts) {
  if (part.variantOf && !ids.has(part.variantOf)) {
    problems.push(`${part.id}: variantOf '${part.variantOf}' does not resolve`)
  }
}

if (problems.length > 0) {
  console.error(`Catalogue validation FAILED (${problems.length} problem(s)):`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`Catalogue OK: ${allParts.length} parts across ${ids.size} ids.`)
