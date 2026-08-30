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
import type { AssemblyResult, Cart, CartItem, CartItemId } from '@castor-bio/core'
import { useCastorTheme } from '../theme/useTheme.js'
import { kb } from '../format.js'
import { useMessages } from '../i18n.js'

export interface CartPanelProps {
  cart: Cart
  assemblies: Map<string, AssemblyResult>
  onAdd?: () => void
  onRemove: (itemId: CartItemId) => void
  onToggleVisible: (itemId: CartItemId) => void
  onReorder: (itemIds: CartItemId[]) => void
  onLoad?: (itemId: CartItemId) => void
  canAdd?: boolean
  className?: string
}

/**
 * Saved designs, in the order they appear as rows in the comparison.
 *
 * Order matters here for more than tidiness: the comparison links only NEIGHBOURING rows, so
 * which two designs sit next to each other decides which ribbons get drawn. Reordering the
 * list is how you choose what gets compared against what.
 *
 * Each entry is a frozen snapshot. Editing the design after saving it does not change the
 * figure; "Open" explicitly loads a snapshot back into the editor.
 */
export function CartPanel({
  cart,
  assemblies,
  onAdd,
  onRemove,
  onToggleVisible,
  onReorder,
  onLoad,
  canAdd = true,
  className,
}: CartPanelProps) {
  const theme = useCastorTheme()
  const t = useMessages()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = cart.items.map((i) => String(i.itemId))
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    const next = [...ids]
    next.splice(to, 0, next.splice(from, 1)[0]!)
    onReorder(next as CartItemId[])
  }

  return (
    <div className={className}>
      {cart.items.length === 0 ? (
        <p className="castor-hint">{t.cart.empty}</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={cart.items.map((i) => String(i.itemId))}
            strategy={verticalListSortingStrategy}
          >
            <div className="castor-cart">
              {cart.items.map((item) => (
                <CartRow
                  key={String(item.itemId)}
                  item={item}
                  assembly={assemblies.get(String(item.itemId))}
                  onRemove={onRemove}
                  onToggleVisible={onToggleVisible}
                  {...(onLoad ? { onLoad } : {})}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {cart.items.length > 1 && (
        <p className="castor-hint" style={{ marginTop: 8 }}>
          {t.cart.neighbourHint}
        </p>
      )}

      {onAdd && (
        <button
          type="button"
          className="castor-btn castor-btn--primary"
          style={{ marginTop: 10 }}
          onClick={onAdd}
          disabled={!canAdd}
        >
          {t.cart.addDesign}
        </button>
      )}
      {!canAdd && (
        <p className="castor-hint" style={{ marginTop: 6, color: theme.textMuted }}>
          {t.cart.fillRequired}
        </p>
      )}
    </div>
  )
}

function CartRow({
  item,
  assembly,
  onRemove,
  onToggleVisible,
  onLoad,
}: {
  item: CartItem
  assembly: AssemblyResult | undefined
  onRemove: (id: CartItemId) => void
  onToggleVisible: (id: CartItemId) => void
  onLoad?: (id: CartItemId) => void
}) {
  const t = useMessages()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(item.itemId),
  })
  const name = item.label ?? item.construct.name

  return (
    <div
      ref={setNodeRef}
      className={['castor-cart__item', isDragging ? 'castor-cart__item--dragging' : '']
        .filter(Boolean)
        .join(' ')}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type="button"
        className="castor-cart__grip"
        aria-label={t.common.reorderHint(name)}
        {...attributes}
        {...listeners}
      >
        <svg width="8" height="14" viewBox="0 0 8 14" aria-hidden="true" focusable="false">
          {[2, 7, 12].map((y) =>
            [1, 6].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="currentColor" />),
          )}
        </svg>
      </button>
      <input
        type="checkbox"
        checked={item.visible}
        onChange={() => onToggleVisible(item.itemId)}
        aria-label={t.cart.showInComparison(name)}
      />
      <span className="castor-cart__name">{name}</span>
      <span className="castor-cart__meta castor-num">
        {assembly ? kb(assembly.cassette.length) : '—'}
      </span>
      <span style={{ display: 'flex', gap: 2 }}>
        {onLoad && (
          <button
            type="button"
            className="castor-btn castor-btn--ghost"
            onClick={() => onLoad(item.itemId)}
          >
            {t.common.open}
          </button>
        )}
        <button
          type="button"
          className="castor-btn castor-btn--ghost"
          onClick={() => onRemove(item.itemId)}
        >
          {t.common.remove}
        </button>
      </span>
    </div>
  )
}
