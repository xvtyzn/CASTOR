import type { Anchor, Rule } from '../engine.js'

/**
 * Without two correctly oriented ITRs there is no vector genome at all, so this is checked
 * before anything about expression.
 */
export const itrPresenceRule: Rule = {
  id: 'itr.presence',
  title: 'ITR presence and orientation',
  stage: 'structure',
  defaultSeverity: 'error',
  run(ctx) {
    const features = ctx.assembly.cassette.features.filter((f) => f.role === 'itr')
    const out: Omit<import('../engine.js').Finding, 'id' | 'ruleId' | 'severity'>[] = []

    if (features.length !== 2) {
      out.push({
        title:
          features.length === 0
            ? 'No ITRs in the cassette'
            : `Expected exactly 2 ITRs, found ${features.length}`,
        detail:
          'An AAV transfer cassette is defined by a 5′ ITR and a 3′ ITR. Everything between ' +
          'them is packaged; everything outside them is not.',
        anchors: [{ kind: 'construct' as const }],
        data: { count: features.length },
      })
      return out
    }

    const [first, last] = [features[0]!, features[features.length - 1]!]
    const cassetteStart = 0
    const cassetteEnd = ctx.assembly.cassette.length

    if (first.start !== cassetteStart) {
      out.push({
        title: 'The 5′ ITR is not the first element of the cassette',
        detail:
          `Sequence upstream of the 5′ ITR (${first.start} bp) is not packaged and does not ` +
          'belong inside the cassette.',
        anchors: [
          { kind: 'range' as const, space: 'cassette' as const, start: 0, end: first.start },
        ],
      })
    }
    if (last.end !== cassetteEnd) {
      out.push({
        title: 'The 3′ ITR is not the last element of the cassette',
        detail: `${cassetteEnd - last.end} bp sit downstream of the 3′ ITR and are not packaged.`,
        anchors: [
          {
            kind: 'range' as const,
            space: 'cassette' as const,
            start: last.end,
            end: cassetteEnd,
          },
        ],
      })
    }

    // The two ITRs must be an INVERTED repeat, not a direct one.
    //
    // Note the modelling decision this rule has to account for: catalogue ITR parts are
    // stored already oriented for the transfer plasmid, so the 3' ITR part holds the reverse
    // complement of the genome's 3' end and both instances sit on strand +1. Strand is
    // therefore NOT the signal here. The detectable error is placing the same oriented part
    // at both ends, which builds a direct repeat that cannot form the resolvable hairpins.
    const firstInstance = ctx.assembly.instances.find((i) => i.instanceId === first.instanceId)
    const lastInstance = ctx.assembly.instances.find((i) => i.instanceId === last.instanceId)
    if (
      firstInstance &&
      lastInstance &&
      firstInstance.partId === lastInstance.partId &&
      firstInstance.strand === lastInstance.strand
    ) {
      const anchors: Anchor[] = [
        { kind: 'instance', instanceId: first.instanceId! },
        { kind: 'instance', instanceId: last.instanceId! },
      ]
      out.push({
        title: 'Both ends carry the same ITR in the same orientation',
        detail:
          'This builds a direct repeat, not an inverted one. The 3′ ITR must be the reverse ' +
          "complement of the 5′ ITR — use the 3′ ITR part, or flip this instance's strand. " +
          'A direct repeat cannot form the hairpins Rep resolves, so nothing is packaged.',
        anchors,
      })
    }

    return out
  },
}

/**
 * scAAV needs exactly one terminal-resolution-site-deleted ITR: replication reads through
 * the mutant end, producing the self-complementary duplex. Zero gives an ordinary ssAAV;
 * two gives nothing.
 */
export const scItrRule: Rule = {
  id: 'itr.deltaTRS',
  title: 'Self-complementary ITR configuration',
  stage: 'structure',
  defaultSeverity: 'error',
  appliesTo: (ctx) => ctx.construct.packaging === 'sc',
  run(ctx) {
    const itrs = ctx.assembly.instances
      .map((i) => ({ instance: i, part: ctx.parts(i.partId) }))
      .filter((x) => x.part?.role === 'itr')
    const mutant = itrs.filter(
      (x) => x.part?.attributes.role === 'itr' && x.part.attributes.deltaTRS,
    )
    if (mutant.length === 1) return []
    return [
      {
        title:
          mutant.length === 0
            ? 'Self-complementary packaging selected, but neither ITR is a ΔTRS mutant'
            : `${mutant.length} ΔTRS ITRs — a self-complementary genome needs exactly one`,
        detail:
          'scAAV works because Rep cannot nick one ITR (its terminal resolution site is ' +
          'deleted), so replication runs through and yields a double-stranded inverted repeat.',
        anchors:
          mutant.length === 0
            ? [{ kind: 'construct' as const }]
            : mutant.map((m) => ({
                kind: 'instance' as const,
                instanceId: m.instance.instanceId,
              })),
        data: { deltaTrsCount: mutant.length },
      },
    ]
  },
}
