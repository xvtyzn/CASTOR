/**
 * Instantiating a construct from a template.
 *
 * The template supplies locked parts and seeds; everything else the user fills in. Note that
 * this produces the INITIAL array only — from here on `Construct.cassette.parts` is the
 * truth and the template is just a checker.
 */
import type { Backbone } from '../model/backbone.js'
import type { CassetteTemplate } from '../model/template.js'
import type { Construct, PartInstance } from '../model/construct.js'
import {
  constructId as toConstructId,
  instanceId as toInstanceId,
  createRandomIdFactory,
  type IdFactory,
} from '../model/ids.js'
import { CONSTRUCT_SCHEMA_VERSION } from '../model/construct.js'
import { flattenSlots, isSlotSpec, type SlotSpec } from '../model/slot.js'

export interface CreateConstructOptions {
  name?: string
  packaging?: 'ss' | 'sc'
  genomeSerotype?: string
  capsidSerotype?: string
  idFactory?: IdFactory
  /** ISO timestamp; injected so snapshots stay stable. */
  now?: string
}

export function createConstruct(
  template: CassetteTemplate,
  backbone: Backbone,
  options: CreateConstructOptions = {},
): Construct {
  const nextId = options.idFactory ?? createRandomIdFactory()
  const now = options.now ?? new Date().toISOString()

  const seeded = new Map(
    (template.seed ?? []).map((s) => [`${s.slotKey}:${s.repeatIndex ?? 0}`, s.partId]),
  )

  const parts: PartInstance[] = []
  for (const node of template.nodes) {
    if (!isSlotSpec(node)) continue // RepeatGroups start empty; the user adds cistrons
    const slot: SlotSpec = node
    const partId = seeded.get(`${slot.key}:0`) ?? slot.defaultPartId
    if (!partId) continue
    parts.push({
      instanceId: toInstanceId(nextId(String(slot.key))),
      partId,
      slotKey: slot.key,
      repeatIndex: 0,
      strand: slot.strand === 'reverse' ? -1 : 1,
      origin: 'template',
      ...(slot.locked ? { locked: true } : {}),
    })
  }

  return {
    id: toConstructId(nextId('construct')),
    name: options.name ?? 'Untitled design',
    templateId: template.id,
    backboneId: backbone.id,
    packaging: options.packaging ?? (template.packaging === 'sc' ? 'sc' : 'ss'),
    genomeSerotype: options.genomeSerotype ?? 'AAV2',
    capsidSerotype: options.capsidSerotype ?? 'AAV9',
    cassette: { parts },
    createdAt: now,
    updatedAt: now,
    schemaVersion: CONSTRUCT_SCHEMA_VERSION,
  }
}

/**
 * Where a new instance for `slotKey` belongs in the flat array.
 *
 * The template's node order is the reference; we find the last existing instance whose slot
 * is at or before the target slot and insert after it. This is what makes "add a tag" put the
 * tag in the right place without the user thinking about ordering, while still leaving the
 * array free to hold an order the template would not have produced.
 */
export function insertionIndexFor(
  construct: Construct,
  template: CassetteTemplate,
  slotKey: SlotSpec['key'],
): number {
  const order = flattenSlots(template.nodes).map((s) => s.key)
  const target = order.indexOf(slotKey)
  if (target === -1) return construct.cassette.parts.length

  let index = 0
  for (let i = 0; i < construct.cassette.parts.length; i++) {
    const rank = order.indexOf(construct.cassette.parts[i]!.slotKey)
    if (rank !== -1 && rank <= target) index = i + 1
  }
  return index
}
