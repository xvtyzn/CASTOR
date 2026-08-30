import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type CastorTheme,
  type AssemblyResult,
  type CapacityBand,
  type InstanceId,
  SC_BANDS,
  SS_BANDS,
} from '@castor-bio/core'
import { useCastorTheme } from '../theme/useTheme.js'
import { kb } from '../format.js'
import { useMessages } from '../i18n.js'

/**
 * The cassette editor and the capacity meter, drawn as ONE object.
 *
 * A cassette is a length budget — that is the defining constraint of AAV and the reason this
 * tool exists rather than a generic plasmid editor. So the parts are drawn to scale on a bp
 * ruler whose background is the packaging bands, and the ruler runs to the hard packaging
 * limit rather than to the cassette's own length. Two consequences follow directly, and both
 * are the point:
 *
 *   - a 1179 bp EF1a promoter is visibly five times a 221 bp polyA, instead of both being
 *     equal-width chips
 *   - remaining headroom is empty space you can see, not a percentage you have to read
 *
 * A separate strip plus a separate progress bar would show the same numbers and none of this.
 */

export interface CassetteRulerProps {
  assembly: AssemblyResult
  selectedInstanceId?: InstanceId | null
  onSelect?: (id: InstanceId | null) => void
  height?: number
  className?: string
}

const TRACK_HEIGHT = 26
const AXIS_HEIGHT = 18
const LABEL_HEIGHT = 14

export function CassetteRuler({
  assembly,
  selectedInstanceId,
  onSelect,
  height = TRACK_HEIGHT + AXIS_HEIGHT + LABEL_HEIGHT + 10,
  className,
}: CassetteRulerProps) {
  const theme = useCastorTheme()
  const t = useMessages()
  const { capacity, cassette } = assembly

  // The axis always runs to the packaging limit, never to the cassette length. Rescaling to
  // the content would hide exactly the fact the user needs.
  const domainMax = Math.max(capacity.limit, cassette.length) * 1.02
  const bands = capacity.packaging === 'sc' ? SC_BANDS : SS_BANDS

  const ticks = useMemo(() => {
    const step = domainMax > 3000 ? 1000 : 500
    const out: number[] = []
    for (let v = 0; v <= domainMax; v += step) out.push(v)
    return out
  }, [domainMax])

  /**
   * Measured width, so one user unit is one pixel.
   *
   * The first version used a fixed 1000-unit viewBox with preserveAspectRatio="none", which is
   * fine for the rectangles and wrong for everything with a glyph in it: at a 1900 px container
   * the labels were stretched 1.9x horizontally. Measuring costs a ResizeObserver and makes the
   * type render at its actual proportions.
   */
  const hostRef = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState(0)
  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const w = entry?.contentRect.width ?? 0
      if (w > 0) setMeasured(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const viewWidth = measured || 1000
  const x = (v: number) => (v / domainMax) * viewWidth
  const trackY = AXIS_HEIGHT
  const labelY = AXIS_HEIGHT + TRACK_HEIGHT + 11

  /**
   * Which segments get a label.
   *
   * Culling on segment width alone is not enough: two adjacent narrow parts each clear the
   * threshold and then their centred labels collide, which is exactly what a real cassette
   * does at its 5′ end (a 145 bp ITR beside a 6 bp Kozak). So we walk left to right and drop
   * any label that would overlap the last one we kept.
   */
  const labelPlan = useMemo(() => {
    const plan: ({ text: string; centre: number } | null)[] = []
    let lastRight = Number.NEGATIVE_INFINITY
    for (const f of cassette.features) {
      const w = x(f.end) - x(f.start)
      const text = f.name.length > 14 ? `${f.name.slice(0, 13)}…` : f.name
      // ~5.2 px per glyph of the monospace label at fontSize 9.
      const halfText = (text.length * 5.2) / 2
      // Clamp into the viewBox so the first and last labels are not half-cut by its edges.
      const centre = Math.min(
        Math.max(x(f.start) + w / 2, halfText),
        viewWidth - halfText,
      )
      if (w < 18 || centre - halfText < lastRight + 3) {
        plan.push(null)
        continue
      }
      plan.push({ text, centre })
      lastRight = centre + halfText
    }
    return plan
  }, [cassette.features, domainMax])

  return (
    <div ref={hostRef} className={className} style={{ width: '100%' }}>
      <svg
        className="castor-ruler"
        width={viewWidth}
        height={height}
        viewBox={`0 0 ${viewWidth} ${height}`}
        role="img"
        aria-label={`Cassette, ${cassette.length} base pairs of a ${capacity.limit} base pair packaging limit`}
      >
      {/* packaging bands, behind everything */}
      {bands.map((band, i) => {
        const from = i === 0 ? 0 : bands[i - 1]!.max
        const to = Math.min(band.max, domainMax)
        if (to <= from) return null
        return (
          <rect
            key={band.band}
            x={x(from)}
            y={trackY}
            width={x(to) - x(from)}
            height={TRACK_HEIGHT}
            fill={theme.capacityBands[band.band as CapacityBand]}
            fillOpacity={0.1}
          />
        )
      })}

      {/* the limit itself, drawn as a hard edge rather than a colour change */}
      <line
        x1={x(capacity.limit)}
        x2={x(capacity.limit)}
        y1={trackY - 4}
        y2={trackY + TRACK_HEIGHT + 4}
        stroke={theme.capacityBands.error}
        strokeWidth={1.5}
        strokeDasharray="3 2"
      />
      <text
        className="castor-ruler__tick-label"
        x={x(capacity.limit) - 4}
        y={trackY + TRACK_HEIGHT + 11}
        textAnchor="end"
        fontSize={9}
        fill={theme.capacityBands.error}
      >
        {t.cassette.limit(kb(capacity.limit, 1))}
      </text>

      {/* bp axis */}
      {ticks.map((v) => (
        <g key={v}>
          <line
            x1={x(v)}
            x2={x(v)}
            y1={AXIS_HEIGHT - 5}
            y2={AXIS_HEIGHT}
            stroke={theme.strokeMuted}
          />
          <text
            className="castor-ruler__tick-label"
            x={x(v) + 2}
            y={AXIS_HEIGHT - 7}
            fontSize={9}
            fill={theme.textMuted}
          >
            {v === 0 ? '0' : kb(v, 0)}
          </text>
        </g>
      ))}

      {/* the parts, to scale */}
      {cassette.features.map((f, i) => {
        const w = Math.max(x(f.end) - x(f.start), 0.6)
        const selected = selectedInstanceId && f.instanceId === selectedInstanceId
        const fill = f.color ?? theme.partColors[f.role] ?? theme.partColors.custom
        const label = labelPlan[i]
        return (
          <g key={f.id}>
            <rect
              className={[
                'castor-ruler__seg',
                selected ? 'castor-ruler__seg--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              x={x(f.start)}
              y={trackY}
              width={w}
              height={TRACK_HEIGHT}
              fill={fill}
              stroke={selected ? theme.textPrimary : theme.surface}
              strokeWidth={selected ? 2 : 0.5}
              onClick={() => onSelect?.(f.instanceId ?? null)}
            >
              <title>{`${f.name} · ${f.end - f.start} bp · ${f.role}`}</title>
            </rect>
            {label && (
              <text
                className="castor-ruler__seg-label"
                x={label.centre}
                y={labelY}
                textAnchor="middle"
                fontSize={9}
                fill={theme.textMuted}
              >
                {label.text}
              </text>
            )}
          </g>
        )
      })}

      {/* the empty remainder is the headroom; leaving it blank is the whole idea */}
      <rect
        x={x(cassette.length)}
        y={trackY}
        width={Math.max(0, x(domainMax) - x(cassette.length))}
        height={TRACK_HEIGHT}
        fill="none"
        stroke={theme.strokeMuted}
        strokeDasharray="2 3"
        strokeWidth={0.75}
      />
      <line
        x1={x(cassette.length)}
        x2={x(cassette.length)}
        y1={trackY}
        y2={trackY + TRACK_HEIGHT}
        stroke={theme.textPrimary}
        strokeWidth={1}
      />
      </svg>
    </div>
  )
}

/** The one-line numeric readout that sits under the ruler. */
export function CapacityReadout({ assembly }: { assembly: AssemblyResult }) {
  const theme = useCastorTheme()
  const t = useMessages()
  const c = assembly.capacity
  const over = c.headroom < 0
  return (
    <p className="castor-hint" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
      <span>
        {t.cassette.itrToItr}{' '}
        <strong className="castor-num">{c.itrToItr.toLocaleString('en-US')}</strong> bp
      </span>
      <span>
        {t.cassette.cargo} <span className="castor-num">{c.cargo.toLocaleString('en-US')}</span> bp
      </span>
      <span className="castor-num" style={{ color: theme.capacityBands[c.band] }}>
        {over
          ? t.cassette.overLimit(Math.abs(c.headroom).toLocaleString('en-US'))
          : t.cassette.headroom(c.headroom.toLocaleString('en-US'))}
      </span>
      <span>{c.message}</span>
    </p>
  )
}
