/**
 * Acting on the cassette from the map.
 *
 * The interesting part is not the popover, it is the question behind it: given a place in the
 * cassette, what could go there? An "insert here" that offers all twelve slots is no better
 * than the list it duplicates.
 */
import { describe, expect, it } from 'vitest'
import {
  analyze,
  createConstruct,
  createCountingIdFactory,
  designerReducer,
  emptyCart,
  indexBy,
  insertionSiteAround,
  insertionSiteAt,
  partId as toPartId,
  resolveCassettePosition,
  type DesignerState,
  type Part,
} from '@castor-bio/core'
import { loadCatalog } from './index.js'

const catalog = await loadCatalog()
const template = catalog.templates[0]!
const backbone = catalog.backbones[0]!
const parts = indexBy(catalog.parts, (p: Part) => p.id)
const lookup = (id: ReturnType<typeof toPartId>) => parts.get(id)

function makeDeps() {
  return {
    template,
    backbones: catalog.backbones,
    idFactory: createCountingIdFactory(),
    now: () => '2026-08-30T00:00:00.000Z',
  }
}

function filled(): DesignerState {
  const deps = makeDeps()
  let s: DesignerState = {
    construct: createConstruct(template, backbone, {
      idFactory: createCountingIdFactory(),
      now: '2026-08-30T00:00:00.000Z',
    }),
    cart: emptyCart(),
    selectedInstanceId: null,
  }
  for (const [slot, part] of [
    ['promoter', 'promoter/CAG-935@1.0.0'],
    ['cds', 'cds/EGFP@1.0.0'],
    ['polya', 'polya/SV40@1.0.0'],
  ] as const) {
    s = designerReducer(s, { type: 'addPart', slotKey: slot as never, part: lookup(toPartId(part))! }, deps)
  }
  return s
}

const slotKeys = (s: DesignerState) => s.construct.cassette.parts.map((p) => String(p.slotKey))

describe('what can go here', () => {
  const state = filled()

  it('offers only the slots whose canonical position falls between the neighbours', () => {
    // ... kozak | cds ... — a tag or a linker belongs there, a promoter or a polyA does not.
    const cdsIndex = slotKeys(state).indexOf('cds')
    const site = insertionSiteAt(state.construct, template, cdsIndex)
    expect(site.slots.map((s) => String(s.key))).toEqual(['tag_n', 'linker_n'])
    expect(String(site.before?.slotKey)).toBe('kozak')
    expect(String(site.after?.slotKey)).toBe('cds')
  })

  it('does not offer a single-capacity slot that is already filled', () => {
    // Between the 5' ITR and the promoter: enhancer is unbounded and open; the promoter itself
    // is max 1 and taken.
    const site = insertionSiteAt(state.construct, template, 1)
    const keys = site.slots.map((s) => String(s.key))
    expect(keys).toContain('enhancer')
    expect(keys).not.toContain('promoter')
  })

  it('never offers a locked slot — the ITRs are the boundary, not a choice', () => {
    for (let i = 0; i <= state.construct.cassette.parts.length; i++) {
      const keys = insertionSiteAt(state.construct, template, i).slots.map((s) => String(s.key))
      expect(keys).not.toContain('itr_5')
      expect(keys).not.toContain('itr_3')
    }
  })

  it('resolves "before" and "after" a part to the two sites around it', () => {
    const cds = state.construct.cassette.parts.find((p) => String(p.slotKey) === 'cds')!
    const before = insertionSiteAround(state.construct, template, cds.instanceId, 'before')
    const after = insertionSiteAround(state.construct, template, cds.instanceId, 'after')
    expect(String(before.after?.slotKey)).toBe('cds')
    expect(String(after.before?.slotKey)).toBe('cds')
    expect(after.slots.map((s) => String(s.key))).toContain('linker_c')
    expect(after.slots.map((s) => String(s.key))).toContain('tag_c')
  })
})

describe('turning a click into a target', () => {
  const state = filled()
  const { assembly } = analyze(state.construct, backbone, template, lookup)
  const ranges = new Map([...assembly.index].map(([id, r]) => [id, r.cassette]))

  it('a position inside a part resolves to that part', () => {
    const cds = state.construct.cassette.parts.find((p) => String(p.slotKey) === 'cds')!
    const r = assembly.index.get(cds.instanceId)!.cassette
    const hit = resolveCassettePosition(state.construct, template, ranges, r.start + 10)
    expect(hit.kind).toBe('instance')
    if (hit.kind === 'instance') expect(hit.instance.instanceId).toBe(cds.instanceId)
  })

  it('the first base of a part belongs to that part, not to the gap before it', () => {
    const cds = state.construct.cassette.parts.find((p) => String(p.slotKey) === 'cds')!
    const r = assembly.index.get(cds.instanceId)!.cassette
    const hit = resolveCassettePosition(state.construct, template, ranges, r.start)
    expect(hit.kind).toBe('instance')
  })

  it('a position past the end resolves to the site after the last part', () => {
    const hit = resolveCassettePosition(
      state.construct,
      template,
      ranges,
      assembly.cassette.length + 5,
    )
    expect(hit.kind).toBe('site')
    if (hit.kind === 'site') {
      expect(hit.site.index).toBe(state.construct.cassette.parts.length)
    }
  })
})

describe('inserting at an explicit index', () => {
  it('puts the part exactly where the map said, not where the template would have', () => {
    const deps = makeDeps()
    let s = filled()
    const cdsIndex = slotKeys(s).indexOf('cds')

    s = designerReducer(
      s,
      {
        type: 'addPart',
        slotKey: 'tag_n' as never,
        part: lookup(toPartId('tag/3xFLAG@1.0.0'))!,
        at: cdsIndex,
      },
      deps,
    )
    expect(slotKeys(s)).toEqual(['itr_5', 'promoter', 'kozak', 'tag_n', 'cds', 'polya', 'itr_3'])
  })

  it('honours an index the template would never have chosen, and lets the rule report it', () => {
    const deps = makeDeps()
    let s = filled()
    // Deliberately wrong: a tag after the polyA.
    const polyaIndex = slotKeys(s).indexOf('polya')
    s = designerReducer(
      s,
      {
        type: 'addPart',
        slotKey: 'tag_n' as never,
        part: lookup(toPartId('tag/HA@1.0.0'))!,
        at: polyaIndex + 1,
      },
      deps,
    )
    expect(slotKeys(s).indexOf('tag_n')).toBeGreaterThan(slotKeys(s).indexOf('polya'))
    const { validation } = analyze(s.construct, backbone, template, lookup)
    expect(validation.findings.map((f) => f.ruleId)).toContain('order.canonical')
  })
})
