import type { Finding, Rule } from '../engine.js'

type Partial_ = Omit<Finding, 'id' | 'ruleId' | 'severity'>

/**
 * A Kozak sequence is required exactly when a Pol II promoter drives a CDS, and is
 * meaningless when the promoter is Pol III (U6/H1/7SK make small RNAs, which are not
 * translated). Both directions are worth reporting: a missing Kozak costs expression, and a
 * present one on a Pol III cassette signals that the user has the wrong mental model.
 */
export const kozakRequiredRule: Rule = {
  id: 'kozak.required',
  title: 'Kozak sequence',
  stage: 'structure',
  defaultSeverity: 'warning',
  run(ctx) {
    const out: Partial_[] = []
    const instances = ctx.assembly.instances.map((i) => ({ i, p: ctx.parts(i.partId) }))

    const promoters = instances.filter((x) => x.p?.role === 'promoter')
    const hasPolII = promoters.some(
      (x) => x.p?.attributes.role === 'promoter' && x.p.attributes.polymerase === 'II',
    )
    const hasPolIII = promoters.some(
      (x) => x.p?.attributes.role === 'promoter' && x.p.attributes.polymerase === 'III',
    )
    const cds = instances.filter((x) => x.p?.role === 'cds')
    const kozak = instances.filter((x) => x.p?.role === 'kozak')

    if (hasPolII && cds.length > 0 && kozak.length === 0) {
      out.push({
        title: 'No Kozak sequence before the coding sequence',
        detail:
          'A Pol II promoter driving a CDS needs a Kozak consensus (gccRccATGG) for efficient ' +
          'translation initiation. Without one the ribosome leaky-scans past the start codon ' +
          'and expression drops.',
        anchors: [{ kind: 'instance' as const, instanceId: cds[0]!.i.instanceId }],
      })
    }

    if (hasPolIII && !hasPolII && kozak.length > 0) {
      for (const k of kozak) {
        out.push({
          title: 'Kozak sequence in a Pol III cassette',
          detail:
            'Pol III promoters (U6, H1, 7SK) transcribe small RNAs that are never translated, ' +
            'so a Kozak sequence has no function here.',
          anchors: [{ kind: 'instance' as const, instanceId: k.i.instanceId }],
        })
      }
    }

    return out
  },
}

/**
 * Kozak strength, scored on the two positions that actually matter: a purine at -3 and a G
 * at +4, relative to the A of the ATG.
 */
export const kozakStrengthRule: Rule = {
  id: 'kozak.strength',
  title: 'Kozak strength',
  stage: 'sequence',
  defaultSeverity: 'info',
  run(ctx) {
    const out: Partial_[] = []
    const features = ctx.assembly.cassette.features
    const seq = ctx.assembly.cassette.sequence

    for (const cds of features.filter((f) => f.role === 'cds' && f.strand === 1)) {
      const atg = cds.start
      if (seq.slice(atg, atg + 3) !== 'ATG') continue
      if (atg < 3 || atg + 4 > seq.length) continue

      const minus3 = seq[atg - 3]!
      const plus4 = seq[atg + 3]!
      const purineAtMinus3 = minus3 === 'A' || minus3 === 'G'
      const gAtPlus4 = plus4 === 'G'
      const score = (purineAtMinus3 ? 1 : 0) + (gAtPlus4 ? 1 : 0)
      if (score === 2) continue

      out.push({
        title:
          score === 1
            ? `Adequate Kozak context for ${cds.name}`
            : `Weak Kozak context for ${cds.name}`,
        detail:
          `Position −3 is ${minus3} (${purineAtMinus3 ? 'purine, good' : 'pyrimidine, weak'}), ` +
          `position +4 is ${plus4} (${gAtPlus4 ? 'G, good' : 'not G, weak'}). ` +
          'The strong consensus is gccRccATGG; leaky scanning increases as context weakens.',
        anchors: [
          {
            kind: 'range' as const,
            space: 'cassette' as const,
            start: atg - 6,
            end: atg + 4,
          },
        ],
        data: { minus3, plus4, score },
      })
    }
    return out
  },
}
