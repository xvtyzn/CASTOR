import { createTheme, type Theme, type ThemeOptions } from '@mui/material/styles'
import { defaultTheme, mergeTheme, type CastorTheme } from '@castor-bio/core'

/**
 * A MUI theme for the workbench chrome, derived from the same palette the SVG marks use.
 *
 * The rule the whole tool is built on carries over: colour encodes biology, and only biology.
 * So the MUI palette here is achromatic — the primary is the ITR slate, not a brand blue — and
 * every saturated pixel on screen is still a part, a homology group or a packaging band. A
 * default MUI blue AppBar would put the loudest colour on the page on the one element that
 * carries no information.
 */
export function createCastorMuiTheme(
  castor: Partial<CastorTheme> = {},
  overrides: ThemeOptions = {},
): Theme {
  const t = mergeTheme(castor)
  return createTheme(
    {
      palette: {
        mode: 'light',
        primary: { main: t.strokeStrong },
        secondary: { main: t.textMuted },
        error: { main: t.capacityBands.error },
        warning: { main: t.capacityBands['near-limit'] },
        success: { main: t.capacityBands.optimal },
        background: { default: '#f2f3f5', paper: t.surface },
        text: { primary: t.textPrimary, secondary: t.textMuted },
        divider: t.strokeMuted,
      },
      shape: { borderRadius: 3 },
      typography: {
        fontFamily: t.fontFamily,
        fontSize: 13,
        /**
         * `overline` is repurposed as the section-label style used throughout — but without the
         * wide tracking and the uppercasing MUI defaults to. Spaced-out capitals are a magazine
         * device: in a dense tool they cost horizontal space, slow reading, and make the chrome
         * compete with the data for attention.
         */
        overline: {
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 'normal',
          textTransform: 'none',
          lineHeight: 1.5,
        },
        button: { textTransform: 'none', fontWeight: 500 },
      },
      components: {
        MuiPaper: {
          defaultProps: { elevation: 0 },
          styleOverrides: { root: { backgroundImage: 'none' } },
        },
        MuiTab: {
          styleOverrides: {
            root: { minHeight: 38, padding: '8px 14px', textTransform: 'none', fontWeight: 500 },
          },
        },
        MuiTooltip: { defaultProps: { arrow: true } },
        MuiTableCell: { styleOverrides: { root: { paddingTop: 6, paddingBottom: 6 } } },
      },
    },
    overrides,
  )
}

export const castorMonospace =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace'

export { defaultTheme }
