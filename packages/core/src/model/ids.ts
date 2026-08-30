/**
 * Branded identifiers.
 *
 * `PartId`, `InstanceId`, `ConstructId` and friends are all strings, they are passed to
 * many of the same functions, and swapping two of them is a bug that is invisible both to
 * the compiler and to tests whose fixtures use realistic-looking values. The brand costs
 * one cast at the boundary and buys a compile error everywhere else.
 */

declare const brand: unique symbol
type Brand<T, B extends string> = T & { readonly [brand]: B }

export type PartId = Brand<string, 'PartId'>
export type InstanceId = Brand<string, 'InstanceId'>
export type ConstructId = Brand<string, 'ConstructId'>
export type BackboneId = Brand<string, 'BackboneId'>
export type TemplateId = Brand<string, 'TemplateId'>
export type SlotKey = Brand<string, 'SlotKey'>
export type GroupId = Brand<string, 'GroupId'>
export type RowId = Brand<string, 'RowId'>
export type CartItemId = Brand<string, 'CartItemId'>

export const partId = (s: string): PartId => s as PartId
export const instanceId = (s: string): InstanceId => s as InstanceId
export const constructId = (s: string): ConstructId => s as ConstructId
export const backboneId = (s: string): BackboneId => s as BackboneId
export const templateId = (s: string): TemplateId => s as TemplateId
export const slotKey = (s: string): SlotKey => s as SlotKey
export const groupId = (s: string): GroupId => s as GroupId
export const rowId = (s: string): RowId => s as RowId
export const cartItemId = (s: string): CartItemId => s as CartItemId

/**
 * Id factory. Injected rather than imported so that `computeLayout` and `assemble` stay
 * deterministic under test — a golden-file snapshot cannot tolerate a random id.
 */
export interface IdFactory {
  (prefix: string): string
}

/** Deterministic, monotonic. The default for tests and for anything snapshotted. */
export function createCountingIdFactory(): IdFactory {
  let n = 0
  return (prefix: string) => `${prefix}-${++n}`
}

/** Non-deterministic. The default at runtime, where uniqueness across sessions matters. */
export function createRandomIdFactory(): IdFactory {
  return (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

/** Index a list by a key selector. Saves every caller writing the same three-line Map build. */
export function indexBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T> {
  return new Map(items.map((item) => [key(item), item]))
}
