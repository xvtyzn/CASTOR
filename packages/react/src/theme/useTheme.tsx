import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from 'react'
import { defaultTheme, mergeTheme, type CastorTheme } from '@castor-bio/core'

const ThemeContext = createContext<CastorTheme>(defaultTheme)

export function useCastorTheme(): CastorTheme {
  return useContext(ThemeContext)
}

/**
 * Mirrors the JS theme into --castor-* custom properties.
 *
 * The SVG marks read the JS object directly (they must, so that an exported SVG carries its
 * colours as presentation attributes and does not depend on a stylesheet it will not have).
 * The chrome reads the custom properties. Writing both from one object is what keeps them
 * from drifting apart.
 */
export function themeToCssVars(theme: CastorTheme): CSSProperties {
  return {
    '--castor-ink': theme.textPrimary,
    '--castor-ink-muted': theme.textMuted,
    '--castor-line': theme.strokeMuted,
    '--castor-line-strong': theme.strokeStrong,
    '--castor-surface': theme.surface,
    '--castor-focus': theme.strokeStrong,
    '--castor-font': theme.fontFamily,
  } as CSSProperties
}

export function ThemeProvider({
  theme,
  children,
}: {
  theme?: Partial<CastorTheme>
  children: ReactNode
}) {
  const merged = useMemo(() => mergeTheme(theme), [theme])
  return <ThemeContext.Provider value={merged}>{children}</ThemeContext.Provider>
}
