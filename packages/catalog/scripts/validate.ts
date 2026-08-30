/**
 * CI gate for every static file shipped by the catalogue package.
 *
 * JSON Schema protects the persisted shapes. The checks below cover relationships a schema
 * cannot express conveniently: checksums, coordinate bounds, unique ids, and references
 * between parts, templates and backbones.
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv from 'ajv/dist/2020.js'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const PARTS_DIR = join(ROOT, 'data/parts')
const DATA_DIR = join(ROOT, 'data')
const SCHEMA_DIR = join(ROOT, 'schema')

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'))
const sha1 = (sequence: string): string =>
  `sha1:${createHash('sha1').update(sequence.toUpperCase()).digest('hex')}`

const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false })
const validatePartFile = ajv.compile(readJson(join(SCHEMA_DIR, 'part.schema.json')) as object)
const validateTemplateFile = ajv.compile(
  readJson(join(SCHEMA_DIR, 'template.schema.json')) as object,
)
const validateBackboneFile = ajv.compile(
  readJson(join(SCHEMA_DIR, 'backbone.schema.json')) as object,
)

interface PartRecord {
  id: string
  role: string
  sequence: string
  length: number
  checksum: string
  variantOf?: string
  composition?: { partId: string; strand: 1 | -1 }[]
  attributes: { role: string }
  license: { redistributable: boolean }
}
interface CollectionFile {
  collection: string
  parts: PartRecord[]
}
interface SlotRecord {
  kind: 'slot'
  key: string
  roles: string[]
  min: number
  max: number | null
  defaultPartId?: string
}
interface RepeatRecord {
  kind: 'repeat'
  key: string
  min: number
  max: number | null
  children: SlotRecord[]
  separator?: SlotRecord
}
interface TemplateRecord {
  id: string
  nodes: (SlotRecord | RepeatRecord)[]
  seed?: { slotKey: string; partId: string; repeatIndex?: number }[]
}
interface TemplateFile {
  templates: TemplateRecord[]
}
interface BackboneRecord {
  id: string
  sequence: string
  length: number
  checksum: string
  features: { name: string; start: number; end: number }[]
  providesItrs: boolean
  itr5PartId?: string
  itr3PartId?: string
  compatibleTemplates?: string[]
  license: { redistributable: boolean }
}
interface BackboneFile {
  backbones: BackboneRecord[]
}

const problems: string[] = []

function schemaProblems(file: string, errors: typeof validatePartFile.errors): void {
  for (const error of errors ?? []) {
    problems.push(`${file}${error.instancePath}: ${error.message}`)
  }
}

const partIds = new Set<string>()
const allParts: PartRecord[] = []

for (const file of readdirSync(PARTS_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort()) {
  const data = readJson(join(PARTS_DIR, file))
  if (!validatePartFile(data)) {
    schemaProblems(file, validatePartFile.errors)
    continue
  }

  const collection = data as CollectionFile
  for (const part of collection.parts) {
    allParts.push(part)
    const where = `${file} ${part.id}`
    if (partIds.has(part.id)) problems.push(`${where}: duplicate id`)
    partIds.add(part.id)

    if (part.length !== part.sequence.length) {
      problems.push(`${where}: length ${part.length} != sequence.length ${part.sequence.length}`)
    }
    if (part.checksum !== sha1(part.sequence)) {
      problems.push(`${where}: checksum does not match sequence`)
    }
    if (part.attributes.role !== part.role) {
      problems.push(`${where}: attributes.role '${part.attributes.role}' != role '${part.role}'`)
    }
    if (!part.license.redistributable) {
      problems.push(`${where}: license.redistributable is false — this part must not ship`)
    }
    if (part.role !== collection.collection) {
      problems.push(
        `${where}: role '${part.role}' does not match collection '${collection.collection}'`,
      )
    }
  }
}

for (const part of allParts) {
  if (part.variantOf && !partIds.has(part.variantOf)) {
    problems.push(`${part.id}: variantOf '${part.variantOf}' does not resolve`)
  }
  for (const component of part.composition ?? []) {
    if (!partIds.has(component.partId)) {
      problems.push(`${part.id}: composition part '${component.partId}' does not resolve`)
    }
  }
}

const templateData = readJson(join(DATA_DIR, 'templates.json'))
let templates: TemplateRecord[] = []
if (!validateTemplateFile(templateData)) {
  schemaProblems('templates.json', validateTemplateFile.errors)
} else {
  templates = (templateData as TemplateFile).templates
}

const templateIds = new Set<string>()
for (const template of templates) {
  if (templateIds.has(template.id)) problems.push(`${template.id}: duplicate template id`)
  templateIds.add(template.id)

  const slots: SlotRecord[] = []
  for (const node of template.nodes) {
    if (node.kind === 'slot') slots.push(node)
    else slots.push(...node.children, ...(node.separator ? [node.separator] : []))
  }
  const slotsByKey = new Map<string, SlotRecord>()
  for (const slot of slots) {
    if (slotsByKey.has(slot.key)) problems.push(`${template.id}: duplicate slot key '${slot.key}'`)
    slotsByKey.set(slot.key, slot)
    if (slot.max !== null && slot.min > slot.max) {
      problems.push(`${template.id} ${slot.key}: min ${slot.min} exceeds max ${slot.max}`)
    }
    if (slot.defaultPartId) checkPartFits(template.id, slot, slot.defaultPartId, 'defaultPartId')
  }
  for (const seed of template.seed ?? []) {
    const slot = slotsByKey.get(seed.slotKey)
    if (!slot) problems.push(`${template.id}: seed slot '${seed.slotKey}' does not resolve`)
    else checkPartFits(template.id, slot, seed.partId, 'seed')
  }
}

function checkPartFits(templateId: string, slot: SlotRecord, partId: string, source: string): void {
  const part = allParts.find((candidate) => candidate.id === partId)
  if (!part) {
    problems.push(`${templateId} ${slot.key}: ${source} part '${partId}' does not resolve`)
  } else if (!slot.roles.includes(part.role)) {
    problems.push(
      `${templateId} ${slot.key}: ${source} part '${partId}' has role '${part.role}', expected ${slot.roles.join(' / ')}`,
    )
  }
}

const backboneData = readJson(join(DATA_DIR, 'backbones.json'))
let backbones: BackboneRecord[] = []
if (!validateBackboneFile(backboneData)) {
  schemaProblems('backbones.json', validateBackboneFile.errors)
} else {
  backbones = (backboneData as BackboneFile).backbones
}

const backboneIds = new Set<string>()
for (const backbone of backbones) {
  if (backboneIds.has(backbone.id)) problems.push(`${backbone.id}: duplicate backbone id`)
  backboneIds.add(backbone.id)
  if (backbone.length !== backbone.sequence.length) {
    problems.push(
      `${backbone.id}: length ${backbone.length} != sequence.length ${backbone.sequence.length}`,
    )
  }
  if (backbone.checksum !== sha1(backbone.sequence)) {
    problems.push(`${backbone.id}: checksum does not match sequence`)
  }
  if (!backbone.license.redistributable) {
    problems.push(`${backbone.id}: license.redistributable is false — this backbone must not ship`)
  }
  for (const feature of backbone.features) {
    if (feature.start >= feature.end || feature.end > backbone.length) {
      problems.push(
        `${backbone.id} ${feature.name}: invalid range [${feature.start}, ${feature.end}) for length ${backbone.length}`,
      )
    }
  }
  for (const templateId of backbone.compatibleTemplates ?? []) {
    if (!templateIds.has(templateId)) {
      problems.push(`${backbone.id}: compatible template '${templateId}' does not resolve`)
    }
  }
  if (backbone.providesItrs) {
    for (const [side, partId] of [
      ['5′', backbone.itr5PartId],
      ['3′', backbone.itr3PartId],
    ] as const) {
      const part = partId ? allParts.find((candidate) => candidate.id === partId) : undefined
      if (!part || part.role !== 'itr') {
        problems.push(`${backbone.id}: providesItrs requires a resolvable ${side} ITR part`)
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`Catalogue validation FAILED (${problems.length} problem(s)):`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

console.log(
  `Catalogue OK: ${allParts.length} parts, ${templates.length} template(s), ${backbones.length} backbone(s).`,
)
