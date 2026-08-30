/**
 * The pure designer reducer.
 *
 * This is the piece that makes the library embeddable rather than merely reusable: a host
 * already running Redux, Jotai or TanStack imports `designerReducer` and drives the whole
 * designer from its own store, with no provider and no global from us.
 */
import type { Backbone } from '../model/backbone.js'
import type { Cart, CartItem } from '../model/cart.js'
import type { Construct, PartInstance } from '../model/construct.js'
import type { CassetteTemplate } from '../model/template.js'
import type { Part } from '../model/part.js'
import {
  cartItemId as toCartItemId,
  instanceId as toInstanceId,
  type BackboneId,
  type CartItemId,
  type IdFactory,
  type InstanceId,
  type SlotKey,
} from '../model/ids.js'
import { flattenSlots } from '../model/slot.js'
import type { QuickFix } from '../validate/engine.js'

export interface DesignerState {
  construct: Construct
  cart: Cart
  selectedInstanceId: InstanceId | null
}

export type DesignerAction =
  | { type: 'setBackbone'; backboneId: BackboneId }
  | {
      type: 'addPart'
      slotKey: SlotKey
      part: Part
      strand?: 1 | -1
      /** Explicit array index. Omit to let the template decide where the part lands. */
      at?: number
    }
  | { type: 'replacePart'; instanceId: InstanceId; part: Part }
  | { type: 'removePart'; instanceId: InstanceId }
  | { type: 'movePart'; instanceId: InstanceId; toIndex: number }
  | { type: 'setStrand'; instanceId: InstanceId; strand: 1 | -1 }
  | { type: 'setPackaging'; packaging: 'ss' | 'sc' }
  | { type: 'setSerotype'; genome?: string; capsid?: string }
  | { type: 'rename'; name: string }
  | { type: 'select'; instanceId: InstanceId | null }
  | { type: 'applyFix'; fix: QuickFix }
  | { type: 'cart/add'; label?: string }
  | { type: 'cart/remove'; itemId: CartItemId }
  | { type: 'cart/toggleVisible'; itemId: CartItemId }
  | { type: 'cart/load'; itemId: CartItemId }
  | { type: 'cart/reorder'; itemIds: CartItemId[] }

export interface ReducerDeps {
  template: CassetteTemplate
  backbones: Backbone[]
  idFactory: IdFactory
  now: () => string
}

function touch(construct: Construct, deps: ReducerDeps): Construct {
  return { ...construct, updatedAt: deps.now() }
}

/**
 * Insert respecting the template's slot order.
 *
 * The template decides where a new part LANDS; it does not decide where parts may STAY. That
 * asymmetry is what lets "add a tag" do the obvious thing without the user thinking about
 * ordering, while leaving the array free to hold an order the template would never generate.
 */
function insertAt(
  parts: readonly PartInstance[],
  template: CassetteTemplate,
  slotKey: SlotKey,
): number {
  const order = flattenSlots(template.nodes).map((s) => String(s.key))
  const target = order.indexOf(String(slotKey))
  if (target === -1) return parts.length
  for (let i = 0; i < parts.length; i++) {
    const rank = order.indexOf(String(parts[i]!.slotKey))
    if (rank !== -1 && rank > target) return i
  }
  return parts.length
}

function uniqueLabel(cart: Cart, base: string): string {
  const taken = new Set(cart.items.map((i) => i.label ?? i.construct.name))
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})`
    if (!taken.has(candidate)) return candidate
  }
}

function lockedInstance(
  parts: readonly PartInstance[],
  instanceId: InstanceId,
  template: CassetteTemplate,
): boolean {
  const instance = parts.find((part) => part.instanceId === instanceId)
  if (!instance) return false
  const slot = flattenSlots(template.nodes).find((candidate) => candidate.key === instance.slotKey)
  return Boolean(instance.locked || slot?.locked)
}

export function designerReducer(
  state: DesignerState,
  action: DesignerAction,
  deps: ReducerDeps,
): DesignerState {
  switch (action.type) {
    case 'setBackbone':
      return {
        ...state,
        construct: touch({ ...state.construct, backboneId: action.backboneId }, deps),
      }

    case 'addPart': {
      const instance: PartInstance = {
        instanceId: toInstanceId(deps.idFactory(String(action.slotKey))),
        partId: action.part.id,
        slotKey: action.slotKey,
        repeatIndex: 0,
        strand: action.strand ?? 1,
        origin: 'user',
      }
      const parts = [...state.construct.cassette.parts]
      // An explicit index comes from an "insert here" on the map, where the user has already
      // said where they mean; otherwise the template places it canonically.
      const at =
        action.at === undefined
          ? insertAt(parts, deps.template, action.slotKey)
          : Math.max(0, Math.min(parts.length, action.at))
      parts.splice(at, 0, instance)
      return {
        ...state,
        selectedInstanceId: instance.instanceId,
        construct: touch({ ...state.construct, cassette: { parts } }, deps),
      }
    }

    case 'replacePart': {
      if (lockedInstance(state.construct.cassette.parts, action.instanceId, deps.template))
        return state
      const parts = state.construct.cassette.parts.map((p) =>
        p.instanceId === action.instanceId
          ? { ...p, partId: action.part.id, override: undefined }
          : p,
      )
      return { ...state, construct: touch({ ...state.construct, cassette: { parts } }, deps) }
    }

    case 'removePart': {
      if (lockedInstance(state.construct.cassette.parts, action.instanceId, deps.template))
        return state
      const parts = state.construct.cassette.parts.filter((p) => p.instanceId !== action.instanceId)
      return {
        ...state,
        selectedInstanceId:
          state.selectedInstanceId === action.instanceId ? null : state.selectedInstanceId,
        construct: touch({ ...state.construct, cassette: { parts } }, deps),
      }
    }

    case 'movePart': {
      if (lockedInstance(state.construct.cassette.parts, action.instanceId, deps.template))
        return state
      const parts = [...state.construct.cassette.parts]
      const from = parts.findIndex((p) => p.instanceId === action.instanceId)
      if (from === -1) return state
      const [moved] = parts.splice(from, 1)
      parts.splice(Math.max(0, Math.min(parts.length, action.toIndex)), 0, moved!)
      return { ...state, construct: touch({ ...state.construct, cassette: { parts } }, deps) }
    }

    case 'setStrand': {
      if (lockedInstance(state.construct.cassette.parts, action.instanceId, deps.template))
        return state
      const parts = state.construct.cassette.parts.map((p) =>
        p.instanceId === action.instanceId ? { ...p, strand: action.strand } : p,
      )
      return { ...state, construct: touch({ ...state.construct, cassette: { parts } }, deps) }
    }

    case 'setPackaging':
      return {
        ...state,
        construct: touch({ ...state.construct, packaging: action.packaging }, deps),
      }

    case 'setSerotype':
      return {
        ...state,
        construct: touch(
          {
            ...state.construct,
            ...(action.genome ? { genomeSerotype: action.genome } : {}),
            ...(action.capsid ? { capsidSerotype: action.capsid } : {}),
          },
          deps,
        ),
      }

    case 'rename':
      return { ...state, construct: touch({ ...state.construct, name: action.name }, deps) }

    case 'select':
      return { ...state, selectedInstanceId: action.instanceId }

    case 'applyFix':
      return { ...state, construct: touch(action.fix.apply(state.construct), deps) }

    case 'cart/add': {
      // A frozen copy, deliberately: a comparison figure whose rows change when you edit the
      // design behind them is worse than no figure at all.
      //
      // The label is disambiguated here rather than left to the caller, because the normal way
      // to use this tool is "build one, tweak it, add it again" — which without this produces
      // a comparison whose rows are all called the same thing and cannot be told apart.
      const label = action.label ?? uniqueLabel(state.cart, state.construct.name)
      const item: CartItem = {
        itemId: toCartItemId(deps.idFactory('item')),
        construct: structuredClone(state.construct),
        sourceConstructId: state.construct.id,
        addedAt: deps.now(),
        label,
        visible: true,
      }
      return { ...state, cart: { ...state.cart, items: [...state.cart.items, item] } }
    }

    case 'cart/remove':
      return {
        ...state,
        cart: { ...state.cart, items: state.cart.items.filter((i) => i.itemId !== action.itemId) },
      }

    case 'cart/toggleVisible':
      return {
        ...state,
        cart: {
          ...state.cart,
          items: state.cart.items.map((i) =>
            i.itemId === action.itemId ? { ...i, visible: !i.visible } : i,
          ),
        },
      }

    case 'cart/load': {
      const item = state.cart.items.find((i) => i.itemId === action.itemId)
      if (!item) return state
      return {
        ...state,
        selectedInstanceId: null,
        construct: structuredClone(item.construct),
      }
    }

    case 'cart/reorder': {
      const byId = new Map(state.cart.items.map((i) => [String(i.itemId), i]))
      const seen = new Set<string>()
      const items: CartItem[] = []
      for (const id of action.itemIds) {
        const key = String(id)
        const item = byId.get(key)
        if (!item || seen.has(key)) continue
        items.push(item)
        seen.add(key)
      }
      // A public reducer must not turn a partial or stale reorder payload into deletion.
      for (const item of state.cart.items) {
        if (!seen.has(String(item.itemId))) items.push(item)
      }
      return { ...state, cart: { ...state.cart, items } }
    }

    default:
      return state
  }
}
