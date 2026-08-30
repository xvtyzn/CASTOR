/**
 * The end-to-end test for the whole M1 slice, with no DOM and no React.
 *
 * Backbone -> template -> parts -> assembly -> capacity -> validation -> cart ->
 * comparison model -> layout -> projection. If this passes, the only thing left between here
 * and a working UI is the UI.
 *
 * It runs against the REAL shipped catalogue rather than synthetic fixtures, so a wrong
 * sequence or a broken coordinate in the data fails here too.
 */
import { describe, expect, it } from 'vitest'
import {
  analyze,
  buildComparisonModel,
  cartItemId,
  computeLayout,
  createConstruct,
  createCountingIdFactory,
  DEFAULT_GEOM,
  DEFAULT_LAYOUT_OPTIONS,
  defaultTheme,
  emptyCart,
  instanceId as toInstanceId,
  partId as toPartId,
  project,
  rowId as toRowId,
  type Cart,
  type Construct,
  type Part,
  type PartInstance,
} from '@castor-bio/core'
import { indexParts, loadCatalog } from './index.js'

const catalog = await loadCatalog()
const parts = indexParts(catalog.parts)
const lookup = (id: ReturnType<typeof toPartId>): Part | undefined => parts.get(id)
const template = catalog.templates[0]!
const backbone = catalog.backbones[0]!

function addPart(
  construct: Construct,
  slotKey: string,
  partIdStr: string,
  ids: () => string,
): Construct {
  const instance: PartInstance = {
    instanceId: toInstanceId(ids()),
    partId: toPartId(partIdStr),
    slotKey: slotKey as never,
    repeatIndex: 0,
    strand: 1,
    origin: 'user',
  }
  // Insert respecting the template's slot order, which is what the editor does.
  const order = template.nodes.map((n) => String((n as { key: string }).key))
  const target = order.indexOf(slotKey)
  const next = [...construct.cassette.parts]
  let index = next.length
  for (let i = 0; i < next.length; i++) {
    const rank = order.indexOf(String(next[i]!.slotKey))
    if (rank !== -1 && rank > target) {
      index = i
      break
    }
  }
  next.splice(index, 0, instance)
  return { ...construct, cassette: { parts: next } }
}

function buildDesign(name: string, promoter: string, polya: string, extraTag?: string): Construct {
  const ids = createCountingIdFactory()
  const nextId = () => ids(name)
  let c = createConstruct(template, backbone, {
    name,
    idFactory: ids,
    now: '2026-08-30T00:00:00.000Z',
  })
  c = addPart(c, 'promoter', promoter, nextId)
  if (extraTag) c = addPart(c, 'tag_n', extraTag, nextId)
  c = addPart(c, 'cds', 'cds/EGFP@1.0.0', nextId)
  c = addPart(c, 'wpre', 'wpre/WPRE@1.0.0', nextId)
  c = addPart(c, 'polya', polya, nextId)
  return c
}

describe('the shipped catalogue', () => {
  it('loads parts, one backbone and one template', () => {
    expect(catalog.parts.length).toBe(22)
    expect(catalog.backbones.length).toBe(1)
    expect(catalog.templates.length).toBe(1)
    expect(template.kind).toBe('coding.simple')
  })

  it('carries real ITRs: 145 nt, with the Rep binding element and a SmaI/XmaI site', () => {
    const itr = parts.get(toPartId('itr/AAV2-ITR-145-flip@1.0.0'))!
    expect(itr.length).toBe(145)
    // The RBE is what Rep binds to nick and resolve the terminal repeat; if this motif is
    // absent the "ITR" is not an ITR, whatever the length says.
    expect(itr.sequence).toContain('GAGCGAGCGAGCGCGC')
    // CCCGGG inside the ITR is what makes the standard SmaI/XmaI QC digest diagnostic.
    expect(itr.sequence).toContain('CCCGGG')
  })

  it('carries a real EGFP open reading frame', () => {
    const egfp = parts.get(toPartId('cds/EGFP@1.0.0'))!
    expect(egfp.length).toBe(720)
    expect(egfp.length % 3).toBe(0)
    expect(egfp.sequence.startsWith('ATG')).toBe(true)
    expect(['TAA', 'TAG', 'TGA']).toContain(egfp.sequence.slice(-3))
    // No premature stop in frame.
    for (let i = 0; i < egfp.sequence.length - 3; i += 3) {
      expect(['TAA', 'TAG', 'TGA']).not.toContain(egfp.sequence.slice(i, i + 3))
    }
  })

  it('every part records where it came from', () => {
    for (const p of catalog.parts) {
      expect(p.provenance.origin).toBeTruthy()
      expect(p.license.redistributable).toBe(true)
      const sourced =
        (p.provenance.accessions?.length ?? 0) > 0 || Boolean(p.provenance.note)
      expect(sourced).toBe(true)
    }
  })
})

describe('assembly', () => {
  const design = buildDesign('CAG-EGFP', 'promoter/CAG-935@1.0.0', 'polya/SV40@1.0.0')
  const { assembly, validation } = analyze(design, backbone, template, lookup, {
    idFactory: createCountingIdFactory(),
  })

  it('concatenates parts with no gaps and no overlaps', () => {
    const features = [...assembly.cassette.features].sort((a, b) => a.start - b.start)
    expect(features[0]!.start).toBe(0)
    for (let i = 1; i < features.length; i++) {
      expect(features[i]!.start).toBe(features[i - 1]!.end)
    }
    expect(features[features.length - 1]!.end).toBe(assembly.cassette.length)
  })

  it('every feature slices back to its own part sequence', () => {
    for (const f of assembly.cassette.features) {
      const inst = assembly.instances.find((i) => i.instanceId === f.instanceId)!
      const part = lookup(inst.partId)!
      expect(assembly.cassette.sequence.slice(f.start, f.end)).toBe(part.sequence)
    }
  })

  it('the cassette runs ITR to ITR, inclusive of both', () => {
    const itrs = assembly.cassette.features.filter((f) => f.role === 'itr')
    expect(itrs).toHaveLength(2)
    expect(itrs[0]!.start).toBe(0)
    expect(itrs[1]!.end).toBe(assembly.cassette.length)
  })

  it('the plasmid is the backbone followed by the cassette', () => {
    expect(assembly.plasmid.sequence).toBe(backbone.sequence + assembly.cassette.sequence)
    expect(assembly.plasmid.length).toBe(backbone.length + assembly.cassette.length)
    expect(assembly.plasmid.circular).toBe(true)
  })

  it('indexes each instance in both coordinate spaces, offset by the backbone', () => {
    for (const [instanceId, r] of assembly.index) {
      expect(r.plasmid.start - r.cassette.start).toBe(backbone.length)
      expect(r.plasmid.end - r.cassette.end).toBe(backbone.length)
      expect(assembly.instances.some((i) => i.instanceId === instanceId)).toBe(true)
    }
  })

  it('lands in the optimal packaging band and reports honest headroom', () => {
    const cap = assembly.capacity
    // 145 + 935 + 6 + 720 + 592 + 221 + 145
    expect(cap.itrToItr).toBe(2764)
    expect(cap.cargo).toBe(2764 - 290)
    expect(cap.packaging).toBe('ss')
    expect(cap.band).toBe('low')
    expect(cap.headroom).toBe(5000 - 2764)
    expect(cap.citations.length).toBeGreaterThan(0)
  })

  it('raises no errors on a well-formed design', () => {
    const errors = validation.findings.filter((f) => f.severity === 'error')
    expect(errors.map((e) => e.ruleId)).toEqual([])
  })
})

describe('validation catches real construction mistakes', () => {
  const base = buildDesign('base', 'promoter/CAG-935@1.0.0', 'polya/SV40@1.0.0')

  it('flags WPRE placed downstream of the polyA', () => {
    const parts_ = [...base.cassette.parts]
    const wpreIdx = parts_.findIndex((p) => String(p.slotKey) === 'wpre')
    const polyaIdx = parts_.findIndex((p) => String(p.slotKey) === 'polya')
    ;[parts_[wpreIdx], parts_[polyaIdx]] = [parts_[polyaIdx]!, parts_[wpreIdx]!]
    const broken = { ...base, cassette: { parts: parts_ } }

    const { validation } = analyze(broken, backbone, template, lookup, {
      idFactory: createCountingIdFactory(),
    })
    const ids = validation.findings.map((f) => f.ruleId)
    expect(ids).toContain('order.wpre-before-polya')
    expect(validation.worst).toBe('error')
  })

  it('flags a missing ITR', () => {
    const broken = {
      ...base,
      cassette: { parts: base.cassette.parts.filter((p) => String(p.slotKey) !== 'itr_3') },
    }
    const { validation } = analyze(broken, backbone, template, lookup, {
      idFactory: createCountingIdFactory(),
    })
    expect(validation.findings.map((f) => f.ruleId)).toContain('itr.presence')
  })

  it('flags a cassette that exceeds the packaging limit', () => {
    // Three EF1a promoters is not a design anyone would build; it is the cheapest way to
    // push a real cassette past 5 kb using only real parts.
    let big = base
    const ids = createCountingIdFactory()
    for (let i = 0; i < 3; i++) big = addPart(big, 'promoter', 'promoter/EF1a@1.0.0', () => ids('x'))
    const { assembly, validation } = analyze(big, backbone, template, lookup, {
      idFactory: createCountingIdFactory(),
    })
    expect(assembly.capacity.itrToItr).toBeGreaterThan(5000)
    expect(assembly.capacity.band).toBe('error')
    expect(validation.findings.map((f) => f.ruleId)).toContain('capacity.band')
  })

  it('produces deterministic finding ids that survive re-validation', () => {
    const a = analyze(base, backbone, template, lookup, { idFactory: createCountingIdFactory() })
    const b = analyze(base, backbone, template, lookup, { idFactory: createCountingIdFactory() })
    expect(a.validation.findings.map((f) => f.id)).toEqual(b.validation.findings.map((f) => f.id))
  })
})

describe('cart -> comparison view', () => {
  const designs = [
    buildDesign('CAG-EGFP-SV40', 'promoter/CAG-935@1.0.0', 'polya/SV40@1.0.0'),
    buildDesign('EF1a-EGFP-hGH', 'promoter/EF1a@1.0.0', 'polya/hGH@1.0.0'),
    buildDesign('gfaABC1D-3xFLAG-EGFP', 'promoter/gfaABC1D@1.0.0', 'polya/SV40@1.0.0', 'tag/3xFLAG@1.0.0'),
  ]

  const cart: Cart = {
    ...emptyCart(),
    items: designs.map((construct, i) => ({
      itemId: cartItemId(`item-${i}`),
      construct,
      addedAt: '2026-08-30T00:00:00.000Z',
      visible: true,
    })),
  }

  const assemblies = new Map(
    cart.items.map((item) => [
      item.itemId as string,
      analyze(item.construct, backbone, template, lookup, {
        idFactory: createCountingIdFactory(),
      }).assembly,
    ]),
  )

  const model = buildComparisonModel(cart, { assemblies, parts: lookup })

  it('makes one row per visible cart item, showing the pGOI only', () => {
    expect(model.rows).toHaveLength(3)
    for (const [i, row] of model.rows.entries()) {
      const assembly = assemblies.get(String(cart.items[i]!.itemId))!
      expect(row.segments).toHaveLength(1)
      // The comparison view shows ITR-to-ITR, not the whole plasmid: the shared 2.7 kb
      // backbone would otherwise eat most of the horizontal space.
      expect(row.segments[0]!.length).toBe(assembly.cassette.length)
      expect(row.segments[0]!.length).toBeLessThan(assembly.plasmid.length)
    }
  })

  it('links shared parts between adjacent rows only', () => {
    const order = model.rows.map((r) => r.id)
    const rowOf = new Map<string, string>()
    for (const r of model.rows) for (const it of r.segments[0]!.items) rowOf.set(it.uid, String(r.id))

    expect(model.links.length).toBeGreaterThan(0)
    for (const link of model.links) {
      const ia = order.findIndex((id) => String(id) === rowOf.get(link.a))
      const ib = order.findIndex((id) => String(id) === rowOf.get(link.b))
      expect(Math.abs(ia - ib)).toBe(1)
    }
  })

  it('links the ITRs without crossing them', () => {
    // Every construct has two ITRs, so this is the case that breaks naive all-pairs linking
    // on literally every figure.
    const itrLinks = model.links.filter((l) => String(l.groupId).startsWith('itr/'))
    const byGroup = new Map<string, number>()
    for (const l of itrLinks) byGroup.set(String(l.groupId), (byGroup.get(String(l.groupId)) ?? 0) + 1)
    // Two adjacent row pairs x one link per ITR identity.
    expect(byGroup.get('itr/AAV2-ITR-145-flip@1.0.0')).toBe(2)
    expect(byGroup.get('itr/AAV2-ITR-145-3prime@1.0.0')).toBe(2)
  })

  it('does NOT link the promoters, which is the difference the figure exists to show', () => {
    const promoterLinks = model.links.filter((l) => String(l.groupId).startsWith('promoter/'))
    expect(promoterLinks).toHaveLength(0)
  })

  it('lays out and projects without a DOM', () => {
    const layout = computeLayout(model, {
      ...DEFAULT_LAYOUT_OPTIONS,
      order: model.rows.map((r) => r.id),
      theme: defaultTheme,
    })
    expect(layout.rows).toHaveLength(3)
    expect(layout.items.length).toBe(model.rows.flatMap((r) => r.segments[0]!.items).length)
    expect(layout.ribbons.length).toBe(model.links.length)
    expect(layout.domain[0]).toBe(0)
    expect(layout.domain[1]).toBeGreaterThan(2000)

    const pxPerBp = 800 / (layout.domain[1] - layout.domain[0])
    const xScale = (bp: number) => 180 + bp * pxPerBp
    const px = project(layout, xScale, { width: 800, plotLeft: 180 }, {
      geom: DEFAULT_GEOM,
      rowHeight: DEFAULT_LAYOUT_OPTIONS.rowHeight,
      minLabelWidthPx: 34,
      overscanPx: 200,
    })

    expect(px.arrows.length).toBeGreaterThan(0)
    expect(px.backbones).toHaveLength(3)
    // Labels are culled below the width threshold; shapes are not.
    expect(px.labels.length).toBeLessThan(px.arrows.length)
    for (const a of px.arrows) expect(a.points.split(' ').length).toBeGreaterThanOrEqual(3)
  })

  it('anchoring on a part aligns that part across every row', () => {
    const order = model.rows.map((r) => r.id)
    const anchored = computeLayout(model, {
      ...DEFAULT_LAYOUT_OPTIONS,
      order,
      anchor: { partId: toPartId('cds/EGFP@1.0.0'), justify: 'left' },
      theme: defaultTheme,
    })
    const egfpStarts = anchored.items
      .filter((i) => String(i.partId) === 'cds/EGFP@1.0.0')
      .map((i) => i.x0)
    expect(egfpStarts).toHaveLength(3)
    expect(new Set(egfpStarts).size).toBe(1)
  })
})
