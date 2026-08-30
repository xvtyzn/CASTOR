import type { CartItemId, ConstructId } from './ids.js'
import type { Construct } from './construct.js'

/**
 * A design captured for comparison.
 *
 * `construct` is a frozen COPY, not a reference. A comparison figure whose rows silently
 * change when you go back and edit the design behind them is a bug factory; an explicit
 * "sync from source" action is the right affordance instead.
 */
export interface CartItem {
  itemId: CartItemId
  construct: Construct
  sourceConstructId?: ConstructId
  addedAt: string
  /** Row label in the comparison view. Defaults to `construct.name`. */
  label?: string
  color?: string
  visible: boolean
}

export interface Cart {
  id: string
  name: string
  items: CartItem[]
}

export function emptyCart(id = 'cart', name = 'Designs'): Cart {
  return { id, name, items: [] }
}
