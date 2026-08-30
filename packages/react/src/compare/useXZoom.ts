import { useEffect, useRef, useState, type RefObject } from 'react'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior } from 'd3-zoom'

export interface XZoomOptions {
  width: number
  plotLeft: number
  domain: [number, number]
  scaleExtent?: [number, number]
  enabled?: boolean
}

export interface XZoom {
  /** bp -> px, including the current pan and zoom. */
  xScale: (bp: number) => number
  k: number
  /** Current px per base, the number that decides whether the sequence is legible. */
  pxPerBase: number
  reset: () => void
  /** Multiply the zoom, keeping the centre of the plot fixed. */
  zoomBy: (factor: number) => void
  /** Zoom so that one base occupies `px` pixels, keeping the centre fixed. */
  zoomToPxPerBase: (px: number) => void
  scaleExtent: [number, number]
}

/**
 * x-only pan and zoom.
 *
 * d3-zoom is used purely as a gesture recogniser — it owns no DOM here beyond the event
 * listeners, and its transform is applied by recomputing the scale rather than by writing a
 * `<g transform>`. That distinction matters: a `scale(k,1)` transform would shear every
 * arrowhead and every glyph, whereas rescaling and re-projecting keeps a 12 px arrow tip 12 px
 * wide at any zoom.
 */
export function useXZoom(
  ref: RefObject<SVGSVGElement | null>,
  { width, plotLeft, domain, scaleExtent = [1, 400], enabled = true }: XZoomOptions,
): XZoom {
  const [transform, setTransform] = useState(() => zoomIdentity)
  const behaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return

    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent(scaleExtent)
      .filter((event: Event) => {
        // Let the page scroll unless the user means to zoom; a widget that swallows the
        // wheel is a widget people cannot scroll past.
        if (event.type === 'wheel')
          return (event as WheelEvent).ctrlKey || (event as WheelEvent).metaKey
        return !(event as MouseEvent).button
      })
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        // rAF-throttled: a pan fires far more often than the display refreshes.
        if (frame.current !== null) cancelAnimationFrame(frame.current)
        frame.current = requestAnimationFrame(() => setTransform(event.transform))
      })

    behaviorRef.current = behavior
    select(el).call(behavior)
    return () => {
      select(el).on('.zoom', null)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [ref, enabled, scaleExtent[0], scaleExtent[1]])

  const span = Math.max(1, domain[1] - domain[0])
  const plotWidth = Math.max(1, width - plotLeft)
  const base = (bp: number) => plotLeft + ((bp - domain[0]) / span) * plotWidth
  const xScale = (bp: number) => transform.applyX(base(bp))
  const basePxPerBase = plotWidth / span
  const pxPerBase = basePxPerBase * transform.k

  /** Apply a new scale factor about the centre of the plot area, so the view does not jump. */
  const applyScale = (k: number) => {
    const el = ref.current
    const clamped = Math.max(scaleExtent[0], Math.min(scaleExtent[1], k))
    const centre = plotLeft + plotWidth / 2
    // Keep whatever is under the centre pinned: x' = centre - (centre - x) * (k' / k)
    const next = zoomIdentity
      .translate(centre - ((centre - transform.x) * clamped) / transform.k, 0)
      .scale(clamped)
    if (el && behaviorRef.current) select(el).call(behaviorRef.current.transform, next)
    setTransform(next)
  }

  return {
    xScale,
    k: transform.k,
    pxPerBase,
    scaleExtent,
    reset: () => {
      const el = ref.current
      if (el && behaviorRef.current) select(el).call(behaviorRef.current.transform, zoomIdentity)
      setTransform(zoomIdentity)
    },
    zoomBy: (factor: number) => applyScale(transform.k * factor),
    zoomToPxPerBase: (px: number) => applyScale(px / basePxPerBase),
  }
}
