import { useMemo, useRef } from 'react'
import { SeqViz } from 'seqviz'
import {
  findingsToHighlights,
  toSeqVizRange,
  type AssemblyResult,
  type InstanceId,
  type Severity,
  type ValidationReport,
} from '@castor-bio/core'
import { useCastorTheme } from '../theme/useTheme.js'

/**
 * The seqviz adapter.
 *
 * seqviz is deliberately read-only, which is exactly what we want: the designer owns all
 * state, and the map is a view of the assembly rather than a second source of truth. The
 * adapter's whole job is three translations, and confining them here means swapping seqviz
 * for something else later touches this file and nothing else.
 *
 *   Feature[]  -> AnnotationProp[]   (identity on coordinates: seqviz documents its
 *                                     annotations as 0-based, start inclusive, end exclusive,
 *                                     which is our convention too)
 *   Finding[]  -> HighlightProp[]
 *   onSelection -> the nearest InstanceId, via AssemblyResult.index
 */
/**
 * A click on the map, reported raw.
 *
 * PlasmidMap resolves the click to an instance where seqviz says an annotation was hit, but it
 * deliberately does not decide what that means — turning a bare base position into "insert a
 * Kozak here" needs the template, which belongs to the designer, not to a viewer adapter.
 */
export interface PlasmidMapClick {
  /** seqviz's own classification: ANNOTATION, SEQ, ENZYME, … */
  selectionType: string
  /** Base position of the click, in `space` coordinates. */
  position?: number
  start?: number
  end?: number
  space: 'plasmid' | 'cassette'
  /** Set when the click landed on a part. */
  instanceId: InstanceId | null
  /** Pointer position relative to the map container, for anchoring a popover. */
  anchor: { x: number; y: number }
}

export interface PlasmidMapProps {
  assembly: AssemblyResult
  /** 'plasmid' shows backbone + cassette circularised; 'cassette' shows the pGOI alone. */
  space?: 'plasmid' | 'cassette'
  viewer?: 'circular' | 'linear' | 'both' | 'both_flip'
  name?: string
  selectedInstanceId?: InstanceId | null
  onSelectInstance?: (id: InstanceId | null) => void
  findings?: ValidationReport
  enzymes?: string[]
  height?: number | string
  className?: string
  /** Fires on every click in the viewer. Use it to offer actions where the user clicked. */
  onMapClick?: (click: PlasmidMapClick) => void
}

export function PlasmidMap({
  assembly,
  space = 'plasmid',
  viewer = 'both',
  name = 'Transfer plasmid',
  selectedInstanceId,
  onSelectInstance,
  findings,
  enzymes,
  height = 420,
  className,
  onMapClick,
}: PlasmidMapProps) {
  const theme = useCastorTheme()
  const wrapperRef = useRef<HTMLDivElement>(null)
  // seqviz reports the selection but not where the pointer was, and a popover has to appear
  // where the user clicked. Recording it on pointerup is the only hook available.
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const source = space === 'plasmid' ? assembly.plasmid : assembly.cassette

  const annotations = useMemo(
    () =>
      source.features.map((f) => {
        const r = toSeqVizRange({ start: f.start, end: f.end })
        return {
          name: f.name,
          start: r.start,
          end: r.end,
          direction: f.strand,
          color: f.color ?? theme.partColors[f.role] ?? theme.partColors.custom,
        }
      }),
    [source.features, theme],
  )

  const highlights = useMemo(() => {
    if (!findings) return []
    const colorOf = (s: Severity) =>
      s === 'error'
        ? theme.capacityBands.error
        : s === 'warning'
          ? theme.capacityBands['near-limit']
          : theme.strokeMuted
    return findingsToHighlights(findings, space, assembly, colorOf)
  }, [findings, space, assembly, theme])

  const selection = useMemo(() => {
    if (!selectedInstanceId) return undefined
    const r = assembly.index.get(selectedInstanceId)?.[space]
    if (!r) return undefined
    return { start: r.start, end: r.end, clockwise: true }
  }, [selectedInstanceId, assembly, space])

  /** Resolve a base range to the instance that overlaps it most. */
  const instanceAt = (start: number, end: number): InstanceId | null => {
    let best: InstanceId | null = null
    let bestOverlap = 0
    for (const [instanceId, ranges] of assembly.index) {
      const r = ranges[space]
      const overlap = Math.min(r.end, end) - Math.max(r.start, start)
      if (overlap > bestOverlap) {
        bestOverlap = overlap
        best = instanceId
      }
    }
    return best
  }

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{ height, position: 'relative' }}
      onPointerUp={(e) => {
        const rect = wrapperRef.current?.getBoundingClientRect()
        if (rect) pointerRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      }}
    >
      <SeqViz
        name={name}
        seq={source.sequence}
        viewer={viewer}
        annotations={annotations}
        highlights={highlights}
        {...(enzymes ? { enzymes } : {})}
        {...(selection ? { selection } : {})}
        showComplement={false}
        style={{ height: '100%', width: '100%' }}
        onSelection={(sel) => {
          // seqviz reports start/end as optional; a click with no drag leaves them equal or
          // undefined. That is a caret, not an empty event — it is where the user wants to
          // insert something.
          const start = sel.start
          const end = sel.end
          const hasRange = start !== undefined && end !== undefined && start !== end
          const resolved = hasRange ? instanceAt(start!, end!) : null

          if (onSelectInstance) onSelectInstance(resolved)

          if (onMapClick) {
            onMapClick({
              selectionType: sel.type ?? '',
              ...(start !== undefined ? { position: start } : {}),
              ...(start !== undefined ? { start } : {}),
              ...(end !== undefined ? { end } : {}),
              space,
              instanceId: resolved,
              anchor: pointerRef.current,
            })
          }
        }}
      />
    </div>
  )
}
