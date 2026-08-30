import type { Finding, Rule } from '../engine.js'
import { hitsIn } from '../scan.js'

type Partial_ = Omit<Finding, 'id' | 'ruleId' | 'severity'>

/**
 * The standard AAV plasmid QC is a SmaI (or XmaI) digest: both enzymes cut CCCGGG, which
 * occurs inside each ITR, so an intact prep gives a characteristic fragment pattern and a
 * recombined ITR gives a wrong one.
 *
 * That diagnostic only works if the CARGO carries no CCCGGG of its own. A cargo site adds
 * fragments and quietly destroys the one routine check standing between the user and a
 * silently deleted ITR — which is why this is worth flagging even though the sequence is
 * otherwise perfectly fine.
 */
export const qcDigestConflictRule: Rule = {
  id: 'enzymes.qc-digest-conflict',
  title: 'ITR QC digest conflict',
  stage: 'sequence',
  defaultSeverity: 'warning',
  run(ctx) {
    const out: Partial_[] = []
    const features = ctx.assembly.cassette.features
    const itrs = features.filter((f) => f.role === 'itr')
    if (itrs.length === 0) return out

    const inItr = (pos: number) => itrs.some((f) => pos >= f.start && pos < f.end)

    const cargoHits = (ctx.scan.motifs.get('smaI_xmaI') ?? []).filter(
      (h) => h.strand === 1 && !inItr(h.start),
    )
    if (cargoHits.length === 0) return out

    out.push({
      title: `${cargoHits.length} SmaI/XmaI site${cargoHits.length === 1 ? '' : 's'} in the cargo`,
      detail:
        'SmaI/XmaI (CCCGGG) cut inside each ITR, which is what makes the standard diagnostic ' +
        'digest able to report ITR integrity. Additional sites in the cargo change the ' +
        'fragment pattern and make that read-out ambiguous. Consider AhdI (GACNNNNNGTC) as ' +
        'the QC enzyme instead, or removing the site if the cargo is synthesised.',
      anchors: cargoHits.map((h) => ({
        kind: 'range' as const,
        space: 'cassette' as const,
        start: h.start,
        end: h.end,
      })),
      data: { positions: cargoHits.map((h) => h.start) },
    })

    return out
  },
}

/** Type IIS sites matter for Golden Gate assembly of the cassette. */
export const typeIISRule: Rule = {
  id: 'enzymes.type-iis',
  title: 'Type IIS sites in the cassette',
  stage: 'sequence',
  defaultSeverity: 'info',
  run(ctx) {
    const out: Partial_[] = []
    for (const [name, label] of [
      ['bsaI', 'BsaI'],
      ['bsmbI', 'BsmBI'],
      ['sapI', 'SapI'],
    ] as const) {
      const hits = hitsIn(ctx.scan, name, 0, ctx.scan.length)
      if (hits.length === 0) continue
      out.push({
        title: `${hits.length} ${label} site${hits.length === 1 ? '' : 's'} in the cassette`,
        detail: `Relevant only if this cassette is assembled by Golden Gate with ${label}.`,
        anchors: hits.map((h) => ({
          kind: 'range' as const,
          space: 'cassette' as const,
          start: h.start,
          end: h.end,
        })),
      })
    }
    return out
  },
}
