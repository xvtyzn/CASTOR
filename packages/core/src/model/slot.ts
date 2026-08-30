import type { PartId, SlotKey } from './ids.js'

/**
 * What a part *is*, functionally. Drives which slots accept it, which validation rules
 * apply, and its default colour in both the cassette strip and the comparison view.
 */
export type PartRole =
  | 'backbone'
  | 'itr'
  | 'spacer'
  | 'enhancer'
  | 'promoter'
  | 'switch'
  | 'intron'
  | 'utr5'
  | 'kozak'
  | 'signal_peptide'
  | 'tag'
  | 'linker'
  | 'cds'
  | 'joiner'
  | 'stop'
  | 'utr3'
  | 'wpre'
  | 'polya'
  | 'stuffer'
  | 'shrna'
  | 'amirna_scaffold'
  | 'grna_scaffold'
  | 'terminator'
  | 'custom'

export const PART_ROLES: readonly PartRole[] = [
  'backbone', 'itr', 'spacer', 'enhancer', 'promoter', 'switch', 'intron', 'utr5', 'kozak',
  'signal_peptide', 'tag', 'linker', 'cds', 'joiner', 'stop', 'utr3', 'wpre', 'polya',
  'stuffer', 'shrna', 'amirna_scaffold', 'grna_scaffold', 'terminator', 'custom',
]

/**
 * The canonical ordering of an ss-AAV coding cassette, 5' to 3'.
 *
 * This is a CHECKER, not a generator. `Construct.cassette.parts` is a flat ordered array
 * and *its* order is the truth; the ordering rule compares against this list and reports a
 * finding when they disagree. That separation is what lets a user drag a tag past the CDS
 * and get a warning rather than a blocked interaction.
 */
export const CANONICAL_ORDER: readonly SlotKey[] = ([
  'backbone5',
  'itr_5',
  'spacer',
  'enhancer',
  'promoter',
  'switch_5',
  'intron',
  'utr5',
  'kozak',
  'signal_peptide',
  'tag_n',
  'linker_n',
  'cds',
  'linker_c',
  'tag_c',
  'joiner',
  'stop',
  'switch_3',
  'utr3',
  'wpre',
  'polya',
  'stuffer',
  'itr_3',
  'backbone3',
] as string[]) as SlotKey[]

/** Rank of a slot in the canonical order; `Infinity` for keys we do not know about. */
export function canonicalRank(key: SlotKey): number {
  const i = CANONICAL_ORDER.indexOf(key)
  return i === -1 ? Number.POSITIVE_INFINITY : i
}

/**
 * A named predicate, resolved against a registry at validation time rather than stored as
 * a closure — templates have to survive JSON serialisation.
 */
export interface PredicateRef {
  fn: string
  args?: Record<string, unknown>
}

/**
 * One socket in a cassette template.
 *
 * `max: null` is the "more of one thing" mechanism: three N-terminal tags, two enhancers.
 * For "another whole cistron" see {@link RepeatGroup} — conflating the two produces either
 * an unmaintainable template or a UI nobody can use.
 */
export interface SlotSpec {
  kind: 'slot'
  key: SlotKey
  label: string
  /** Which `Part.role` values this slot accepts. */
  roles: PartRole[]
  /** 0 means optional. */
  min: number
  /** `null` means unbounded. */
  max: number | null
  strand: 'forward' | 'reverse' | 'inherit'
  /** e.g. kozak is required only when a Pol II CDS follows. */
  requiredIf?: PredicateRef
  forbiddenIf?: PredicateRef
  /** Supplied by the backbone or the template; the user cannot remove or replace it. */
  locked?: boolean
  hint?: string
  /** Pre-filled when the template is instantiated. */
  defaultPartId?: PartId
}

/**
 * A repeatable block of slots — the mechanism behind "vary the components in number".
 * A multicistronic cassette is `RepeatGroup{ children: [kozak?, tag_n*, cds, tag_c*],
 * separator: joiner }` with `max: 4`.
 */
export interface RepeatGroup {
  kind: 'repeat'
  key: SlotKey
  label: string
  min: number
  max: number | null
  children: SlotSpec[]
  /** Placed BETWEEN consecutive repeats, never before the first or after the last. */
  separator?: SlotSpec
}

export type TemplateNode = SlotSpec | RepeatGroup

export const isSlotSpec = (n: TemplateNode): n is SlotSpec => n.kind === 'slot'
export const isRepeatGroup = (n: TemplateNode): n is RepeatGroup => n.kind === 'repeat'

/** Flattens a template into the slot specs it contains, repeat children included once. */
export function flattenSlots(nodes: readonly TemplateNode[]): SlotSpec[] {
  const out: SlotSpec[] = []
  for (const n of nodes) {
    if (isSlotSpec(n)) out.push(n)
    else {
      out.push(...n.children)
      if (n.separator) out.push(n.separator)
    }
  }
  return out
}

export function findSlot(nodes: readonly TemplateNode[], key: SlotKey): SlotSpec | undefined {
  return flattenSlots(nodes).find((s) => s.key === key)
}
