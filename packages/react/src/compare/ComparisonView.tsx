import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  autoFlip,
  autoOrder,
  computeLayout,
  DEFAULT_GEOM,
  DEFAULT_LAYOUT_OPTIONS,
  project,
  type ColorMode,
  type ComparisonModel,
  type GeomOptions,
  type GroupId,
  type LayoutOptions,
  type PartId,
  type RowId,
} from '@castor-bio/core'
import { useCastorTheme } from '../theme/useTheme.js'
import { useXZoom } from './useXZoom.js'
import { kb } from '../format.js'
import { useMessages } from '../i18n.js'

export interface ComparisonViewOptions {
  order?: RowId[]
  flipped?: Record<string, boolean>
  anchor?: { partId: PartId; justify: 'left' | 'center' | 'right' } | null
  colorMode?: ColorMode
  linkStyle?: GeomOptions['linkStyle']
  minIdentity?: number
  hiddenGroups?: GroupId[]
  showLabels?: boolean
}

export interface ComparisonViewProps {
  model: ComparisonModel
  options?: ComparisonViewOptions
  onOptionsChange?: (next: ComparisonViewOptions) => void
  onSelectItem?: (uid: string | null) => void
  toolbar?: boolean
  legend?: boolean
  width?: number
  className?: string
  footer?: ReactNode
}

const LABEL_GUTTER = 190

/**
 * The gggenomes-style comparison.
 *
 * One row per design, showing the pGOI only. Ribbons join parts that are the same catalogue
 * entry, so what you see between two rows is literally "these are the same part" — no
 * alignment, no thresholds to tune, no false homology. The gaps are the answer: where no
 * ribbon crosses, that is what differs.
 */
export function ComparisonView({
  model,
  options,
  onOptionsChange,
  onSelectItem,
  toolbar = true,
  legend = true,
  width = 1100,
  className,
  footer,
}: ComparisonViewProps) {
  const theme = useCastorTheme()
  const t = useMessages()
  const svgRef = useRef<SVGSVGElement>(null)
  // Unique per instance so two figures on one page cannot share a clip path.
  const clipId = useId()
  const [hoveredPartId, setHoveredPartId] = useState<PartId | null>(null)
  const [selectedUid, setSelectedUid] = useState<string | null>(null)

  const order = options?.order ?? model.rows.map((r) => r.id)
  const geom: GeomOptions = {
    ...DEFAULT_GEOM,
    linkStyle: options?.linkStyle ?? DEFAULT_GEOM.linkStyle,
  }

  const layoutOptions: LayoutOptions = {
    ...DEFAULT_LAYOUT_OPTIONS,
    order,
    flipped: options?.flipped ?? {},
    anchor: options?.anchor ?? null,
    labelGutter: LABEL_GUTTER,
    colorMode: options?.colorMode ?? 'byPartType',
    linkPolicy: {
      ...DEFAULT_LAYOUT_OPTIONS.linkPolicy,
      minIdentity: options?.minIdentity ?? 0,
      hiddenGroups: options?.hiddenGroups ?? [],
    },
    geom,
    theme,
  }

  const layout = useMemo(
    () => computeLayout(model, layoutOptions),
    // computeLayout is pure, so the memo key is just its inputs.
    [
      model,
      order.join('|'),
      JSON.stringify(options?.flipped ?? {}),
      options?.anchor?.partId,
      options?.anchor?.justify,
      options?.colorMode,
      options?.minIdentity,
      (options?.hiddenGroups ?? []).join('|'),
      geom.linkStyle,
      theme,
    ],
  )

  // Reserve the layout's right padding so the final arrowhead is not clipped by the viewport.
  const plotWidth = width - layoutOptions.padding.right
  const { xScale, reset, zoomBy, zoomToPxPerBase, pxPerBase, k, scaleExtent } = useXZoom(svgRef, {
    width: plotWidth,
    plotLeft: LABEL_GUTTER,
    domain: layout.domain,
  })

  // Hovering a part highlights every instance of the SAME part in every row. This is the
  // single most useful affordance in the view: it answers "is this the same one?" instantly.
  const highlightedUids = useMemo(() => {
    if (!hoveredPartId && !selectedUid) return undefined
    const partId = hoveredPartId ?? layout.itemsByUid.get(selectedUid!)?.partId
    if (!partId) return undefined
    return new Set(layout.uidsByPartId.get(partId) ?? [])
  }, [hoveredPartId, selectedUid, layout])

  const px = useMemo(
    () =>
      project(layout, xScale, { width: plotWidth, plotLeft: LABEL_GUTTER }, {
        geom,
        rowHeight: layoutOptions.rowHeight,
        minLabelWidthPx: options?.showLabels === false ? Number.POSITIVE_INFINITY : 34,
        overscanPx: 240,
        ...(highlightedUids ? { highlightedUids, dimUnhighlighted: true } : {}),
      }),
    [layout, xScale, plotWidth, geom, highlightedUids, options?.showLabels],
  )

  const set = (patch: ComparisonViewOptions) => onOptionsChange?.({ ...options, ...patch })

  const anchorLabel = options?.anchor
    ? layout.itemsByUid.get(layout.uidsByPartId.get(options.anchor.partId)?.[0] ?? '')?.label
    : undefined

  const toggleGroup = (id: GroupId, hidden: boolean) =>
    set({
      hiddenGroups: hidden
        ? (options?.hiddenGroups ?? []).filter((h) => h !== id)
        : [...(options?.hiddenGroups ?? []), id],
    })

  /**
   * The legend is derived from the LAID OUT items, not from the model's groups.
   *
   * Reading it off the model looks equivalent and is not: the arrows are filled by whatever
   * the active colour mode decided, so a legend built from the group palette shows an ITR in
   * blue while the ITR on screen is slate. Deriving both from the same source makes that class
   * of mismatch unrepresentable.
   */
  const legendEntries = useMemo(() => {
    const byKey = new Map<
      string,
      { key: string; label: string; color: string; groupId?: GroupId; hidden: boolean }
    >()
    const hiddenGroups = new Set(options?.hiddenGroups ?? [])
    const colorMode = options?.colorMode ?? 'byPartType'

    for (const item of layout.items) {
      // In part-type mode one entry per role; in identity mode one per part.
      const key = colorMode === 'byPartType' ? item.role : String(item.partId)
      if (byKey.has(key)) continue
      const groupId =
        colorMode === 'byPartType'
          ? undefined
          : model.groups.find((g) => g.memberPartIds.includes(item.partId))?.id
      byKey.set(key, {
        key,
        label: colorMode === 'byPartType' ? item.role : item.label,
        color: item.fill,
        ...(groupId ? { groupId } : {}),
        hidden: groupId ? hiddenGroups.has(groupId) : false,
      })
    }
    return [...byKey.values()]
  }, [layout.items, options?.colorMode, options?.hiddenGroups, model.groups])

  if (model.rows.length === 0) {
    return (
      <p className={['castor-hint', className].filter(Boolean).join(' ')}>
        {t.compare.needTwo}
      </p>
    )
  }

  return (
    <div className={className}>
      {toolbar && (
        <div className="castor-compare__toolbar">
          <label className="castor-compare__field">
            {t.compare.colour}
            <select
              className="castor-select"
              value={options?.colorMode ?? 'byPartType'}
              onChange={(e) => set({ colorMode: e.target.value as ColorMode })}
            >
              <option value="byPartType">{t.compare.byPartType}</option>
              <option value="byHomologyGroup">{t.compare.byHomologyGroup}</option>
              <option value="byIdentity">{t.compare.byIdentity}</option>
            </select>
          </label>

          <label className="castor-compare__field">
            {t.compare.ribbons}
            <select
              className="castor-select"
              value={geom.linkStyle}
              onChange={(e) => set({ linkStyle: e.target.value as GeomOptions['linkStyle'] })}
            >
              <option value="straight">{t.compare.straight}</option>
              <option value="curved">{t.compare.curved}</option>
            </select>
          </label>

          <label className="castor-compare__field">
            {t.compare.alignOn}
            <select
              className="castor-select"
              value={options?.anchor ? String(options.anchor.partId) : ''}
              onChange={(e) =>
                set({
                  anchor: e.target.value
                    ? { partId: e.target.value as PartId, justify: 'left' }
                    : null,
                })
              }
            >
              <option value="">{t.compare.alignNothing}</option>
              {[...layout.uidsByPartId.keys()].map((pid) => {
                const item = layout.itemsByUid.get(layout.uidsByPartId.get(pid)![0]!)
                return (
                  <option key={String(pid)} value={String(pid)}>
                    {item?.label ?? String(pid)}
                  </option>
                )
              })}
            </select>
          </label>

          <button
            type="button"
            className="castor-btn"
            onClick={() => set({ order: autoOrder(model.rows) })}
          >
            {t.compare.orderBySimilarity}
          </button>
          <button
            type="button"
            className="castor-btn"
            onClick={() => set({ flipped: autoFlip(model.rows, order, model.links) })}
          >
            {t.compare.autoOrient}
          </button>
          <span className="castor-compare__field" style={{ gap: 2 }}>
            {t.compare.zoom}
            <button
              type="button"
              className="castor-btn"
              aria-label={t.compare.zoomOut}
              disabled={k <= scaleExtent[0] + 1e-6}
              onClick={() => zoomBy(1 / 1.8)}
            >
              −
            </button>
            <button
              type="button"
              className="castor-btn"
              aria-label={t.compare.zoomIn}
              disabled={k >= scaleExtent[1] - 1e-6}
              onClick={() => zoomBy(1.8)}
            >
              +
            </button>
            {/* A direct route to base-level rather than a dozen wheel notches. The threshold
                lives in project(); 9 px per base clears it with room to read. */}
            <button
              type="button"
              className="castor-btn"
              onClick={() => (pxPerBase >= 7 ? reset() : zoomToPxPerBase(9))}
            >
              {pxPerBase >= 7 ? t.compare.fit : t.compare.readSequence}
            </button>
          </span>
          <span className="castor-compare__field" style={{ marginLeft: 'auto' }}>
            {px.basesTruncated
              ? t.compare.tooManyRows
              : px.bases.length > 0
                ? options?.anchor
                  ? t.compare.sequenceShownAligned(anchorLabel ?? '')
                  : t.compare.sequenceShownUnaligned
                : t.compare.sequenceHidden}
          </span>
        </div>
      )}

      <div className="castor-compare__scroll">
        <svg
          ref={svgRef}
          className="castor-compare__svg"
          width={width}
          height={layout.height}
          role="img"
          aria-label={`Linear comparison of ${layout.rows.length} designs`}
        >
          <rect width={width} height={layout.height} fill={theme.surface} />

          {/* Everything that lives in bp space is clipped to the plot area. Without this a
              zoomed-in part extends left past the gutter and paints over the row labels — the
              one place in the figure that must stay readable at every zoom. */}
          <defs>
            <clipPath id={clipId}>
              <rect
                x={LABEL_GUTTER}
                y={0}
                width={Math.max(0, width - LABEL_GUTTER)}
                height={layout.height}
              />
            </clipPath>
          </defs>

          <g clipPath={`url(#${clipId})`}>
          {/* ribbons first: they sit under the arrows */}
          <g aria-hidden="true">
            {px.ribbons.map((r) =>
              r.d ? (
                <path key={r.id} d={r.d} fill={r.fill} fillOpacity={r.opacity} stroke="none" />
              ) : (
                <polygon
                  key={r.id}
                  points={r.points}
                  fill={r.fill}
                  fillOpacity={r.opacity}
                  stroke="none"
                />
              ),
            )}
          </g>

          {/* backbones */}
          <g aria-hidden="true">
            {px.backbones.map((b) => (
              <line
                key={String(b.rowId)}
                x1={b.x0}
                x2={b.x1}
                y1={b.y}
                y2={b.y}
                stroke={theme.strokeStrong}
                strokeWidth={1}
              />
            ))}
          </g>

          {/* arrows */}
          <g>
            {px.arrows.map((a) => (
              <polygon
                key={a.uid}
                className="castor-compare__arrow"
                points={a.points}
                fill={a.fill}
                fillOpacity={a.opacity}
                stroke={a.stroke}
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
                onMouseEnter={() => setHoveredPartId(a.partId)}
                onMouseLeave={() => setHoveredPartId(null)}
                onClick={() => {
                  const next = selectedUid === a.uid ? null : a.uid
                  setSelectedUid(next)
                  onSelectItem?.(next)
                }}
              >
                <title>{describe(layout.itemsByUid.get(a.uid))}</title>
              </polygon>
            ))}
          </g>

          {/* part labels, culled by width in project() */}
          <g aria-hidden="true">
            {px.labels.map((l) => (
              <text
                key={l.uid}
                className="castor-compare__item-label"
                x={l.x}
                y={l.y}
                textAnchor={l.anchor}
              >
                {l.text}
              </text>
            ))}
          </g>

          {/* the sequence itself, once each base has room to be read */}
          <g aria-hidden="true">
            {px.bases.map((b, i) => (
              <text
                key={`${String(b.rowId)}:${i}`}
                className="castor-compare__base"
                x={b.x}
                y={b.y}
                textAnchor="middle"
                fontSize={b.fontSize}
                fill={theme.textPrimary}
              >
                {b.base}
              </text>
            ))}
          </g>

          </g>

          {/* row labels, in the gutter outside the plot */}
          <g>
            {px.rowLabels.map((r) => (
              <g key={String(r.rowId)}>
                <text className="castor-compare__row-label" x={8} y={r.y - 1}>
                  {r.label}
                  {r.flipped ? ' ←' : ''}
                </text>
                {r.sublabel && (
                  <text className="castor-compare__row-sub" x={8} y={r.y + 11}>
                    {r.sublabel}
                  </text>
                )}
              </g>
            ))}
          </g>

          {/* bp axis along the bottom */}
          <AxisBp
            xScale={xScale}
            domain={layout.domain}
            y={layout.height - 12}
            plotLeft={LABEL_GUTTER}
            width={width}
            color={theme.textMuted}
          />
        </svg>
      </div>

      {legend && (
        <div className="castor-legend">
          {legendEntries.map((e) => (
            <button
              key={e.key}
              type="button"
              className="castor-legend__item"
              aria-pressed={!e.hidden}
              onClick={() => e.groupId && toggleGroup(e.groupId, e.hidden)}
              disabled={!e.groupId}
              style={!e.groupId ? { cursor: 'default' } : undefined}
            >
              <span
                className="castor-legend__swatch"
                style={{ background: e.color, opacity: e.hidden ? 0.3 : 1 }}
              />
              {e.label}
            </button>
          ))}
        </div>
      )}
      {footer}
    </div>
  )
}

function describe(item: { label: string; x0: number; x1: number; role: string } | undefined): string {
  if (!item) return ''
  return `${item.label} · ${Math.round(item.x1 - item.x0)} bp · ${item.role}`
}

function AxisBp({
  xScale,
  domain,
  y,
  plotLeft,
  width,
  color,
}: {
  xScale: (bp: number) => number
  domain: [number, number]
  y: number
  plotLeft: number
  width: number
  color: string
}) {
  // Step from what is VISIBLE, not from the whole domain: at base-level zoom a 500 bp step
  // puts zero ticks on screen, and an axis with no ticks is just a line.
  const bpAt = (px: number) => {
    const x0 = xScale(0)
    const per = xScale(1) - x0
    return per === 0 ? 0 : (px - x0) / per
  }
  const from = Math.max(domain[0], bpAt(plotLeft))
  const to = Math.min(domain[1], bpAt(width))
  const visible = Math.max(1, to - from)
  const raw = visible / 6
  const step =
    [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000].find((s) => s >= raw) ?? 10000
  const ticks: number[] = []
  for (let v = Math.ceil(from / step) * step; v <= to; v += step) ticks.push(v)

  return (
    <g aria-hidden="true">
      {ticks.map((v) => {
        const x = xScale(v)
        if (x < plotLeft || x > width) return null
        return (
          <g key={v}>
            <line x1={x} x2={x} y1={y - 4} y2={y} stroke={color} strokeWidth={0.75} />
            <text
              className="castor-compare__row-sub"
              x={x + 3}
              y={y - 1}
              fill={color}
            >
              {/* Below a kilobase per tick the reader is counting bases, so show bases. */}
              {v === 0 ? '0' : step < 1000 ? v.toLocaleString('en-US') : kb(v, 0)}
            </text>
          </g>
        )
      })}
    </g>
  )
}
