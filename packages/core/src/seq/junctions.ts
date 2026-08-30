/**
 * Junction glue: short sequences the assembler inserts between two adjacent parts because
 * the biology requires them, not because the user asked for them.
 *
 * These become real `PartInstance`s with `origin: 'auto'`, so they show up on the map, count
 * toward the capacity budget, and can be inspected — they are just not user-created and are
 * recomputed on every assembly rather than stored.
 */
import type { InstanceId, PartId, SlotKey } from '../model/ids.js'
import {
  instanceId as toInstanceId,
  partId as toPartId,
  slotKey as toSlotKey,
} from '../model/ids.js'
import type { Part } from '../model/part.js'
import type { PartInstance } from '../model/construct.js'
import type { LicenseInfo, Provenance } from '../model/provenance.js'

const SYNTHETIC_PROVENANCE: Provenance = {
  origin: 'derived',
  confidence: 'high',
  note: 'Inserted automatically by the assembler to satisfy a junction requirement.',
}
const SYNTHETIC_LICENSE: LicenseInfo = { spdx: 'CC0-1.0', redistributable: true }

function syntheticPart(
  id: string,
  name: string,
  sequence: string,
  role: Part['role'],
  description: string,
): Part {
  return {
    id: toPartId(id),
    name,
    role,
    sequence,
    length: sequence.length,
    checksum: `inline:${sequence}`,
    attributes: { role: role as 'linker' },
    provenance: SYNTHETIC_PROVENANCE,
    license: SYNTHETIC_LICENSE,
    version: '1.0.0',
    description,
  }
}

/**
 * GSG spacer. 2A peptides cleave markedly better with a Gly-Ser-Gly immediately upstream,
 * so a designer that silently omits it produces a construct that under-performs for a
 * reason the user cannot see on the map.
 */
export const GSG_SPACER: Part = syntheticPart(
  'linker/GSG@1.0.0',
  'GSG',
  'GGATCTGGA',
  'linker',
  'Gly-Ser-Gly spacer; raises 2A ribosome-skipping efficiency.',
)

/** A bare stop codon, inserted before an IRES so the upstream ORF terminates properly. */
export const STOP_TAA: Part = syntheticPart(
  'stop/TAA@1.0.0',
  'stop (TAA)',
  'TAA',
  'stop',
  'Ochre stop codon terminating the upstream cistron before an IRES.',
)

export const SYNTHETIC_PARTS: Part[] = [GSG_SPACER, STOP_TAA]
const SYNTHETIC_BY_ID = new Map<PartId, Part>(SYNTHETIC_PARTS.map((p) => [p.id, p]))

export function getSyntheticPart(id: PartId): Part | undefined {
  return SYNTHETIC_BY_ID.get(id)
}

export interface JunctionRule {
  id: string
  /** Insert glue between `left` and `right` when this returns true. */
  applies(left: Part | undefined, right: Part | undefined): boolean
  part: Part
  slotKey: SlotKey
}

export const JUNCTION_RULES: JunctionRule[] = [
  {
    id: 'gsg-before-2a',
    slotKey: toSlotKey('linker_auto'),
    part: GSG_SPACER,
    applies: (left, right) =>
      !!left &&
      !!right &&
      left.role === 'cds' &&
      right.role === 'joiner' &&
      right.attributes.role === 'joiner' &&
      right.attributes.mechanism === '2A' &&
      right.attributes.needsGsgSpacer,
  },
  {
    id: 'stop-before-ires',
    slotKey: toSlotKey('stop_auto'),
    part: STOP_TAA,
    applies: (left, right) =>
      !!left &&
      !!right &&
      left.role === 'cds' &&
      // A CDS that already carries its own stop needs no help.
      !(left.attributes.role === 'cds' && left.attributes.hasStopCodon) &&
      right.role === 'joiner' &&
      right.attributes.role === 'joiner' &&
      right.attributes.mechanism === 'IRES',
  },
]

/**
 * Walk adjacent pairs and return the glue instances to splice in, each tagged with the
 * index in the ORIGINAL array before which it belongs.
 */
export function planJunctions(
  parts: readonly PartInstance[],
  lookup: (id: PartId) => Part | undefined,
  nextId: (prefix: string) => string,
): { insertBefore: number; instance: PartInstance }[] {
  const out: { insertBefore: number; instance: PartInstance }[] = []
  for (let i = 1; i < parts.length; i++) {
    const left = lookup(parts[i - 1]!.partId)
    const right = lookup(parts[i]!.partId)
    for (const rule of JUNCTION_RULES) {
      if (!rule.applies(left, right)) continue
      out.push({
        insertBefore: i,
        instance: {
          instanceId: toInstanceId(nextId(rule.id)) as InstanceId,
          partId: rule.part.id,
          slotKey: rule.slotKey,
          repeatIndex: parts[i]!.repeatIndex,
          strand: 1,
          origin: 'auto',
          locked: true,
        },
      })
      break
    }
  }
  return out
}
