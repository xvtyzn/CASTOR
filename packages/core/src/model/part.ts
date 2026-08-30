import type { PartId } from './ids.js'
import type { PartRole } from './slot.js'
import type { LicenseInfo, Provenance } from './provenance.js'

/**
 * Role-specific facts. A discriminated union rather than a bag of optional fields, so that
 * a rule about promoters cannot silently read a property that only exists on ITRs.
 */
export type PartAttributes =
  | {
      role: 'promoter'
      /** Pol II drives protein-coding cassettes; Pol III drives shRNA/sgRNA. The single
       *  most consequential attribute in the whole model — it decides whether Kozak, WPRE,
       *  introns and polyA are required, optional or forbidden. */
      polymerase: 'II' | 'III'
      strength?: 'weak' | 'medium' | 'strong'
      /** A minimal promoter is inert without an upstream enhancer. */
      minimal?: boolean
      tissue?: string[]
      species?: string[]
      /** Silencing-prone in vivo (CMV is the classic case). */
      silencingProne?: boolean
    }
  | {
      role: 'enhancer'
      /** Cell-type-specific enhancers are half of a pair; they need a minimal promoter. */
      requiresMinimalPromoter?: boolean
      pairsWith?: PartId[]
      cellType?: string[]
    }
  | {
      role: 'itr'
      serotype: 'AAV2' | 'AAV5' | 'other'
      /** 145 nt wild-type, or the 130 nt "stable" form carried by most plasmids. */
      form: '145' | '130'
      /** Terminal resolution site deleted — the scAAV mutant ITR. Exactly one per scAAV. */
      deltaTRS: boolean
      orientation: 'flip' | 'flop'
      /** Offsets of the Rep binding element and trs within the part, for the ITR rule. */
      rbeOffset?: number
      trsOffset?: number
    }
  | {
      role: 'cds'
      product: string
      hasStartCodon: boolean
      hasStopCodon: boolean
      nTermTaggable: boolean
      cTermTaggable: boolean
      uniprot?: string
      fpbase?: string
    }
  | {
      role: 'joiner'
      mechanism: '2A' | 'IRES'
      peptide?: 'P2A' | 'T2A' | 'E2A' | 'F2A'
      /** 2A peptides cleave far better with a GSG spacer immediately upstream. */
      needsGsgSpacer: boolean
      /** 0..1, relative to the best performer. P2A ~1.0, F2A ~0.5. */
      relativeEfficiency?: number
    }
  | {
      role: 'wpre'
      variant: 'full' | 'WPRE3' | 'mut6'
      /** Full-length WPRE carries ~180 bp of the WHV X-protein ORF plus its promoter. */
      xProteinOrf: boolean
    }
  | { role: 'polya'; source: string; strength?: 'weak' | 'strong' }
  | {
      role: 'switch'
      system: 'FLEX' | 'DIO' | 'LSL'
      site: 'loxP' | 'lox2272' | 'loxN' | 'FRT'
      half: '5' | '3'
      /** Both halves of one switch share a pairKey, so the co-requirement rule can match. */
      pairKey: string
    }
  | { role: 'tag'; terminus: 'N' | 'C' | 'either'; copies: number }
  | { role: 'kozak'; strength?: 'strong' | 'adequate' | 'weak' }
  | { role: 'intron'; source?: string }
  | { role: 'terminator'; polymerase: 'III' }
  | {
      role:
        | 'linker'
        | 'utr5'
        | 'utr3'
        | 'spacer'
        | 'stuffer'
        | 'stop'
        | 'signal_peptide'
        | 'shrna'
        | 'amirna_scaffold'
        | 'grna_scaffold'
        | 'backbone'
        | 'custom'
    }

export interface Part {
  id: PartId
  name: string
  aliases?: string[]
  role: PartRole
  /**
   * Composite parts expand into more than one PartInstance at assembly time. An
   * enhancer + minimal-promoter pair is the motivating case: it behaves as one catalogue
   * entry in the picker but as two annotated features on the map.
   */
  composition?: { partId: PartId; strand: 1 | -1 }[]
  /** Uppercase ACGT (plus IUPAC ambiguity codes). May be '' for a lazily-loaded row. */
  sequence: string
  /** Authoritative even when `sequence` is lazily loaded and still empty. */
  length: number
  /** sha1 of the uppercased sequence. Two entries with the same checksum are the same DNA. */
  checksum: string
  attributes: PartAttributes
  provenance: Provenance
  license: LicenseInfo
  version: string
  deprecated?: boolean
  replacedBy?: PartId
  /**
   * Variant of another part — WPRE3 is a variant of WPRE. Drives the identity < 1 grey ramp
   * on comparison ribbons, so "same idea, different version" reads differently from
   * "same part" and from "unrelated".
   */
  variantOf?: PartId
  tags?: string[]
  /** Overrides the role's default colour. */
  color?: string
  description?: string
}
