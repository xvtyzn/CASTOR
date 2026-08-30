import type { Finding, Rule } from '../engine.js'
import { CANONICAL_ORDER, canonicalRank } from '../../model/slot.js'

type Partial_ = Omit<Finding, 'id' | 'ruleId' | 'severity'>

/**
 * The cassette's parts should appear in the canonical 5'->3' order.
 *
 * Reported as a warning, never as a block: unusual arrangements are sometimes deliberate,
 * and a designer that refuses to let you build one is a designer people work around.
 */
export const canonicalOrderRule: Rule = {
  id: 'order.canonical',
  title: 'Canonical cassette order',
  stage: 'structure',
  defaultSeverity: 'warning',
  run(ctx) {
    const out: Partial_[] = []
    const placed = ctx.construct.cassette.parts.filter((p) => p.origin !== 'auto')

    for (let i = 1; i < placed.length; i++) {
      const prev = placed[i - 1]!
      const cur = placed[i]!
      const rPrev = canonicalRank(prev.slotKey)
      const rCur = canonicalRank(cur.slotKey)
      if (!Number.isFinite(rPrev) || !Number.isFinite(rCur)) continue
      // Equal ranks are fine: several tags in one slot, several enhancers.
      if (rCur >= rPrev) continue

      out.push({
        title: `${String(cur.slotKey)} appears after ${String(prev.slotKey)}`,
        detail:
          `The canonical order is ${CANONICAL_ORDER.slice(0, 0).length === 0 ? '' : ''}` +
          `… ${String(prev.slotKey)} should follow ${String(cur.slotKey)}, not precede it. ` +
          'This is a warning, not an error — reorder only if it was unintentional.',
        anchors: [
          { kind: 'junction' as const, beforeInstanceId: prev.instanceId, afterInstanceId: cur.instanceId },
          { kind: 'instance' as const, instanceId: cur.instanceId },
        ],
        data: { prevSlot: String(prev.slotKey), slot: String(cur.slotKey) },
      })
    }
    return out
  },
}

/**
 * WPRE is a 3' UTR element: it only works if it is transcribed, which means it must sit
 * between the stop codon and the polyadenylation signal. Placed after the polyA it does
 * nothing at all, silently.
 */
export const wpreBeforePolyaRule: Rule = {
  id: 'order.wpre-before-polya',
  title: 'WPRE precedes the polyA signal',
  stage: 'structure',
  defaultSeverity: 'error',
  run(ctx) {
    const features = ctx.assembly.cassette.features
    const wpre = features.find((f) => f.role === 'wpre')
    const polya = features.find((f) => f.role === 'polya')
    if (!wpre || !polya) return []
    if (wpre.start < polya.start) return []

    return [
      {
        title: 'WPRE is downstream of the polyA signal',
        detail:
          'WPRE acts on the transcript, so it must be transcribed: it belongs between the stop ' +
          'codon and the polyadenylation signal. Downstream of the polyA it is never ' +
          'transcribed and has no effect — a failure that leaves no trace in the map.',
        anchors: [
          { kind: 'instance' as const, instanceId: wpre.instanceId! },
          { kind: 'instance' as const, instanceId: polya.instanceId! },
        ],
      },
    ]
  },
}

/**
 * The polyadenylation signal must be the last transcribed element before the 3' ITR.
 * Anything transcribed after it is not in the mRNA.
 */
export const polyaLastRule: Rule = {
  id: 'order.polya-last',
  title: 'polyA is the last transcribed element',
  stage: 'structure',
  defaultSeverity: 'warning',
  run(ctx) {
    const features = ctx.assembly.cassette.features
    const polya = features.find((f) => f.role === 'polya')
    if (!polya) return []

    const transcribedRoles = new Set(['cds', 'wpre', 'utr3', 'tag', 'linker', 'joiner', 'intron'])
    const after = features.filter((f) => f.start >= polya.end && transcribedRoles.has(f.role))
    if (after.length === 0) return []

    return after.map((f) => ({
      title: `${f.name} sits downstream of the polyA signal`,
      detail:
        'Transcription terminates at the polyadenylation signal, so this element is not part ' +
        'of the mRNA.',
      anchors: [{ kind: 'instance' as const, instanceId: f.instanceId! }],
    }))
  },
}
