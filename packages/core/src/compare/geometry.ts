/**
 * The two shapes the comparison figure is made of. Both are pure functions of numbers in
 * PIXEL space; everything upstream works in base pairs.
 */

export type Point = readonly [number, number]

export interface GeomOptions {
  /** Height of the arrow shaft. */
  bodyHeight: number
  /** How far the arrowhead flares beyond the shaft, per side. */
  tipHeight: number
  /** Length of the arrowhead along the sequence, in px. */
  tipLength: number
  /** Ribbon inset from each backbone, in row-height units. Keeps ribbons off the arrows. */
  linkInset: number
  linkStyle: 'straight' | 'curved'
  /** Steepness of the sigmoid edges when linkStyle is 'curved'. */
  curve: number
  curveSamples: number
}

/** clustermap.js's defaults, which are visually well-tuned and worth starting from. */
export const DEFAULT_GEOM: GeomOptions = {
  bodyHeight: 12,
  tipHeight: 5,
  tipLength: 12,
  linkInset: 0.15,
  linkStyle: 'straight',
  curve: 10,
  curveSamples: 40,
}

export function pointsAttr(points: readonly Point[]): string {
  return points.map(([x, y]) => `${round(x)},${round(y)}`).join(' ')
}

function round(n: number): number {
  // Two decimals is well below a device pixel and keeps golden files stable across
  // platforms where the last float digit differs.
  return Math.round(n * 100) / 100
}

/**
 * A gene arrow: a rectangular shaft with a triangular head, 7 points.
 *
 * When the feature is shorter than `tipLength` the shaft collapses to zero and the shape
 * degenerates to a 3-point triangle, rather than inverting and drawing a bow-tie — a 24 bp
 * FLAG tag next to a 4 kb CDS hits this on every realistic figure.
 */
export function arrowPolygon(
  x0: number,
  x1: number,
  yCenter: number,
  strand: 1 | -1,
  g: GeomOptions,
): Point[] {
  const width = Math.abs(x1 - x0)
  const left = Math.min(x0, x1)
  const right = Math.max(x0, x1)
  const halfBody = g.bodyHeight / 2
  const halfTip = g.bodyHeight / 2 + g.tipHeight
  const tip = Math.min(g.tipLength, width)

  if (width <= tip) {
    // Degenerate: a pure triangle spanning the whole feature.
    return strand === 1
      ? [
          [left, yCenter - halfTip],
          [right, yCenter],
          [left, yCenter + halfTip],
        ]
      : [
          [right, yCenter - halfTip],
          [left, yCenter],
          [right, yCenter + halfTip],
        ]
  }

  return strand === 1
    ? [
        [left, yCenter - halfBody],
        [right - tip, yCenter - halfBody],
        [right - tip, yCenter - halfTip],
        [right, yCenter],
        [right - tip, yCenter + halfTip],
        [right - tip, yCenter + halfBody],
        [left, yCenter + halfBody],
      ]
    : [
        [right, yCenter - halfBody],
        [left + tip, yCenter - halfBody],
        [left + tip, yCenter - halfTip],
        [left, yCenter],
        [left + tip, yCenter + halfTip],
        [left + tip, yCenter + halfBody],
        [right, yCenter + halfBody],
      ]
}

/**
 * A synteny ribbon between two rows: gggenomes' `link_to_poly`, a 4-point quadrilateral
 * inset from each backbone so it never touches the arrows.
 *
 * INVERSION ENCODING: when the two features are on opposite strands the bottom pair of x
 * values is swapped, which makes the quadrilateral self-cross into an hourglass. That
 * crossing IS the inversion marker — do not add a separate glyph for it.
 */
export function linkQuad(
  aX0: number,
  aX1: number,
  aY: number,
  bX0: number,
  bX1: number,
  bY: number,
  inverted: boolean,
  g: GeomOptions,
  rowHeight: number,
): Point[] {
  const inset = g.linkInset * rowHeight
  const top = aY + inset
  const bottom = bY - inset
  return inverted
    ? [
        [aX0, top],
        [aX1, top],
        [bX0, bottom],
        [bX1, bottom],
      ]
    : [
        [aX0, top],
        [aX1, top],
        [bX1, bottom],
        [bX0, bottom],
      ]
}

/** Normalised logistic sigmoid on [0,1], used for the curved ribbon edges. */
export function sigmoid(t: number, curve: number): number {
  const raw = (x: number) => 1 / (1 + Math.exp(-curve * (x - 0.5)))
  const lo = raw(0)
  const hi = raw(1)
  return (raw(t) - lo) / (hi - lo)
}

/**
 * The curved ribbon: two sigmoid edges rather than a true bezier, matching gggenomes'
 * `geom_link_curved`. Flat where it leaves each backbone, steep in the middle — the Sankey
 * look, which reads better than a bezier when many ribbons overlap.
 */
export function linkRibbonPath(
  aX0: number,
  aX1: number,
  aY: number,
  bX0: number,
  bX1: number,
  bY: number,
  inverted: boolean,
  g: GeomOptions,
  rowHeight: number,
): string {
  const inset = g.linkInset * rowHeight
  const top = aY + inset
  const bottom = bY - inset
  const [b0, b1] = inverted ? [bX1, bX0] : [bX0, bX1]

  const edge = (x1: number, x2: number): Point[] => {
    const pts: Point[] = []
    for (let i = 0; i <= g.curveSamples; i++) {
      const t = i / g.curveSamples
      const s = sigmoid(t, g.curve)
      pts.push([x1 + s * (x2 - x1), top + t * (bottom - top)])
    }
    return pts
  }

  const down = edge(aX0, b0)
  const up = edge(aX1, b1).reverse()
  const d =
    `M${fmt(down[0]!)}` +
    down.slice(1).map((p) => `L${fmt(p)}`).join('') +
    up.map((p) => `L${fmt(p)}`).join('') +
    'Z'
  return d
}

function fmt(p: Point): string {
  return `${round(p[0])},${round(p[1])}`
}
