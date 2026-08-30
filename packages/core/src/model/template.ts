import type { PartId, SlotKey, TemplateId } from './ids.js'
import type { TemplateNode } from './slot.js'
import type { Citation } from './provenance.js'

/**
 * The cassette topologies this tool knows about. v1 ships `coding.simple`; the rest exist
 * in the type so that rules, colours and the editor are written against the full space
 * from the start rather than being retrofitted.
 */
export type CassetteKind =
  | 'coding.simple'
  | 'coding.multicistronic_2A'
  | 'coding.multicistronic_IRES'
  | 'coding.cre_dependent'
  | 'coding.LSL'
  | 'rnai.shRNA'
  | 'rnai.amiRNA'
  | 'crispr.all_in_one'
  | 'crispr.split'
  | 'tet_on'
  | 'dual_aav.trans_splicing'
  | 'dual_aav.hybrid'
  | 'sc.simple'

export interface CassetteTemplate {
  id: TemplateId
  name: string
  kind: CassetteKind
  description: string
  /** 'either' means the template works in both ss and sc packaging. */
  packaging: 'ss' | 'sc' | 'either'
  nodes: TemplateNode[]
  /** Rule ids to run in addition to the default set. */
  ruleIds?: string[]
  /** Parts pre-placed when a construct is created from this template. */
  seed?: { slotKey: SlotKey; partId: PartId; repeatIndex?: number }[]
  references?: Citation[]
}
