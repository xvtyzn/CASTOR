import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { InsertionSite, Part, PartInstance, SlotSpec } from '@castor-bio/core'
import { useCastorTheme } from '../theme/useTheme.js'
import { bp } from '../format.js'
import { useMessages, type CastorMessages } from '../i18n.js'

/**
 * What the popover is about: a part that was clicked, or a place between parts.
 */
export type MapPopoverTarget =
  | { kind: 'instance'; instance: PartInstance; part: Part | undefined; slot: SlotSpec | undefined }
  | { kind: 'site'; site: InsertionSite }

export interface MapPopoverProps {
  target: MapPopoverTarget
  /** Position relative to the map container. */
  anchor: { x: number; y: number }
  onClose: () => void
  onReplace: (instance: PartInstance, slot: SlotSpec) => void
  onRemove: (instance: PartInstance) => void
  onFlip: (instance: PartInstance) => void
  onInsert: (slot: SlotSpec, index: number) => void
  onInsertAround: (instance: PartInstance, side: 'before' | 'after') => void
  length?: number
}

/**
 * Actions where the user clicked.
 *
 * The slot list already offers all of this, so the case for a second surface is not that it
 * adds capability — it is that the map is where you are looking when you notice something. A
 * gap between the promoter and the CDS is obvious on the map and invisible in a list of what
 * is already there, and "put a Kozak in that gap" should not require finding the right row
 * somewhere else.
 */
export function MapPopover({
  target,
  anchor,
  onClose,
  onReplace,
  onRemove,
  onFlip,
  onInsert,
  onInsertAround,
  length,
}: MapPopoverProps) {
  const theme = useCastorTheme()
  const t = useMessages()
  const ref = useRef<HTMLDivElement>(null)
  const [placed, setPlaced] = useState<{ left: number; top: number } | null>(null)

  /**
   * Keep the popover inside the map.
   *
   * Anchoring on the click alone puts it half off the left edge whenever the user clicks near
   * the start of the sequence, which is exactly where the ITR and the promoter are. Measure
   * once after mount and clamp; flip above the click if there is no room below.
   */
  useLayoutEffect(() => {
    const el = ref.current
    const parent = el?.offsetParent as HTMLElement | null
    if (!el || !parent) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    const pad = 8
    const left = Math.min(
      Math.max(anchor.x, pad + w / 2),
      Math.max(pad + w / 2, parent.clientWidth - pad - w / 2),
    )
    const below = anchor.y + 10
    const top = below + h > parent.clientHeight - pad ? Math.max(pad, anchor.y - h - 10) : below
    setPlaced({ left, top })
  }, [anchor.x, anchor.y, target])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    // Deferred: the click that opened this popover is still propagating.
    const t = setTimeout(() => document.addEventListener('pointerdown', onDown), 0)
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
      clearTimeout(t)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="castor-popover"
      role="dialog"
      aria-label={target.kind === 'instance' ? t.map.partActions : t.map.insertHere}
      tabIndex={-1}
      style={{
        left: placed?.left ?? anchor.x,
        top: placed?.top ?? anchor.y,
        // Hidden for the single frame between mount and measurement, so it never appears in
        // the wrong place first.
        visibility: placed ? 'visible' : 'hidden',
      }}
    >
      {target.kind === 'instance' ? (
        <>
          <div className="castor-popover__head">
            <span
              className="castor-slot__swatch"
              style={{
                background:
                  target.part?.color ??
                  theme.partColors[target.part?.role ?? 'custom'] ??
                  theme.partColors.custom,
              }}
            />
            <span className="castor-popover__title">
              {target.instance.override?.name ?? target.part?.name ?? 'Part'}
            </span>
          </div>
          <p className="castor-popover__meta">
            {[target.slot?.label, length !== undefined ? bp(length) : null]
              .filter(Boolean)
              .join(' · ')}
          </p>

          <div className="castor-popover__actions">
            {target.slot && !target.instance.locked && !target.slot.locked && (
              <button
                type="button"
                className="castor-popover__action"
                onClick={() => onReplace(target.instance, target.slot!)}
              >
                {t.common.replace}…
              </button>
            )}
            <button
              type="button"
              className="castor-popover__action"
              onClick={() => onInsertAround(target.instance, 'before')}
            >
              {t.map.insertBefore}
            </button>
            <button
              type="button"
              className="castor-popover__action"
              onClick={() => onInsertAround(target.instance, 'after')}
            >
              {t.map.insertAfter}
            </button>
            {!target.instance.locked && !target.slot?.locked && (
              <>
                <button
                  type="button"
                  className="castor-popover__action"
                  onClick={() => onFlip(target.instance)}
                >
                  {target.instance.strand === 1 ? t.slots.reverseComplement : t.map.backToForward}
                </button>
                <button
                  type="button"
                  className="castor-popover__action castor-popover__action--danger"
                  onClick={() => onRemove(target.instance)}
                >
                  {t.common.remove}
                </button>
              </>
            )}
            {(target.instance.locked || target.slot?.locked) && (
              <p className="castor-popover__meta" style={{ margin: '4px 8px 0' }}>
                {t.map.boundaryFixed}
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="castor-popover__head">
            <span className="castor-popover__title">{t.map.insertHere}</span>
          </div>
          <p className="castor-popover__meta">{describeSite(target.site, t)}</p>
          <div className="castor-popover__actions">
            {target.site.slots.length === 0 ? (
              <p className="castor-popover__meta" style={{ margin: '4px 8px 0' }}>
                {t.map.nothingFits}
              </p>
            ) : (
              target.site.slots.map((slot) => (
                <button
                  key={String(slot.key)}
                  type="button"
                  className="castor-popover__action"
                  title={slot.hint}
                  onClick={() => onInsert(slot, target.site.index)}
                >
                  {slot.label}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

function describeSite(site: InsertionSite, t: CastorMessages): string {
  if (site.before && site.after) {
    return t.map.between(String(site.before.slotKey), String(site.after.slotKey))
  }
  if (site.after) return t.map.beforeOnly(String(site.after.slotKey))
  if (site.before) return t.map.afterOnly(String(site.before.slotKey))
  return t.map.emptyCassette
}
