import type { BackboneId, PartId, TemplateId } from './ids.js'
import type { PartRole } from './slot.js'
import type { LicenseInfo, Provenance } from './provenance.js'

export interface BackboneFeature {
  name: string
  role: PartRole
  /** Half-open `[start, end)`, relative to `Backbone.sequence`. */
  start: number
  end: number
  strand: 1 | -1
  color?: string
}

export interface Backbone {
  id: BackboneId
  name: string
  /**
   * Everything OUTSIDE the ITRs, written as one linear string running from just after the
   * 3' ITR round to just before the 5' ITR.
   *
   * The finished plasmid is `backbone.sequence + cassette.sequence`, circularised. Keeping
   * the backbone as a single contiguous span (rather than a 5' piece and a 3' piece) means
   * the cassette never straddles the origin, which in turn means no feature in the design
   * the user is editing is ever origin-spanning. That is a deliberate simplification and
   * the reason circular range arithmetic stays out of the hot path.
   */
  sequence: string
  length: number
  features: BackboneFeature[]
  /** When true the backbone supplies the ITRs and they are locked in the editor. */
  providesItrs: boolean
  itr5PartId?: PartId
  itr3PartId?: PartId
  compatibleTemplates?: TemplateId[]
  /** Bacterial selection marker, surfaced because AmpR is a regulatory problem for GMP. */
  selectionMarker?: 'AmpR' | 'KanR' | 'other'
  origin?: string
  provenance: Provenance
  license: LicenseInfo
  description?: string
}
