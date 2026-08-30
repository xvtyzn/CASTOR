import type { BackboneId, ConstructId, InstanceId, PartId, SlotKey, TemplateId } from './ids.js'

/**
 * One part placed in one construct.
 *
 * `strand: -1` means the part is reverse-complemented into the assembled sequence while its
 * feature keeps forward coordinates. That combination is what lets seqviz (which wants
 * forward coords plus a direction) draw a DIO/FLEX inverted CDS correctly, and it hands the
 * comparison view its `inverted` ribbon encoding for free.
 */
export interface PartInstance {
  instanceId: InstanceId
  partId: PartId
  slotKey: SlotKey
  /** 0 unless the instance sits inside a RepeatGroup. */
  repeatIndex: number
  strand: 1 | -1
  /**
   * 'auto' marks junction glue inserted by the assembler (a GSG spacer before a 2A, a stop
   * codon before an IRES). These are real instances — they appear on the map and count
   * toward the capacity budget — they are simply not user-created.
   */
  origin: 'user' | 'template' | 'backbone' | 'auto'
  locked?: boolean
  /** Pasted or hand-edited sequence, overriding the catalogue entry. */
  override?: { name?: string; sequence?: string }
  color?: string
  note?: string
}

export interface ProductionSystem {
  transferPlasmid: 'this'
  repCapPlasmid?: string
  helperPlasmid?: string
  cellLine?: 'HEK293' | 'HEK293T' | 'Sf9' | (string & {})
}

export interface Construct {
  id: ConstructId
  name: string
  templateId: TemplateId
  backboneId: BackboneId
  packaging: 'ss' | 'sc'
  /**
   * Genome serotype (which ITRs) and capsid serotype (which rep/cap plasmid) are separate
   * facts. Pseudotyping is the norm — an AAV2 genome in an AAV9 capsid is written `AAV2/9`
   * — so collapsing them into one field would make the common case unrepresentable.
   */
  genomeSerotype: string
  capsidSerotype: string
  production?: ProductionSystem
  /**
   * ORDER IS DATA, and this array is the truth. The template supplies min/max/roles and
   * drives the editor's "+ add" affordances; the ordering rule compares this against
   * CANONICAL_ORDER and reports a finding. It never regenerates the array.
   */
  cassette: { parts: PartInstance[] }
  createdAt: string
  updatedAt: string
  tags?: string[]
  notes?: string
  /** Bumped whenever the persisted shape changes; `migrateConstruct()` reads it. */
  schemaVersion: 1
}

export const CONSTRUCT_SCHEMA_VERSION = 1 as const
