import { useMemo } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  flattenSlots,
  isSlotSpec,
  type AssemblyResult,
  type CassetteTemplate,
  type Construct,
  type InstanceId,
  type Part,
  type PartId,
  type PartInstance,
  type PartRole,
  type SlotKey,
  type SlotSpec,
  type ValidationReport,
} from '@castor-bio/core'
import { useCastorTheme } from '../theme/useTheme.js'
import { shortLength } from '../format.js'
import { useMessages } from '../i18n.js'

export interface PartRequest {
  slotKey: SlotKey
  repeatIndex: number
  roles: PartRole[]
  label: string
  hint?: string
  replacingInstanceId?: InstanceId
  /**
   * Where to splice the new part in. Set when the request came from a click on the map, where
   * the user already pointed at the position; omitted from the slot list, where the template
   * decides.
   */
  at?: number
}

export interface SlotListProps {
  construct: Construct
  template: CassetteTemplate
  assembly: AssemblyResult
  parts: (id: PartId) => Part | undefined
  findings?: ValidationReport
  selectedInstanceId?: InstanceId | null
  onSelect?: (id: InstanceId | null) => void
  onRequestPart: (request: PartRequest) => void
  onRemove: (id: InstanceId) => void
  /** New index within `construct.cassette.parts`. */
  onMove: (id: InstanceId, toIndex: number) => void
  onSetStrand?: (id: InstanceId, strand: 1 | -1) => void
  className?: string
}

/**
 * The cassette, in the order it is actually in.
 *
 * This list renders `construct.cassette.parts` in array order rather than grouping by
 * template slot, because the array order IS the construct — the template only says what each
 * slot accepts and where a newly picked part should land. Rendering by template would quietly
 * undo any reordering the user did, which is the same as not supporting reordering at all.
 *
 * Unfilled slots are still shown, inserted at their canonical position, so the template keeps
 * advertising what is possible without dictating what is there.
 */
export function SlotList({
  construct,
  template,
  assembly,
  parts,
  findings,
  selectedInstanceId,
  onSelect,
  onRequestPart,
  onRemove,
  onMove,
  onSetStrand,
  className,
}: SlotListProps) {
  const t = useMessages()
  const slots = useMemo(() => flattenSlots(template.nodes.filter(isSlotSpec)), [template])
  const slotByKey = useMemo(() => new Map(slots.map((s) => [String(s.key), s])), [slots])

  /**
   * Part rows in true array order, plus ONE trailing row of chips for the slots that can still
   * take something.
   *
   * The first version interleaved an "add" row at each empty slot's canonical position. That
   * is defensible — it shows the template's shape in place — but on a real cassette it puts
   * seven placeholder rows among seven parts, and once a part has been dragged out of
   * canonical order the placeholders float to positions that no longer mean anything. Chips
   * keep the same discoverability in one line, and each one still inserts canonically.
   */
  const partRows = useMemo(
    () =>
      construct.cassette.parts.map((instance) => ({
        key: String(instance.instanceId),
        instance,
        slot: slotByKey.get(String(instance.slotKey)),
      })),
    [construct.cassette.parts, slotByKey],
  )

  const addable = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of construct.cassette.parts) {
      counts.set(String(p.slotKey), (counts.get(String(p.slotKey)) ?? 0) + 1)
    }
    return slots
      .filter((slot) => {
        if (slot.locked) return false
        const have = counts.get(String(slot.key)) ?? 0
        return slot.max === null || have < slot.max
      })
      .map((slot) => ({
        slot,
        required: slot.min > (counts.get(String(slot.key)) ?? 0),
      }))
  }, [construct.cassette.parts, slots])

  const sortableIds = useMemo(
    () => construct.cassette.parts.filter((p) => !p.locked).map((p) => String(p.instanceId)),
    [construct.cassette.parts],
  )

  const sensors = useSensors(
    // A small activation distance keeps a click on the row from being read as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const all = construct.cassette.parts.map((p) => String(p.instanceId))
    const from = all.indexOf(String(active.id))
    const to = all.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    onMove(active.id as InstanceId, to)
  }

  return (
    <div className={['castor-slots', className].filter(Boolean).join(' ')}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {partRows.map((row) => (
            <PartRow
              key={row.key}
              instance={row.instance}
              slot={row.slot}
              part={parts(row.instance.partId)}
              assembly={assembly}
              findings={findings}
              selected={selectedInstanceId === row.instance.instanceId}
              onSelect={onSelect}
              onReplace={() =>
                row.slot &&
                onRequestPart({
                  slotKey: row.slot.key,
                  repeatIndex: 0,
                  roles: row.slot.roles,
                  label: row.slot.label,
                  ...(row.slot.hint !== undefined ? { hint: row.slot.hint } : {}),
                  replacingInstanceId: row.instance.instanceId,
                })
              }
              onRemove={() => onRemove(row.instance.instanceId)}
              {...(onSetStrand ? { onSetStrand } : {})}
            />
          ))}
        </SortableContext>
      </DndContext>

      {addable.length > 0 && (
        <div className="castor-add">
          <span className="castor-add__label">{t.slots.addLabel}</span>
          <span className="castor-add__chips">
            {addable.map(({ slot, required }) => (
              <button
                key={String(slot.key)}
                type="button"
                className={['castor-chip', required ? 'castor-chip--required' : '']
                  .filter(Boolean)
                  .join(' ')}
                title={slot.hint}
                onClick={() =>
                  onRequestPart({
                    slotKey: slot.key,
                    repeatIndex: 0,
                    roles: slot.roles,
                    label: slot.label,
                    ...(slot.hint !== undefined ? { hint: slot.hint } : {}),
                  })
                }
              >
                {slot.label}
                {required && <span aria-label={t.shell.required}> *</span>}
              </button>
            ))}
          </span>
        </div>
      )}
      {addable.some((a) => a.required) && (
        <p className="castor-hint" style={{ marginTop: 6 }}>
          {t.slots.requiredFootnote}
        </p>
      )}
    </div>
  )
}

function PartRow({
  instance,
  slot,
  part,
  assembly,
  findings,
  selected,
  onSelect,
  onReplace,
  onRemove,
  onSetStrand,
}: {
  instance: PartInstance
  slot: SlotSpec | undefined
  part: Part | undefined
  assembly: AssemblyResult
  findings?: ValidationReport
  selected: boolean
  onSelect?: (id: InstanceId | null) => void
  onReplace: () => void
  onRemove: () => void
  onSetStrand?: (id: InstanceId, strand: 1 | -1) => void
}) {
  const theme = useCastorTheme()
  const t = useMessages()
  const locked = Boolean(instance.locked || slot?.locked)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(instance.instanceId),
    disabled: locked,
  })

  const range = assembly.index.get(instance.instanceId)
  const length = range ? range.cassette.end - range.cassette.start : (part?.length ?? 0)

  const list = findings?.byInstance.get(instance.instanceId)
  const severity = list?.some((f) => f.severity === 'error')
    ? ('error' as const)
    : list?.some((f) => f.severity === 'warning')
      ? ('warning' as const)
      : list?.length
        ? ('info' as const)
        : null
  const severityColor = {
    error: theme.capacityBands.error,
    warning: theme.capacityBands['near-limit'],
    info: theme.textMuted,
  }

  return (
    <div
      ref={setNodeRef}
      className={[
        'castor-slot',
        selected ? 'castor-slot--selected' : '',
        isDragging ? 'castor-slot--dragging' : '',
        locked ? 'castor-slot--locked' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={() => onSelect?.(instance.instanceId)}
    >
      <span className="castor-slot__label">
        {locked ? (
          <span title={t.slots.lockedHint}>{slot?.label}</span>
        ) : (
          <button
            type="button"
            className="castor-slot__grip"
            aria-label={t.common.reorderHint(part?.name ?? 'part')}
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripIcon />
            <span className="castor-slot__grip-text">
              {slot?.label ?? String(instance.slotKey)}
            </span>
          </button>
        )}
      </span>

      <span className="castor-slot__value">
        <span
          className="castor-slot__swatch"
          style={{
            background:
              part?.color ?? theme.partColors[part?.role ?? 'custom'] ?? theme.partColors.custom,
          }}
        />
        <span className="castor-slot__name">
          {instance.override?.name ?? part?.name ?? String(instance.partId)}
        </span>
        {severity && (
          <span
            aria-label={t.shell.finding(severity)}
            title={list?.[0]?.title}
            style={{ color: severityColor[severity], fontSize: 11 }}
          >
            ●
          </span>
        )}
        {instance.strand === -1 && (
          <span className="castor-slot__flag" title={t.slots.reverseComplement}>
            ←
          </span>
        )}
        {instance.origin === 'auto' && (
          <span className="castor-slot__flag" title={t.slots.autoInserted}>
            auto
          </span>
        )}
      </span>

      <span className="castor-slot__len castor-num">{shortLength(length)}</span>

      <span className="castor-slot__actions">
        {locked ? (
          <span className="castor-slot__flag">{t.common.locked}</span>
        ) : (
          <>
            {onSetStrand && (
              <button
                type="button"
                className="castor-btn castor-btn--ghost"
                title={t.slots.reverseComplement}
                onClick={(e) => {
                  e.stopPropagation()
                  onSetStrand(instance.instanceId, instance.strand === 1 ? -1 : 1)
                }}
              >
                {t.common.flip}
              </button>
            )}
            <button
              type="button"
              className="castor-btn castor-btn--ghost"
              onClick={(e) => {
                e.stopPropagation()
                onReplace()
              }}
            >
              {t.common.replace}
            </button>
            <button
              type="button"
              className="castor-btn castor-btn--ghost"
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
            >
              {t.common.remove}
            </button>
          </>
        )}
      </span>
    </div>
  )
}

function GripIcon() {
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" aria-hidden="true" focusable="false">
      {[2, 7, 12].map((y) =>
        [1, 6].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="currentColor" />),
      )}
    </svg>
  )
}
