import type { Rule } from '../engine.js'
import { capacityRule } from './capacity.js'
import { itrPresenceRule, scItrRule } from './itr.js'
import { canonicalOrderRule, polyaLastRule, wpreBeforePolyaRule } from './order.js'
import { kozakRequiredRule, kozakStrengthRule } from './kozak.js'
import { qcDigestConflictRule, typeIISRule } from './enzymes.js'

/**
 * The M1 rule set. Order here is the tie-break order in the report, so the rules that most
 * change what a user does come first.
 */
export const defaultRules: Rule[] = [
  itrPresenceRule,
  scItrRule,
  capacityRule,
  wpreBeforePolyaRule,
  canonicalOrderRule,
  polyaLastRule,
  kozakRequiredRule,
  qcDigestConflictRule,
  kozakStrengthRule,
  typeIISRule,
]

export {
  capacityRule,
  itrPresenceRule,
  scItrRule,
  canonicalOrderRule,
  wpreBeforePolyaRule,
  polyaLastRule,
  kozakRequiredRule,
  kozakStrengthRule,
  qcDigestConflictRule,
  typeIISRule,
}
