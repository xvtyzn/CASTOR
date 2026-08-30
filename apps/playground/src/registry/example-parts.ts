/**
 * EXAMPLE DATA — the parts that exist only in this fictional lab's archive.
 *
 * Anything genuinely shared (ITRs, CAG, EF1a, gfaABC1D, EGFP, WPRE, the polyA signals, the
 * tags, the linkers, P2A, the lox sites) comes from the real shipped catalogue instead. What
 * is left here is what a lab actually accumulates: its own promoter preps, its own transgenes,
 * a couple of things made for one experiment and never touched again.
 */
import type { Part, PartAttributes, PartRole } from '@castor-bio/core'
import { partId } from '@castor-bio/core'
import { syntheticCds, syntheticRegulatory } from './synthesize.js'

const NOTE =
  'Example data. The length is the published size of the element it stands in for, but the ' +
  'bases are generated — do not order from this.'

function example(
  id: string,
  name: string,
  role: PartRole,
  length: number,
  attributes: PartAttributes,
  description: string,
  aliases?: string[],
): Part {
  const sequence = role === 'cds' ? syntheticCds(id, length) : syntheticRegulatory(id, length)
  return {
    id: partId(id),
    name,
    ...(aliases ? { aliases } : {}),
    role,
    sequence,
    length: sequence.length,
    checksum: `example:${id}`,
    attributes,
    provenance: {
      origin: 'user',
      confidence: 'low',
      note: NOTE,
    },
    license: { spdx: 'NOASSERTION', redistributable: false, note: 'Example data.' },
    version: '1.0.0',
    description,
  }
}

const promoter = (
  polymerase: 'II' | 'III',
  strength: 'weak' | 'medium' | 'strong',
  tissue: string[],
  minimal = false,
): PartAttributes => ({ role: 'promoter', polymerase, strength, tissue, minimal })

const cds = (product: string): PartAttributes => ({
  role: 'cds',
  product,
  hasStartCodon: true,
  hasStopCodon: true,
  nTermTaggable: true,
  cTermTaggable: true,
})

export const EXAMPLE_PARTS: Part[] = [
  // --- promoters and enhancers the lab preps itself ---------------------------------------
  example(
    'promoter/hSyn1-lab@1.0.0',
    'hSyn1 (lab prep)',
    'promoter',
    469,
    promoter('II', 'medium', ['neuron']),
    'Human synapsin 1 promoter. Pan-neuronal, compact, and the default in this lab.',
    ['hSyn', 'SYN1'],
  ),
  example(
    'promoter/CaMKIIa-lab@1.0.0',
    'CaMKIIa (lab prep)',
    'promoter',
    1293,
    promoter('II', 'strong', ['excitatory neuron']),
    'Excitatory forebrain neurons. Leaky at high MOI, and 1.3 kb is a lot of cargo.',
  ),
  example(
    'promoter/minBglobin-lab@1.0.0',
    'minimal β-globin',
    'promoter',
    102,
    promoter('II', 'weak', [], true),
    'Minimal promoter. Inert on its own — pair it with a cell-type enhancer upstream.',
    ['minBG'],
  ),
  example(
    'promoter/TBG-lab@1.0.0',
    'TBG (lab prep)',
    'promoter',
    460,
    promoter('II', 'strong', ['hepatocyte']),
    'Thyroxine-binding globulin promoter. The standard liver choice, usually with AAV8.',
  ),
  example(
    'promoter/MHCK7-lab@1.0.0',
    'MHCK7 (lab prep)',
    'promoter',
    770,
    promoter('II', 'strong', ['skeletal muscle', 'heart']),
    'MCK enhancer fused to an α-MHC promoter. The workhorse for muscle-directed AAV.',
  ),
  example(
    'enhancer/mDlx-lab@1.0.0',
    'mDlx enhancer',
    'enhancer',
    699,
    { role: 'enhancer', requiresMinimalPromoter: true, cellType: ['GABAergic interneuron'] },
    'Restricts expression to GABAergic interneurons. Needs a minimal promoter downstream.',
  ),

  // --- transgenes ---------------------------------------------------------------------------
  example(
    'cds/mCherry-lab@1.0.0',
    'mCherry',
    'cds',
    711,
    cds('mCherry red fluorescent protein'),
    'Monomeric red fluorescent protein.',
  ),
  example(
    'cds/tdTomato-lab@1.0.0',
    'tdTomato',
    'cds',
    1431,
    cds('tdTomato tandem dimer fluorescent protein'),
    'Very bright, but a tandem dimer — 1.4 kb of a 4.7 kb budget.',
  ),
  example(
    'cds/EYFP-lab@1.0.0',
    'EYFP',
    'cds',
    720,
    cds('enhanced yellow fluorescent protein'),
    'Yellow variant, usually fused to an opsin as a membrane marker.',
  ),
  example(
    'cds/Cre-lab@1.0.0',
    'Cre recombinase',
    'cds',
    1032,
    cds('Cre recombinase'),
    'Recombines loxP sites. Pairs with the DIO constructs in the toolbox project.',
  ),
  example(
    'cds/GCaMP6f-lab@1.0.0',
    'GCaMP6f',
    'cds',
    1347,
    cds('GCaMP6f calcium indicator'),
    'Fast genetically encoded calcium indicator.',
  ),
  example(
    'cds/ChR2-H134R-lab@1.0.0',
    'ChR2(H134R)',
    'cds',
    930,
    cds('channelrhodopsin-2 H134R'),
    'Blue-light cation channel, the H134R gain-of-function variant.',
  ),
  example(
    'cds/ChrimsonR-lab@1.0.0',
    'ChrimsonR',
    'cds',
    1050,
    cds('ChrimsonR red-shifted channelrhodopsin'),
    'Red-shifted opsin, for two-colour experiments alongside ChR2.',
  ),
  example(
    'cds/ASPA-lab@1.0.0',
    'ASPA',
    'cds',
    942,
    cds('aspartoacylase'),
    'Aspartoacylase. Used once, for the liver-directed enzyme replacement project.',
  ),
  example(
    'cds/microDys-lab@1.0.0',
    'µDystrophin',
    'cds',
    3702,
    cds('micro-dystrophin'),
    'Micro-dystrophin. At 3.7 kb it fills the genome — there is no room for a WPRE.',
    ['microdystrophin', 'µDys'],
  ),
]
