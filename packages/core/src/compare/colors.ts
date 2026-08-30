import type { GroupId } from '../model/ids.js'
import type { PartRole } from '../model/slot.js'
import type { CastorTheme } from '../theme.js'

export type ColorMode = 'byPartType' | 'byHomologyGroup' | 'byIdentity'

export function partTypeScale(theme: CastorTheme): (role: PartRole) => string {
  return (role) => theme.partColors[role] ?? theme.partColors.custom
}

/** Stable ordinal assignment: the same group gets the same colour across re-renders. */
export function groupScale(theme: CastorTheme, groups: readonly GroupId[]): (g: GroupId) => string {
  const index = new Map<GroupId, number>()
  groups.forEach((g, i) => index.set(g, i))
  const palette = theme.groupPalette
  return (g) => palette[(index.get(g) ?? 0) % palette.length] ?? theme.partColors.custom
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  const f = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${f(r)}${f(g)}${f(b)}`
}

/**
 * Grey ramp over identity, the Easyfig / clinker convention. A hand-rolled sRGB lerp rather
 * than d3-interpolate: it is four lines, and a colour-space dependency in `core` would be
 * the only reason `core` needed one at all.
 */
export function identityRamp(theme: CastorTheme): (identity: number) => string {
  const [lo, hi] = theme.identityRamp
  const a = hexToRgb(lo)
  const b = hexToRgb(hi)
  return (identity) => {
    const t = Math.max(0, Math.min(1, identity))
    return rgbToHex(
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    )
  }
}
