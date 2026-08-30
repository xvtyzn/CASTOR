/**
 * Colours and type for everything drawn as SVG.
 *
 * This lives in JS rather than CSS on purpose. The comparison view must export to a
 * standalone SVG with a one-line `XMLSerializer` call, and that only works if every mark
 * carries its colour as a presentation attribute (`fill=`, `stroke=`) rather than inheriting
 * it from a stylesheet the exported file will not have. The React package mirrors these
 * values into `--castor-*` custom properties so the surrounding chrome stays in step.
 */
import type { PartRole } from './model/slot.js'
import type { CapacityBand } from './seq/capacity.js'

export interface CastorTheme {
  /** Semantic colour per part role — the 'byPartType' colour mode. */
  partColors: Record<PartRole, string>
  /** Categorical palette for the 'byHomologyGroup' colour mode. Colourblind-safe. */
  groupPalette: string[]
  /** Endpoints of the grey ramp for the 'byIdentity' colour mode. */
  identityRamp: [string, string]
  capacityBands: Record<CapacityBand, string>
  strokeMuted: string
  strokeStrong: string
  surface: string
  textPrimary: string
  textMuted: string
  fontFamily: string
  fontSizePx: number
}

/**
 * Okabe–Ito, which is designed to stay distinguishable under all common forms of colour
 * vision deficiency, extended to twelve. Black is omitted: as a fill it reads as "selected"
 * rather than as a category.
 */
export const OKABE_ITO_EXTENDED: string[] = [
  '#0072B2', // blue
  '#E69F00', // orange
  '#009E73', // bluish green
  '#CC79A7', // reddish purple
  '#56B4E9', // sky blue
  '#D55E00', // vermillion
  '#F0E442', // yellow
  '#8C6D31', // brown
  '#6A51A3', // violet
  '#31A354', // green
  '#B2182B', // dark red
  '#4D4D4D', // grey
]

export const defaultTheme: CastorTheme = {
  partColors: {
    backbone: '#9AA5B1',
    itr: '#2F3E4E',
    spacer: '#C7CDD4',
    enhancer: '#8FD19E',
    promoter: '#009E73',
    switch: '#CC79A7',
    intron: '#A8D5E5',
    utr5: '#D9E4EC',
    kozak: '#F0E442',
    signal_peptide: '#E8C39E',
    tag: '#6A51A3',
    linker: '#B8BFC7',
    cds: '#0072B2',
    joiner: '#E69F00',
    stop: '#7A7F87',
    utr3: '#D9E4EC',
    wpre: '#56B4E9',
    polya: '#D55E00',
    stuffer: '#E3E6EA',
    shrna: '#B2182B',
    amirna_scaffold: '#D6604D',
    grna_scaffold: '#8C6D31',
    terminator: '#7A7F87',
    custom: '#94A3B8',
  },
  groupPalette: OKABE_ITO_EXTENDED,
  identityRamp: ['#EEEEEE', '#333333'],
  capacityBands: {
    underfilled: '#8C6D31',
    low: '#7FB77E',
    optimal: '#009E73',
    'near-limit': '#E69F00',
    'over-limit': '#D55E00',
    error: '#B2182B',
  },
  strokeMuted: '#B8BFC7',
  strokeStrong: '#2F3E4E',
  surface: '#FFFFFF',
  textPrimary: '#1B2733',
  textMuted: '#616E7C',
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSizePx: 11,
}

export function mergeTheme(overrides?: Partial<CastorTheme>): CastorTheme {
  if (!overrides) return defaultTheme
  return {
    ...defaultTheme,
    ...overrides,
    partColors: { ...defaultTheme.partColors, ...overrides.partColors },
    capacityBands: { ...defaultTheme.capacityBands, ...overrides.capacityBands },
  }
}
