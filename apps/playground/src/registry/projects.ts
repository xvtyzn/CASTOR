/**
 * EXAMPLE DATA — a stand-in for a lab's own construct history.
 *
 * The situation this models: a group already has a pile of AAV transfer plasmids, each tied to
 * a project, each already annotated. Those annotations have been extracted into parts. Some
 * parts turn up in project after project; others were made for one experiment and never used
 * again. When you go to fill a slot, what you actually want to know is which of those it is.
 *
 * Nothing here ships in @castor-bio/catalog. This is the shape a real integration takes:
 * replace these arrays with your registry's API and the rest of the app is unchanged.
 */

export interface Project {
  id: string
  name: string
  team: string
  year: number
  lead: string
}

/** One pGOI from the archive: an ordered list of the part ids its annotation resolved to. */
export interface ArchivedConstruct {
  name: string
  projectId: string
  /** Ordered, ITR to ITR. Ids refer either to the shipped catalogue or to EXAMPLE_PARTS. */
  partIds: string[]
  note?: string
}

export const PROJECTS: Project[] = [
  {
    id: 'NEU-2023-04',
    name: 'Striatal interneuron mapping',
    team: 'Circuits',
    year: 2023,
    lead: 'M. Aoki',
  },
  {
    id: 'TOOL-2023-09',
    name: 'Cre-dependent toolbox',
    team: 'Vector core',
    year: 2023,
    lead: 'S. Random',
  },
  {
    id: 'NEU-2024-11',
    name: 'Astrocyte calcium imaging',
    team: 'Circuits',
    year: 2024,
    lead: 'M. Aoki',
  },
  {
    id: 'GT-2024-02',
    name: 'Liver-directed enzyme replacement',
    team: 'Gene therapy',
    year: 2024,
    lead: 'R. Okafor',
  },
  {
    id: 'NEU-2025-03',
    name: 'Cortical opsin comparison',
    team: 'Circuits',
    year: 2025,
    lead: 'T. Lindqvist',
  },
  {
    id: 'GT-2025-07',
    name: 'Muscle-directed microdystrophin',
    team: 'Gene therapy',
    year: 2025,
    lead: 'R. Okafor',
  },
]

const ITR5 = 'itr/AAV2-ITR-145-flip@1.0.0'
const ITR3 = 'itr/AAV2-ITR-145-3prime@1.0.0'
const KOZAK = 'kozak/Kozak-consensus@1.0.0'
const WPRE = 'wpre/WPRE@1.0.0'
const SV40 = 'polya/SV40@1.0.0'
const HGH = 'polya/hGH@1.0.0'

/**
 * The archive. Deliberately uneven: the ITRs and WPRE are in nearly everything, hSyn1 spans
 * three projects, and things like the ASPA transgene appear exactly once — which is the
 * distinction the picker is there to surface.
 */
export const ARCHIVE: ArchivedConstruct[] = [
  // --- NEU-2023-04 ------------------------------------------------------------------------
  {
    name: 'pAAV-hSyn1-EGFP-WPRE-SV40pA',
    projectId: 'NEU-2023-04',
    partIds: [ITR5, 'promoter/hSyn1-lab@1.0.0', KOZAK, 'cds/EGFP@1.0.0', WPRE, SV40, ITR3],
    note: 'Workhorse pan-neuronal reporter; re-used unchanged in two later projects.',
  },
  {
    name: 'pAAV-mDlx-mCherry-WPRE-SV40pA',
    projectId: 'NEU-2023-04',
    partIds: [
      ITR5,
      'enhancer/mDlx-lab@1.0.0',
      'promoter/minBglobin-lab@1.0.0',
      KOZAK,
      'cds/mCherry-lab@1.0.0',
      WPRE,
      SV40,
      ITR3,
    ],
    note: 'GABAergic interneuron labelling. The mDlx enhancer has not been used since.',
  },

  // --- TOOL-2023-09 -----------------------------------------------------------------------
  {
    name: 'pAAV-EF1a-DIO-EGFP-WPRE-hGHpA',
    projectId: 'TOOL-2023-09',
    partIds: [
      ITR5,
      'promoter/EF1a@1.0.0',
      'switch/loxP@1.0.0',
      'switch/lox2272@1.0.0',
      KOZAK,
      'cds/EGFP@1.0.0',
      'switch/loxP@1.0.0',
      'switch/lox2272@1.0.0',
      WPRE,
      HGH,
      ITR3,
    ],
    note: 'Reference DIO backbone the whole group copies from.',
  },
  {
    name: 'pAAV-EF1a-DIO-tdTomato-WPRE-hGHpA',
    projectId: 'TOOL-2023-09',
    partIds: [
      ITR5,
      'promoter/EF1a@1.0.0',
      'switch/loxP@1.0.0',
      'switch/lox2272@1.0.0',
      KOZAK,
      'cds/tdTomato-lab@1.0.0',
      'switch/loxP@1.0.0',
      'switch/lox2272@1.0.0',
      WPRE,
      HGH,
      ITR3,
    ],
  },
  {
    name: 'pAAV-CAG-3xFLAG-Cre-WPRE-SV40pA',
    projectId: 'TOOL-2023-09',
    partIds: [
      ITR5,
      'promoter/CAG-935@1.0.0',
      KOZAK,
      'tag/3xFLAG@1.0.0',
      'linker/G4S@1.0.0',
      'cds/Cre-lab@1.0.0',
      WPRE,
      SV40,
      ITR3,
    ],
    note: 'Tagged Cre for anti-FLAG histology.',
  },

  // --- NEU-2024-11 ------------------------------------------------------------------------
  {
    name: 'pAAV-gfaABC1D-GCaMP6f-WPRE-SV40pA',
    projectId: 'NEU-2024-11',
    partIds: [ITR5, 'promoter/gfaABC1D@1.0.0', KOZAK, 'cds/GCaMP6f-lab@1.0.0', WPRE, SV40, ITR3],
    note: 'Astrocyte-restricted calcium sensor.',
  },
  {
    name: 'pAAV-gfaABC1D-mCherry-WPRE-SV40pA',
    projectId: 'NEU-2024-11',
    partIds: [ITR5, 'promoter/gfaABC1D@1.0.0', KOZAK, 'cds/mCherry-lab@1.0.0', WPRE, SV40, ITR3],
    note: 'Structural counterstain for the sensor above.',
  },
  {
    name: 'pAAV-hSyn1-EGFP-WPRE-SV40pA (re-prep)',
    projectId: 'NEU-2024-11',
    partIds: [ITR5, 'promoter/hSyn1-lab@1.0.0', KOZAK, 'cds/EGFP@1.0.0', WPRE, SV40, ITR3],
    note: 'Identical to the NEU-2023-04 construct; re-prepped rather than redesigned.',
  },

  // --- GT-2024-02 -------------------------------------------------------------------------
  {
    name: 'pAAV-TBG-ASPA-WPRE-hGHpA',
    projectId: 'GT-2024-02',
    partIds: [ITR5, 'promoter/TBG-lab@1.0.0', KOZAK, 'cds/ASPA-lab@1.0.0', WPRE, HGH, ITR3],
    note: 'Liver-directed. TBG and ASPA are unique to this project.',
  },
  {
    name: 'pAAV-TBG-ASPA-hGHpA (WPRE-free)',
    projectId: 'GT-2024-02',
    partIds: [ITR5, 'promoter/TBG-lab@1.0.0', KOZAK, 'cds/ASPA-lab@1.0.0', HGH, ITR3],
    note: 'WPRE dropped for the preclinical arm because of the X-protein ORF.',
  },

  // --- NEU-2025-03 ------------------------------------------------------------------------
  {
    name: 'pAAV-hSyn1-ChR2-EYFP-WPRE-SV40pA',
    projectId: 'NEU-2025-03',
    partIds: [
      ITR5,
      'promoter/hSyn1-lab@1.0.0',
      KOZAK,
      'cds/ChR2-H134R-lab@1.0.0',
      'linker/G4S@1.0.0',
      'cds/EYFP-lab@1.0.0',
      WPRE,
      SV40,
      ITR3,
    ],
  },
  {
    name: 'pAAV-CaMKIIa-ChrimsonR-tdTomato-WPRE-SV40pA',
    projectId: 'NEU-2025-03',
    partIds: [
      ITR5,
      'promoter/CaMKIIa-lab@1.0.0',
      KOZAK,
      'cds/ChrimsonR-lab@1.0.0',
      'linker/G4S@1.0.0',
      'cds/tdTomato-lab@1.0.0',
      WPRE,
      SV40,
      ITR3,
    ],
    note: 'Red-shifted opsin arm of the comparison.',
  },
  {
    name: 'pAAV-EF1a-DIO-ChR2-EYFP-WPRE-hGHpA',
    projectId: 'NEU-2025-03',
    partIds: [
      ITR5,
      'promoter/EF1a@1.0.0',
      'switch/loxP@1.0.0',
      'switch/lox2272@1.0.0',
      KOZAK,
      'cds/ChR2-H134R-lab@1.0.0',
      'linker/G4S@1.0.0',
      'cds/EYFP-lab@1.0.0',
      'switch/loxP@1.0.0',
      'switch/lox2272@1.0.0',
      WPRE,
      HGH,
      ITR3,
    ],
    note: 'Copied from the TOOL-2023-09 DIO backbone with the opsin swapped in.',
  },
  {
    name: 'pAAV-hSyn1-EGFP-P2A-ChR2-WPRE-SV40pA',
    projectId: 'NEU-2025-03',
    partIds: [
      ITR5,
      'promoter/hSyn1-lab@1.0.0',
      KOZAK,
      'cds/EGFP@1.0.0',
      'joiner/P2A@1.0.0',
      'cds/ChR2-H134R-lab@1.0.0',
      WPRE,
      SV40,
      ITR3,
    ],
    note: 'Bicistronic control; the only P2A construct in the archive.',
  },

  // --- GT-2025-07 -------------------------------------------------------------------------
  {
    name: 'pAAV-MHCK7-microDys-SV40pA',
    projectId: 'GT-2025-07',
    partIds: [ITR5, 'promoter/MHCK7-lab@1.0.0', KOZAK, 'cds/microDys-lab@1.0.0', SV40, ITR3],
    note: 'No WPRE: at 3.7 kb the transgene leaves no room for it.',
  },
  {
    name: 'pAAV-CAG-EGFP-WPRE-SV40pA',
    projectId: 'GT-2025-07',
    partIds: [ITR5, 'promoter/CAG-935@1.0.0', KOZAK, 'cds/EGFP@1.0.0', WPRE, SV40, ITR3],
    note: 'Ubiquitous reporter control for the biodistribution arm.',
  },
  {
    name: 'pAAV-CAG-EGFP-WPRE-SV40pA (astro control)',
    projectId: 'NEU-2024-11',
    partIds: [ITR5, 'promoter/CAG-935@1.0.0', KOZAK, 'cds/EGFP@1.0.0', WPRE, SV40, ITR3],
    note: 'Same construct as the GT-2025-07 control; the vector core keeps one prep for both.',
  },
  {
    name: 'pAAV-MHCK7-microDys-HA-SV40pA',
    projectId: 'GT-2025-07',
    partIds: [
      ITR5,
      'promoter/MHCK7-lab@1.0.0',
      KOZAK,
      'cds/microDys-lab@1.0.0',
      'linker/G4S@1.0.0',
      'tag/HA@1.0.0',
      SV40,
      ITR3,
    ],
    note: 'C-terminally tagged for biodistribution.',
  },
]
