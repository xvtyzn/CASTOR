/**
 * Where every shipped sequence comes from.
 *
 * Two kinds of entry, and the distinction is the whole point of this file:
 *
 *   `extract`  — a slice of a real GenBank record, identified by accession and coordinates.
 *                The build asserts the extracted length against `expectLength`, so a wrong
 *                coordinate fails the build instead of silently shipping wrong DNA.
 *
 *   `literal`  — a short sequence written out directly. Only permitted where the sequence is
 *                unambiguous and independently checkable: a 6 bp Kozak consensus, a 34 bp
 *                loxP site, a peptide tag back-translated from its canonical amino acid
 *                sequence with a stated codon choice. `rationale` must say why it is safe.
 *
 * Nothing else is allowed. A promoter or a CDS is never written from memory.
 */
import type { PartRole } from '../../../packages/core/src/model/slot.ts'

export interface BaseRecipe {
  id: string
  name: string
  role: PartRole
  aliases?: string[]
  description?: string
  attributes: Record<string, unknown>
  variantOf?: string
  tags?: string[]
  /** Extra usages beyond the source record's own PMIDs. */
  usages?: {
    kind: 'publication' | 'project' | 'repository'
    title: string
    pmid?: string
    doi?: string
    year?: number
    journal?: string
    constructName?: string
    url?: string
  }[]
  addgene?: { plasmidId: number; name?: string }
  license: { spdx: string; redistributable: boolean; note?: string }
}

export interface ExtractRecipe extends BaseRecipe {
  kind: 'extract'
  accession: string
  /** OUR convention: 0-based, half-open, on the record's forward strand. */
  start: number
  end: number
  /** Take the reverse complement of the slice. */
  revcomp?: boolean
  /** Build fails if the extracted length differs. This is the check that makes the file trustworthy. */
  expectLength: number
  /** Optional: build fails unless the slice starts with this. Catches frame/offset slips. */
  expectStartsWith?: string
  expectEndsWith?: string
}

export interface LiteralRecipe extends BaseRecipe {
  kind: 'literal'
  sequence: string
  /** Why writing this one out directly is defensible. Required. */
  rationale: string
}

export type Recipe = ExtractRecipe | LiteralRecipe

const CC0 = { spdx: 'CC0-1.0', redistributable: true }

/** Codon choice for back-translated peptide tags: human high-frequency codons throughout. */
const BACKTRANSLATION_NOTE =
  'Back-translated from the canonical peptide with human high-frequency codons. The peptide ' +
  'is the definitive spec; the exact codons differ between vendors and are not load-bearing.'

export const RECIPES: Recipe[] = [
  // --- ITRs -----------------------------------------------------------------------------
  {
    kind: 'extract',
    id: 'itr/AAV2-ITR-145-flip@1.0.0',
    name: "AAV2 5' ITR (145 nt)",
    aliases: ['ITR', "5' ITR", 'AAV2 ITR'],
    role: 'itr',
    accession: 'NC_001401',
    start: 0,
    end: 145,
    expectLength: 145,
    description:
      'Wild-type AAV2 inverted terminal repeat, flip orientation. Annotated in the AAV2 ' +
      'reference genome as repeat_region 1..145, "inverted terminal repeat".',
    attributes: {
      role: 'itr',
      serotype: 'AAV2',
      form: '145',
      deltaTRS: false,
      orientation: 'flip',
    },
    license: CC0,
  },
  {
    kind: 'extract',
    id: 'itr/AAV2-ITR-145-3prime@1.0.0',
    name: "AAV2 3' ITR (145 nt)",
    aliases: ["3' ITR"],
    role: 'itr',
    accession: 'NC_001401',
    start: 4534,
    end: 4679,
    revcomp: true,
    expectLength: 145,
    description:
      "The 3' ITR of the AAV2 reference genome, stored as the reverse complement so that it " +
      'reads 5′->3′ on the transfer plasmid like every other part.',
    attributes: {
      role: 'itr',
      serotype: 'AAV2',
      form: '145',
      deltaTRS: false,
      orientation: 'flop',
    },
    license: CC0,
  },

  // --- WPRE -----------------------------------------------------------------------------
  {
    kind: 'extract',
    id: 'wpre/WPRE@1.0.0',
    name: 'WPRE',
    aliases: ['woodchuck hepatitis post-transcriptional regulatory element'],
    role: 'wpre',
    accession: 'J04514',
    start: 1093,
    end: 1685,
    expectLength: 592,
    description:
      'Woodchuck hepatitis virus post-transcriptional regulatory element, the 592 bp form used ' +
      'in most vectors (WHV8 nt 1094-1685). Its 3′ end overlaps the WHV X-protein ORF, which ' +
      'starts at nt 1503 of this record — that ~180 bp overlap is the basis of the ' +
      'tumorigenicity concern for clinical use.',
    attributes: { role: 'wpre', variant: 'full', xProteinOrf: true },
    license: CC0,
  },

  // --- fluorescent proteins --------------------------------------------------------------
  {
    kind: 'extract',
    id: 'cds/EGFP@1.0.0',
    name: 'EGFP',
    aliases: ['enhanced green fluorescent protein', 'GFP'],
    role: 'cds',
    accession: 'U55762',
    start: 678,
    end: 1398,
    expectLength: 720,
    expectStartsWith: 'ATGGTGAGCAAGGGCGAGGAG',
    expectEndsWith: 'TAA',
    description:
      'EGFP coding sequence, exactly as annotated in pEGFP-N1 (CDS 679..1398): ATG through the ' +
      'TAA stop, 239 residues plus terminator.',
    attributes: {
      role: 'cds',
      product: 'enhanced green fluorescent protein',
      hasStartCodon: true,
      hasStopCodon: true,
      nTermTaggable: true,
      cTermTaggable: true,
      fpbase: 'egfp',
    },
    license: CC0,
  },

  // --- literals: short, unambiguous, independently checkable ------------------------------
  {
    kind: 'literal',
    id: 'kozak/Kozak-consensus@1.0.0',
    name: 'Kozak (GCCACC)',
    role: 'kozak',
    sequence: 'GCCACC',
    rationale:
      'The 6 bp immediately 5′ of the ATG in the Kozak consensus gccRccATGG. Six bases, one ' +
      'published consensus, nothing to get wrong.',
    description:
      'Places a purine at −3 and leaves the CDS to supply the +4 G, giving strong translation ' +
      'initiation context.',
    attributes: { role: 'kozak', strength: 'strong' },
    license: CC0,
  },
  {
    kind: 'literal',
    id: 'switch/loxP@1.0.0',
    name: 'loxP',
    role: 'switch',
    sequence: 'ATAACTTCGTATAATGTATGCTATACGAAGTTAT',
    rationale:
      'The canonical 34 bp loxP site (13 bp inverted repeat – 8 bp spacer – 13 bp inverted ' +
      'repeat). A single published sequence, verifiable by its own palindromic structure.',
    attributes: { role: 'switch', system: 'FLEX', site: 'loxP', half: '5', pairKey: 'flex-1' },
    license: CC0,
  },
  {
    kind: 'literal',
    id: 'switch/lox2272@1.0.0',
    name: 'lox2272',
    role: 'switch',
    sequence: 'ATAACTTCGTATAAAGTATCCTATACGAAGTTAT',
    rationale:
      'loxP with the spacer mutations that make it heterotypic (positions 2 and 7 of the 8 bp ' +
      'spacer). 34 bp, published, and checkable against loxP by diff.',
    attributes: { role: 'switch', system: 'FLEX', site: 'lox2272', half: '5', pairKey: 'flex-1' },
    license: CC0,
  },
  {
    kind: 'literal',
    id: 'tag/FLAG@1.0.0',
    name: 'FLAG',
    role: 'tag',
    sequence: 'GACTACAAAGACGATGACGACAAG',
    rationale: `Peptide DYKDDDDK. ${BACKTRANSLATION_NOTE}`,
    attributes: { role: 'tag', terminus: 'either', copies: 1 },
    license: CC0,
  },
  {
    kind: 'literal',
    id: 'tag/3xFLAG@1.0.0',
    name: '3xFLAG',
    role: 'tag',
    sequence: 'GACTACAAAGACCATGACGGTGATTATAAAGATCATGACATCGATTACAAGGATGACGATGACAAG',
    rationale: `Peptide DYKDHDGDYKDHDIDYKDDDDK. ${BACKTRANSLATION_NOTE}`,
    attributes: { role: 'tag', terminus: 'either', copies: 3 },
    license: CC0,
  },
  {
    kind: 'literal',
    id: 'tag/HA@1.0.0',
    name: 'HA',
    role: 'tag',
    sequence: 'TACCCATACGATGTTCCAGATTACGCT',
    rationale: `Peptide YPYDVPDYA (influenza haemagglutinin epitope). ${BACKTRANSLATION_NOTE}`,
    attributes: { role: 'tag', terminus: 'either', copies: 1 },
    license: CC0,
  },
  {
    kind: 'literal',
    id: 'tag/His6@1.0.0',
    name: 'His6',
    role: 'tag',
    sequence: 'CACCACCATCACCATCAC',
    rationale: `Peptide HHHHHH. ${BACKTRANSLATION_NOTE}`,
    attributes: { role: 'tag', terminus: 'either', copies: 1 },
    license: CC0,
  },
  {
    kind: 'literal',
    id: 'tag/V5@1.0.0',
    name: 'V5',
    role: 'tag',
    sequence: 'GGTAAGCCTATCCCTAACCCTCTCCTCGGTCTCGATTCTACG',
    rationale: `Peptide GKPIPNPLLGLDST. ${BACKTRANSLATION_NOTE}`,
    attributes: { role: 'tag', terminus: 'either', copies: 1 },
    license: CC0,
  },
  {
    kind: 'literal',
    id: 'tag/myc@1.0.0',
    name: 'c-myc',
    role: 'tag',
    sequence: 'GAACAAAAACTCATCTCAGAAGAGGATCTG',
    rationale: `Peptide EQKLISEEDL. ${BACKTRANSLATION_NOTE}`,
    attributes: { role: 'tag', terminus: 'either', copies: 1 },
    license: CC0,
  },
  {
    kind: 'literal',
    id: 'linker/G4S@1.0.0',
    name: '(G4S)1 linker',
    role: 'linker',
    sequence: 'GGAGGCGGAGGTTCT',
    rationale: `Peptide GGGGS, the standard flexible linker. ${BACKTRANSLATION_NOTE}`,
    attributes: { role: 'linker' },
    license: CC0,
  },
  {
    kind: 'literal',
    id: 'linker/G4Sx3@1.0.0',
    name: '(G4S)3 linker',
    role: 'linker',
    sequence: 'GGAGGCGGAGGTTCTGGAGGCGGAGGTTCTGGAGGCGGAGGTTCT',
    rationale: `Peptide (GGGGS)3. ${BACKTRANSLATION_NOTE}`,
    attributes: { role: 'linker' },
    license: CC0,
  },
  {
    kind: 'literal',
    id: 'joiner/P2A@1.0.0',
    name: 'P2A',
    role: 'joiner',
    sequence: 'GGAAGCGGAGCTACTAACTTCAGCCTGCTGAAGCAGGCTGGAGACGTGGAGGAGAACCCTGGACCT',
    rationale:
      'Peptide GSG-ATNFSLLKQAGDVEENPGP (porcine teschovirus-1 2A) with the GSG spacer ' +
      `included. ${BACKTRANSLATION_NOTE}`,
    description:
      'Highest ribosome-skipping efficiency of the common 2A peptides. Leaves ~22 aa on the ' +
      'upstream protein and one proline on the downstream one.',
    attributes: {
      role: 'joiner',
      mechanism: '2A',
      peptide: 'P2A',
      needsGsgSpacer: false,
      relativeEfficiency: 1,
    },
    license: CC0,
  },
  {
    kind: 'literal',
    id: 'joiner/T2A@1.0.0',
    name: 'T2A',
    role: 'joiner',
    sequence: 'GGAAGCGGAGAGGGCAGAGGAAGTCTGCTAACATGCGGTGACGTCGAGGAGAATCCTGGCCCA',
    rationale:
      'Peptide GSG-EGRGSLLTCGDVEENPGP (Thosea asigna virus 2A) with the GSG spacer included. ' +
      BACKTRANSLATION_NOTE,
    attributes: {
      role: 'joiner',
      mechanism: '2A',
      peptide: 'T2A',
      needsGsgSpacer: false,
      relativeEfficiency: 0.9,
    },
    license: CC0,
  },
  // --- promoters --------------------------------------------------------------------------
  {
    kind: 'extract',
    id: 'promoter/CAG-935@1.0.0',
    name: 'CAG (935 bp)',
    aliases: ['CAGGS', 'CBA hybrid'],
    role: 'promoter',
    accession: 'JN898962',
    start: 452,
    end: 1387,
    expectLength: 935,
    expectStartsWith: 'ATTGACGTCAATAATGACGTATGTTCCCA',
    description:
      'A CAG-family promoter as annotated in the AAV cloning vector JN898962: CMV enhancer ' +
      '(the ATTGACGTCAATAATGACGTATG repeat is visible at the 5′ end) driving a chicken ' +
      'beta-actin promoter with a rabbit beta-globin splice acceptor. CAG constructs vary ' +
      'widely in length between labs (581 bp tCAG to 1733 bp full CAG); this is the 935 bp ' +
      'variant carried by this record, and the length is part of the name for that reason.',
    attributes: {
      role: 'promoter',
      polymerase: 'II',
      strength: 'strong',
      minimal: false,
      tissue: ['ubiquitous'],
      silencingProne: false,
    },
    license: CC0,
  },
  {
    kind: 'extract',
    id: 'promoter/EF1a@1.0.0',
    name: 'EF1\u03b1 (full)',
    aliases: ['EF1a', 'EEF1A1 promoter', 'EF-1alpha'],
    role: 'promoter',
    accession: 'PZ458742',
    start: 171,
    end: 1350,
    expectLength: 1179,
    expectStartsWith: 'GGCTCCGGTGCCCGTCAGTGGGCAGAGCGCACATCGCCCACAGTC',
    description:
      'Full-length human elongation factor 1-alpha promoter including intron 1, from the AAV ' +
      'vector pAAV-Ef1a-DIO-MCP-EGFP-WPRE-hGHpA. Resists the in vivo silencing that affects ' +
      'CMV, at the cost of 1.2 kb of a 4.7 kb budget.',
    attributes: {
      role: 'promoter',
      polymerase: 'II',
      strength: 'strong',
      minimal: false,
      tissue: ['ubiquitous'],
      silencingProne: false,
    },
    license: CC0,
  },
  {
    kind: 'extract',
    id: 'promoter/gfaABC1D@1.0.0',
    name: 'gfaABC1D',
    aliases: ['GFAP short', 'gfaABC(1)D'],
    role: 'promoter',
    accession: 'PZ398262',
    start: 3383,
    end: 4070,
    expectLength: 687,
    description:
      'Compact astrocyte-specific promoter derived from human GFAP, from the AAV vector ' +
      'pAAV-GfaABC1D-MCP-4xsfGFP-W3-bGHpA. The practical choice for astrocyte targeting: ' +
      'full-length GFAP is ~2.2 kb, which is half an AAV genome.',
    attributes: {
      role: 'promoter',
      polymerase: 'II',
      strength: 'medium',
      minimal: false,
      tissue: ['astrocyte'],
      silencingProne: false,
    },
    license: CC0,
  },

  // --- polyadenylation signals --------------------------------------------------------------
  {
    kind: 'extract',
    id: 'polya/SV40@1.0.0',
    name: 'SV40 polyA',
    aliases: ['SV40 poly(A) signal'],
    role: 'polya',
    accession: 'JN898962',
    start: 2075,
    end: 2296,
    expectLength: 221,
    expectStartsWith: 'TGATAAGATACATTGATGAGTTTGGACAAACCACAACTAGAATGCAGTG',
    description:
      'SV40 polyadenylation signal. Note that JN898962 annotates this region simply as ' +
      '"polyA signal"; the identity was established from the sequence itself, which is the ' +
      'SV40 element carried by pcDNA3 and pEGFP-N1. The cloning linker at the 5′ end of the ' +
      'annotated feature is excluded here.',
    attributes: { role: 'polya', source: 'SV40', strength: 'strong' },
    license: CC0,
  },
  {
    kind: 'extract',
    id: 'polya/hGH@1.0.0',
    name: 'hGH polyA',
    aliases: ['human growth hormone poly(A) signal'],
    role: 'polya',
    accession: 'PZ458742',
    start: 3399,
    end: 3876,
    expectLength: 477,
    expectStartsWith: 'GGGTGGCATCCCTGTGACCCCTCCCCAGTGCCTCTCCTGGCCCTG',
    description:
      'Human growth hormone polyadenylation region, as carried by pAAV-Ef1a-DIO-MCP-EGFP-' +
      'WPRE-hGHpA. Longer than the minimal hGH pA variants (113/189/324 bp) reported ' +
      'elsewhere; this is the full annotated element from the source vector.',
    attributes: { role: 'polya', source: 'hGH', strength: 'strong' },
    license: CC0,
  },
]
