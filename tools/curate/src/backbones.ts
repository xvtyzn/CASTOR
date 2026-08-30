/**
 * Backbone recipes.
 *
 * A backbone here is everything OUTSIDE the ITRs, written as one contiguous linear string.
 * Keeping it contiguous is what guarantees no user-editable feature ever spans the plasmid
 * origin, which in turn keeps circular interval arithmetic out of the hot path.
 */
export interface BackboneRecipe {
  id: string
  name: string
  accession: string
  /** 0-based half-open. Omit to take the whole record. */
  start?: number
  end?: number
  expectLength: number
  description: string
  selectionMarker: 'AmpR' | 'KanR' | 'other'
  origin: string
  providesItrs: boolean
  itr5PartId?: string
  itr3PartId?: string
  compatibleTemplates?: string[]
  /** Features to carry over, matched against the source record by type+label substring. */
  featurePicks?: { match: string; name: string; role: string }[]
  license: { spdx: string; redistributable: boolean; note?: string }
}

const CC0 = { spdx: 'CC0-1.0', redistributable: true }

export const BACKBONE_RECIPES: BackboneRecipe[] = [
  {
    id: 'backbone/pUC19-AAV@1.0.0',
    name: 'pUC19 backbone (AmpR, pUC ori)',
    accession: 'M77789',
    expectLength: 2686,
    description:
      'The complete pUC19 cloning vector, used here as the bacterial backbone outside the ' +
      'ITRs. Most AAV transfer plasmids are pUC-derived: high-copy pUC origin plus AmpR, with ' +
      'the ITR-to-ITR cassette cloned into the polylinker. AmpR is fine for research use but ' +
      'is a regulatory problem for GMP material, where KanR is preferred.',
    selectionMarker: 'AmpR',
    origin: 'pUC/ColE1',
    providesItrs: false,
    compatibleTemplates: ['template/coding.simple@1.0.0'],
    featurePicks: [
      { match: 'Lac-operon', name: 'lac operon', role: 'backbone' },
      { match: 'polylinker', name: 'MCS (polylinker)', role: 'backbone' },
      { match: 'pBR322', name: 'pBR322-derived (ori + AmpR)', role: 'backbone' },
    ],
    license: CC0,
  },
]
