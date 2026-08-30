/**
 * Interaction contracts, not markup snapshots.
 *
 * These assert what the components promise to DO — a picked part reaches the construct, a
 * finding points at something, the cart takes a snapshot — because those are the things that
 * break. Snapshotting the DOM would fail on every styling change and pass on every real bug.
 */
import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import {
  analyze,
  createConstruct,
  createCountingIdFactory,
  designerReducer,
  emptyCart,
  indexBy,
  partId as toPartId,
  type Backbone,
  type CassetteTemplate,
  type DesignerState,
  type Part,
} from '@castor-bio/core'
import { loadCatalog } from '@castor-bio/catalog'
import { CastorDesigner } from './index.js'

const catalog = await loadCatalog()
const template = catalog.templates[0] as CassetteTemplate
const backbone = catalog.backbones[0] as Backbone
const lookup = (() => {
  const idx = indexBy(catalog.parts, (p: Part) => p.id)
  return (id: ReturnType<typeof toPartId>) => idx.get(id)
})()

function makeDeps() {
  const ids = createCountingIdFactory()
  return {
    template,
    backbones: catalog.backbones,
    idFactory: ids,
    now: () => '2026-08-30T00:00:00.000Z',
  }
}

function initialState(): DesignerState {
  return {
    construct: createConstruct(template, backbone, {
      idFactory: createCountingIdFactory(),
      now: '2026-08-30T00:00:00.000Z',
    }),
    cart: emptyCart(),
    selectedInstanceId: null,
  }
}

describe('designerReducer', () => {
  it('inserts a picked part at the position the template implies', () => {
    const deps = makeDeps()
    let s = initialState()
    // Add out of order on purpose: polyA first, then promoter.
    s = designerReducer(
      s,
      {
        type: 'addPart',
        slotKey: 'polya' as never,
        part: lookup(toPartId('polya/SV40@1.0.0'))!,
      },
      deps,
    )
    s = designerReducer(
      s,
      {
        type: 'addPart',
        slotKey: 'promoter' as never,
        part: lookup(toPartId('promoter/CAG-935@1.0.0'))!,
      },
      deps,
    )

    const slots = s.construct.cassette.parts.map((p) => String(p.slotKey))
    expect(slots.indexOf('promoter')).toBeLessThan(slots.indexOf('polya'))
    expect(slots[0]).toBe('itr_5')
    expect(slots[slots.length - 1]).toBe('itr_3')
  })

  it('takes a snapshot into the cart, so later edits do not rewrite the figure', () => {
    const deps = makeDeps()
    let s = initialState()
    s = designerReducer(
      s,
      {
        type: 'addPart',
        slotKey: 'promoter' as never,
        part: lookup(toPartId('promoter/CAG-935@1.0.0'))!,
      },
      deps,
    )
    s = designerReducer(s, { type: 'cart/add' }, deps)
    const snapshotLength = s.cart.items[0]!.construct.cassette.parts.length

    s = designerReducer(
      s,
      {
        type: 'addPart',
        slotKey: 'cds' as never,
        part: lookup(toPartId('cds/EGFP@1.0.0'))!,
      },
      deps,
    )

    expect(s.construct.cassette.parts.length).toBe(snapshotLength + 1)
    expect(s.cart.items[0]!.construct.cassette.parts.length).toBe(snapshotLength)
  })

  it('moves a part to an arbitrary position, and order survives as the construct', () => {
    const deps = makeDeps()
    let s = initialState()
    for (const [slot, part] of [
      ['promoter', 'promoter/CAG-935@1.0.0'],
      ['cds', 'cds/EGFP@1.0.0'],
      ['wpre', 'wpre/WPRE@1.0.0'],
      ['polya', 'polya/SV40@1.0.0'],
    ] as const) {
      s = designerReducer(
        s,
        { type: 'addPart', slotKey: slot as never, part: lookup(toPartId(part))! },
        deps,
      )
    }
    const slotsOf = (st: DesignerState) => st.construct.cassette.parts.map((p) => String(p.slotKey))
    expect(slotsOf(s)).toEqual(['itr_5', 'promoter', 'kozak', 'cds', 'wpre', 'polya', 'itr_3'])

    // Move the CDS to the end of the transcribed region, past the polyA. dnd-kit reports the
    // destination as the target's index in the ORIGINAL array, which is what the reducer takes.
    const cds = s.construct.cassette.parts.find((p) => String(p.slotKey) === 'cds')!
    s = designerReducer(s, { type: 'movePart', instanceId: cds.instanceId, toIndex: 5 }, deps)
    expect(slotsOf(s)).toEqual(['itr_5', 'promoter', 'kozak', 'wpre', 'polya', 'cds', 'itr_3'])

    // And back again, moving upward this time.
    s = designerReducer(s, { type: 'movePart', instanceId: cds.instanceId, toIndex: 3 }, deps)
    expect(slotsOf(s)).toEqual(['itr_5', 'promoter', 'kozak', 'cds', 'wpre', 'polya', 'itr_3'])
  })

  it('an out-of-canonical-order cassette is reported, never rejected', () => {
    const deps = makeDeps()
    let s = initialState()
    for (const [slot, part] of [
      ['promoter', 'promoter/CAG-935@1.0.0'],
      ['cds', 'cds/EGFP@1.0.0'],
      ['polya', 'polya/SV40@1.0.0'],
    ] as const) {
      s = designerReducer(
        s,
        { type: 'addPart', slotKey: slot as never, part: lookup(toPartId(part))! },
        deps,
      )
    }
    const cds = s.construct.cassette.parts.find((p) => String(p.slotKey) === 'cds')!
    s = designerReducer(s, { type: 'movePart', instanceId: cds.instanceId, toIndex: 4 }, deps)

    // The move went through — validation does not veto edits.
    expect(s.construct.cassette.parts.map((p) => String(p.slotKey))).toEqual([
      'itr_5',
      'promoter',
      'kozak',
      'polya',
      'cds',
      'itr_3',
    ])
    const { validation } = analyze(s.construct, backbone, template, lookup)
    const ids = validation.findings.map((f) => f.ruleId)
    expect(ids).toContain('order.canonical')
    expect(ids).toContain('order.polya-last')
  })

  it('reorders the cart, which is what decides who is compared against whom', () => {
    const deps = makeDeps()
    let s = initialState()
    s = designerReducer(
      s,
      {
        type: 'addPart',
        slotKey: 'promoter' as never,
        part: lookup(toPartId('promoter/CAG-935@1.0.0'))!,
      },
      deps,
    )
    s = designerReducer(s, { type: 'cart/add' }, deps)
    s = designerReducer(
      s,
      {
        type: 'replacePart',
        instanceId: s.construct.cassette.parts.find((p) => String(p.slotKey) === 'promoter')!
          .instanceId,
        part: lookup(toPartId('promoter/EF1a@1.0.0'))!,
      },
      deps,
    )
    s = designerReducer(s, { type: 'cart/add' }, deps)

    const ids = s.cart.items.map((i) => i.itemId)
    expect(s.cart.items.map((i) => i.label)).toEqual(['Untitled design', 'Untitled design (2)'])

    s = designerReducer(s, { type: 'cart/reorder', itemIds: [ids[1]!, ids[0]!] }, deps)
    expect(s.cart.items.map((i) => String(i.itemId))).toEqual([String(ids[1]), String(ids[0])])
  })

  it('preserves omitted cart items when a stale client sends a partial reorder', () => {
    const deps = makeDeps()
    let s = initialState()
    s = designerReducer(s, { type: 'cart/add' }, deps)
    s = designerReducer(s, { type: 'cart/add' }, deps)
    s = designerReducer(s, { type: 'cart/add' }, deps)
    const ids = s.cart.items.map((item) => item.itemId)

    s = designerReducer(s, { type: 'cart/reorder', itemIds: [ids[1]!, ids[1]!] }, deps)
    expect(s.cart.items.map((item) => item.itemId)).toEqual([ids[1], ids[0], ids[2]])
  })

  it('protects template-locked boundary parts at the reducer boundary', () => {
    const deps = makeDeps()
    const s = initialState()
    const itr = s.construct.cassette.parts[0]!
    const replacement = lookup(toPartId('itr/AAV2-ITR-145-3prime@1.0.0'))!

    for (const action of [
      { type: 'removePart', instanceId: itr.instanceId },
      { type: 'movePart', instanceId: itr.instanceId, toIndex: 2 },
      { type: 'setStrand', instanceId: itr.instanceId, strand: -1 },
      { type: 'replacePart', instanceId: itr.instanceId, part: replacement },
    ] as const) {
      expect(designerReducer(s, action, deps)).toBe(s)
    }
  })

  it('removing a part clears the selection when it was the selected one', () => {
    const deps = makeDeps()
    let s = initialState()
    s = designerReducer(
      s,
      {
        type: 'addPart',
        slotKey: 'cds' as never,
        part: lookup(toPartId('cds/EGFP@1.0.0'))!,
      },
      deps,
    )
    const id = s.selectedInstanceId!
    expect(id).toBeTruthy()
    s = designerReducer(s, { type: 'removePart', instanceId: id }, deps)
    expect(s.selectedInstanceId).toBeNull()
  })
})

describe('findings anchor to something the UI can point at', () => {
  it('every finding resolves to a range or an instance that exists', () => {
    const deps = makeDeps()
    let s = initialState()
    for (const [slot, part] of [
      ['promoter', 'promoter/CAG-935@1.0.0'],
      ['cds', 'cds/EGFP@1.0.0'],
      ['wpre', 'wpre/WPRE@1.0.0'],
      ['polya', 'polya/SV40@1.0.0'],
    ] as const) {
      s = designerReducer(
        s,
        { type: 'addPart', slotKey: slot as never, part: lookup(toPartId(part))! },
        deps,
      )
    }
    // Break it so there is something to anchor.
    const parts = [...s.construct.cassette.parts]
    const w = parts.findIndex((p) => String(p.slotKey) === 'wpre')
    const a = parts.findIndex((p) => String(p.slotKey) === 'polya')
    ;[parts[w], parts[a]] = [parts[a]!, parts[w]!]
    const broken = { ...s.construct, cassette: { parts } }

    const { assembly, validation } = analyze(broken, backbone, template, lookup)
    expect(validation.findings.length).toBeGreaterThan(0)
    for (const f of validation.findings) {
      expect(f.anchors.length).toBeGreaterThan(0)
      for (const anchor of f.anchors) {
        if (anchor.kind === 'instance') {
          expect(assembly.index.has(anchor.instanceId)).toBe(true)
        } else if (anchor.kind === 'range') {
          expect(anchor.start).toBeGreaterThanOrEqual(0)
          expect(anchor.end).toBeGreaterThan(anchor.start)
        }
      }
    }
  })
})

describe('<CastorDesigner>', () => {
  it('mounts and renders the cassette, the slot list and the disclaimer', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(
        <CastorDesigner
          parts={catalog.parts}
          backbones={catalog.backbones}
          templates={catalog.templates}
        />,
      )
    })

    const text = host.textContent ?? ''
    expect(text).toContain('Cassette')
    expect(text).toContain('Composition')
    expect(text).toContain('Findings')
    expect(text).toContain('Compare')
    // The capacity readout must be present from the first frame; it is the reason the tool
    // exists rather than a generic plasmid editor.
    expect(text).toContain('ITR-to-ITR')
    expect(text).toContain('Not for clinical use')

    // Slots that can still take a part are offered as chips, with the required ones marked.
    const chips = [...host.querySelectorAll('.castor-chip')].map((c) => c.textContent ?? '')
    expect(chips).toContain('Transgene (CDS) *')
    expect(chips).toContain('polyA signal *')
    expect(chips).toContain('Enhancer')
    expect(text).toContain('required before this design can be saved')

    // The ruler drew the two seeded ITRs to scale.
    expect(host.querySelectorAll('.castor-ruler__seg').length).toBeGreaterThanOrEqual(2)

    // Parts are rendered in cassette order and every unlocked one carries a drag handle, so
    // reordering is available to pointer and keyboard alike.
    const grips = host.querySelectorAll('.castor-slot__grip')
    expect(grips.length).toBeGreaterThan(0)
    for (const g of grips) {
      expect(g.getAttribute('aria-label')).toMatch(/Reorder .*arrow keys/)
    }
    // The two ITRs are locked, so they have no handle: the packaging boundary is not
    // something a drag should be able to move.
    expect(host.querySelectorAll('.castor-slot--locked').length).toBe(2)

    await act(async () => root.unmount())
    host.remove()
  })
})
