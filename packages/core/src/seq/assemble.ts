/**
 * Slots -> sequence -> features -> index. The join between the design model and everything
 * visual: the plasmid map, the capacity meter, every validation rule and the comparison
 * view all read `AssemblyResult` and nothing else.
 *
 * Pure and synchronous. All part resolution happens before the call, so the caller — not
 * this module — owns async catalogue loading.
 */
import type { InstanceId, PartId } from '../model/ids.js'
import { createRandomIdFactory, type IdFactory } from '../model/ids.js'
import type { Part } from '../model/part.js'
import type { PartRole } from '../model/slot.js'
import type { Backbone } from '../model/backbone.js'
import type { Construct, PartInstance } from '../model/construct.js'
import type { CassetteTemplate } from '../model/template.js'
import { rangeOfLength, translateRangeBy, type Range } from './coords.js'
import { revcomp } from './alphabet.js'
import { getSyntheticPart, planJunctions } from './junctions.js'
import { computeCapacity, type CapacityReport } from './capacity.js'

export type PartLookup = (id: PartId) => Part | undefined

export interface Feature {
  id: string
  /** Absent for backbone features, which have no PartInstance behind them. */
  instanceId?: InstanceId
  name: string
  role: PartRole
  /** Half-open `[start, end)` in the space this feature belongs to. */
  start: number
  end: number
  /** Forward coordinates are kept even when strand is -1; see PartInstance.strand. */
  strand: 1 | -1
  color?: string
  origin: PartInstance['origin'] | 'backbone'
}

export type AssemblyProblem =
  | { kind: 'missing-part'; instanceId: InstanceId; partId: PartId }
  | { kind: 'empty-sequence'; instanceId: InstanceId; partId: PartId; name: string }
  | { kind: 'missing-itr'; which: '5' | '3' }
  | { kind: 'missing-backbone'; backboneId: string }

export interface AssemblyResult {
  /** The pGOI: ITR-to-ITR, inclusive of both ITRs. Linear. What the comparison view uses. */
  cassette: { sequence: string; length: number; features: Feature[] }
  /** The whole transfer plasmid: `backbone.sequence + cassette.sequence`, circularised. */
  plasmid: { sequence: string; length: number; circular: true; features: Feature[] }
  /** Every instance's range in BOTH spaces. The UI's cross-reference table. */
  index: Map<InstanceId, { cassette: Range; plasmid: Range }>
  /** The instances actually assembled, junction glue included, in final order. */
  instances: PartInstance[]
  capacity: CapacityReport
  problems: AssemblyProblem[]
}

/** Composite parts (enhancer + minimal promoter) expand into one instance per component. */
function expandComposites(
  parts: readonly PartInstance[],
  lookup: PartLookup,
  nextId: IdFactory,
): PartInstance[] {
  const out: PartInstance[] = []
  for (const inst of parts) {
    const part = lookup(inst.partId)
    if (!part?.composition?.length) {
      out.push(inst)
      continue
    }
    // A composite instance keeps its slotKey so ordering rules still see one logical slot,
    // but contributes one feature per component so the map shows what is actually there.
    for (const component of part.composition) {
      out.push({
        ...inst,
        instanceId: nextId(`${inst.instanceId}~`) as InstanceId,
        partId: component.partId,
        strand: (inst.strand * component.strand) as 1 | -1,
        origin: 'auto',
        locked: true,
      })
    }
  }
  return out
}

export interface AssembleOptions {
  /** Injected so snapshots stay stable; defaults to a random factory at runtime. */
  idFactory?: IdFactory
  /** Skip junction glue. Only useful when reproducing a construct byte-for-byte. */
  skipJunctions?: boolean
}

export function assemble(
  construct: Construct,
  backbone: Backbone,
  _template: CassetteTemplate,
  parts: PartLookup,
  options: AssembleOptions = {},
): AssemblyResult {
  const nextId = options.idFactory ?? createRandomIdFactory()
  const problems: AssemblyProblem[] = []

  // Synthetic junction parts are not in the catalogue, so fold them into the lookup rather
  // than forcing every caller to remember to register them.
  const lookup: PartLookup = (id) => parts(id) ?? getSyntheticPart(id)

  // 1. expand composites
  let working = expandComposites(construct.cassette.parts, lookup, nextId)

  // 2. splice in junction glue
  if (!options.skipJunctions) {
    const planned = planJunctions(working, lookup, nextId)
    if (planned.length) {
      const next: PartInstance[] = []
      for (let i = 0; i < working.length; i++) {
        for (const p of planned) if (p.insertBefore === i) next.push(p.instance)
        next.push(working[i]!)
      }
      working = next
    }
  }

  // 3. single walk: concatenate, accumulating a cursor. Half-open ranges make this pure
  //    addition — no +1 or -1 appears anywhere in this loop, which is the entire reason
  //    for the coordinate convention.
  const chunks: string[] = []
  const cassetteFeatures: Feature[] = []
  const index = new Map<InstanceId, { cassette: Range; plasmid: Range }>()
  let cursor = 0

  for (const inst of working) {
    const part = lookup(inst.partId)
    if (!part) {
      problems.push({ kind: 'missing-part', instanceId: inst.instanceId, partId: inst.partId })
      continue
    }
    const raw = inst.override?.sequence ?? part.sequence
    if (raw.length === 0) {
      problems.push({
        kind: 'empty-sequence',
        instanceId: inst.instanceId,
        partId: inst.partId,
        name: part.name,
      })
      continue
    }
    const segment = inst.strand === -1 ? revcomp(raw) : raw
    const r = rangeOfLength(cursor, segment.length)

    chunks.push(segment)
    cassetteFeatures.push({
      id: `f:${inst.instanceId}`,
      instanceId: inst.instanceId,
      name: inst.override?.name ?? part.name,
      role: part.role,
      start: r.start,
      end: r.end,
      strand: inst.strand,
      color: inst.color ?? part.color,
      origin: inst.origin,
    })
    index.set(inst.instanceId, { cassette: r, plasmid: translateRangeBy(r, backbone.length) })
    cursor += segment.length
  }

  const cassetteSequence = chunks.join('')

  // 4. plasmid space = backbone first, then the cassette shifted past it. Keeping the
  //    backbone contiguous is what guarantees no user-editable feature spans the origin.
  const plasmidFeatures: Feature[] = [
    ...backbone.features.map((f, i): Feature => ({
      id: `bb:${backbone.id}:${i}`,
      name: f.name,
      role: f.role,
      start: f.start,
      end: f.end,
      strand: f.strand,
      color: f.color,
      origin: 'backbone',
    })),
    ...cassetteFeatures.map((f): Feature => ({
      ...f,
      id: `p:${f.id}`,
      start: f.start + backbone.length,
      end: f.end + backbone.length,
    })),
  ]

  // 5. capacity. ITR length is read from the assembled parts, never assumed, because AAV2
  //    ITRs ship as both the 145 nt wild-type and the 130 nt "stable" form.
  const itrFeatures = cassetteFeatures.filter((f) => f.role === 'itr')
  if (itrFeatures.length === 0) {
    problems.push({ kind: 'missing-itr', which: '5' })
    problems.push({ kind: 'missing-itr', which: '3' })
  } else if (itrFeatures.length === 1) {
    problems.push({ kind: 'missing-itr', which: itrFeatures[0]!.start === 0 ? '3' : '5' })
  }
  const itrLength = itrFeatures.reduce((sum, f) => sum + (f.end - f.start), 0)

  return {
    cassette: {
      sequence: cassetteSequence,
      length: cassetteSequence.length,
      features: cassetteFeatures,
    },
    plasmid: {
      sequence: backbone.sequence + cassetteSequence,
      length: backbone.length + cassetteSequence.length,
      circular: true,
      features: plasmidFeatures,
    },
    index,
    instances: working,
    capacity: computeCapacity(cassetteSequence.length, itrLength, construct.packaging),
    problems,
  }
}
