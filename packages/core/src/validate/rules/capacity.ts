import type { Rule } from '../engine.js'
import { CAPACITY_CITATIONS } from '../../seq/capacity.js'

/** The headline rule: does this genome package at all, and does it package cleanly? */
export const capacityRule: Rule = {
  id: 'capacity.band',
  title: 'AAV packaging capacity',
  stage: 'structure',
  defaultSeverity: 'warning',
  run(ctx) {
    const cap = ctx.assembly.capacity
    if (cap.severity === 'ok') return []

    const kb = (n: number) => `${(n / 1000).toFixed(2)} kb`
    return [
      {
        title:
          cap.severity === 'error'
            ? `Cassette is ${kb(cap.itrToItr)} — beyond the AAV packaging limit`
            : `Cassette is ${kb(cap.itrToItr)} (${cap.band})`,
        detail:
          `${cap.message} ITR-to-ITR ${kb(cap.itrToItr)}, cargo ${kb(cap.cargo)}, ` +
          `optimal ${kb(cap.optimalRange[0])}–${kb(cap.optimalRange[1])} for ` +
          `${cap.packaging === 'sc' ? 'self-complementary' : 'single-stranded'} AAV.`,
        anchors: [{ kind: 'construct' as const }],
        citations: CAPACITY_CITATIONS,
        data: { band: cap.band, itrToItr: cap.itrToItr, cargo: cap.cargo, headroom: cap.headroom },
      },
    ]
  },
}
