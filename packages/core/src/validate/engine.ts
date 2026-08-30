/**
 * The validation contract.
 *
 * One principle governs everything here: VALIDATION NEVER BLOCKS EDITING. A user who drags
 * a tag past the CDS gets a finding, not a rejected interaction. Findings are advisory,
 * anchored to something the UI can point at, and — where the fix is mechanical — carry a
 * pure function that produces the corrected construct.
 */
import type { InstanceId, PartId, SlotKey } from '../model/ids.js'
import type { Construct } from '../model/construct.js'
import type { Backbone } from '../model/backbone.js'
import type { CassetteTemplate } from '../model/template.js'
import type { Citation } from '../model/provenance.js'
import type { AssemblyResult, PartLookup } from '../seq/assemble.js'
import type { SequenceScan } from './scan.js'

export type Severity = 'error' | 'warning' | 'info'

const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 }

/** Where a finding points. The UI turns each of these into a highlight or a scroll target. */
export type Anchor =
  | { kind: 'construct' }
  | { kind: 'instance'; instanceId: InstanceId }
  | { kind: 'slot'; slotKey: SlotKey; repeatIndex?: number }
  | { kind: 'junction'; beforeInstanceId?: InstanceId; afterInstanceId?: InstanceId }
  | {
      kind: 'range'
      space: 'cassette' | 'plasmid'
      start: number
      end: number
      strand?: 1 | -1
    }

export interface QuickFix {
  id: string
  label: string
  /** Pure. The UI dispatches the returned construct; it does not mutate in place. */
  apply(construct: Construct): Construct
}

export interface Finding {
  /** Deterministic, so React keys and "dismissed" state survive re-validation. */
  id: string
  ruleId: string
  severity: Severity
  title: string
  detail?: string
  anchors: Anchor[]
  fixes?: QuickFix[]
  citations?: Citation[]
  data?: Record<string, unknown>
}

export type Intent = 'research' | 'preclinical' | 'clinical'

export interface ValidationOptions {
  /** Gates warnings that only matter downstream of the bench. */
  intent: Intent
  /** Enzymes to check for cargo conflicts with the standard ITR QC digest. */
  enzymes: string[]
  gcWindow: number
  repeatMinLength: number
  homopolymerMin: number
  disabledRules?: string[]
  severityOverrides?: Record<string, Severity>
}

export const DEFAULT_VALIDATION_OPTIONS: ValidationOptions = {
  intent: 'research',
  enzymes: ['SmaI', 'XmaI', 'AhdI'],
  gcWindow: 100,
  repeatMinLength: 20,
  homopolymerMin: 8,
}

export interface RuleContext {
  construct: Construct
  template: CassetteTemplate
  backbone: Backbone
  parts: PartLookup
  assembly: AssemblyResult
  scan: SequenceScan
  options: ValidationOptions
}

export interface Rule {
  id: string
  title: string
  stage: 'structure' | 'sequence' | 'semantic'
  defaultSeverity: Severity
  appliesTo?(ctx: RuleContext): boolean
  run(ctx: RuleContext): Omit<Finding, 'id' | 'ruleId' | 'severity'>[]
}

export interface ValidationReport {
  findings: Finding[]
  byInstance: Map<InstanceId, Finding[]>
  bySlot: Map<SlotKey, Finding[]>
  worst: Severity | null
  counts: Record<Severity, number>
  elapsedMs: number
}

/** Stable, content-derived suffix so a finding keeps its identity across re-validation. */
function anchorHash(anchors: Anchor[]): string {
  return anchors
    .map((a) => {
      switch (a.kind) {
        case 'construct':
          return 'c'
        case 'instance':
          return `i:${a.instanceId}`
        case 'slot':
          return `s:${a.slotKey}:${a.repeatIndex ?? 0}`
        case 'junction':
          return `j:${a.beforeInstanceId ?? ''}:${a.afterInstanceId ?? ''}`
        case 'range':
          return `r:${a.space}:${a.start}:${a.end}`
      }
    })
    .join(',')
}

export function validate(ctx: RuleContext, rules: readonly Rule[]): ValidationReport {
  const started = Date.now()
  const disabled = new Set(ctx.options.disabledRules ?? [])
  const findings: Finding[] = []

  rules.forEach((rule, ruleIndex) => {
    if (disabled.has(rule.id)) return
    if (rule.appliesTo && !rule.appliesTo(ctx)) return
    const severity = ctx.options.severityOverrides?.[rule.id] ?? rule.defaultSeverity
    for (const partial of rule.run(ctx)) {
      findings.push({
        ...partial,
        id: `${rule.id}:${anchorHash(partial.anchors)}`,
        ruleId: rule.id,
        severity,
        // Keep the rule's declaration order available for the deterministic sort below.
        data: { ...partial.data, __ruleIndex: ruleIndex },
      })
    }
  })

  findings.sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    if (bySeverity !== 0) return bySeverity
    const ai = (a.data?.__ruleIndex as number) ?? 0
    const bi = (b.data?.__ruleIndex as number) ?? 0
    if (ai !== bi) return ai - bi
    return a.id.localeCompare(b.id)
  })

  const byInstance = new Map<InstanceId, Finding[]>()
  const bySlot = new Map<SlotKey, Finding[]>()
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 }

  for (const f of findings) {
    counts[f.severity]++
    for (const a of f.anchors) {
      if (a.kind === 'instance') {
        const arr = byInstance.get(a.instanceId)
        if (arr) arr.push(f)
        else byInstance.set(a.instanceId, [f])
      } else if (a.kind === 'slot') {
        const arr = bySlot.get(a.slotKey)
        if (arr) arr.push(f)
        else bySlot.set(a.slotKey, [f])
      }
    }
  }

  const worst: Severity | null =
    counts.error > 0 ? 'error' : counts.warning > 0 ? 'warning' : counts.info > 0 ? 'info' : null

  return { findings, byInstance, bySlot, worst, counts, elapsedMs: Date.now() - started }
}

/**
 * Findings -> seqviz `highlights`. Only range anchors can be highlighted; instance anchors
 * are resolved through the assembly index first.
 */
export function findingsToHighlights(
  report: ValidationReport,
  space: 'cassette' | 'plasmid',
  assembly: AssemblyResult,
  colorOf: (severity: Severity) => string,
): { start: number; end: number; color: string }[] {
  // Deduplicated by range, keeping the most severe colour.
  //
  // Two findings routinely anchor to the same part — "cds appears after polya" and "EGFP sits
  // downstream of the polyA signal" are the same instance seen by two rules — and a viewer
  // that keys its highlights by coordinates then gets duplicate keys. Collapsing here also
  // means the user sees one highlight of the right severity rather than two stacked ones.
  const byRange = new Map<string, { start: number; end: number; severity: Severity }>()
  const rank: Record<Severity, number> = { error: 0, warning: 1, info: 2 }

  const add = (start: number, end: number, severity: Severity) => {
    if (end <= start) return
    const key = `${start}:${end}`
    const existing = byRange.get(key)
    if (!existing || rank[severity] < rank[existing.severity]) {
      byRange.set(key, { start, end, severity })
    }
  }

  for (const f of report.findings) {
    for (const a of f.anchors) {
      if (a.kind === 'range' && a.space === space) {
        add(a.start, a.end, f.severity)
      } else if (a.kind === 'instance') {
        const r = assembly.index.get(a.instanceId)?.[space]
        if (r) add(r.start, r.end, f.severity)
      }
    }
  }

  return [...byRange.values()]
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((h) => ({ start: h.start, end: h.end, color: colorOf(h.severity) }))
}

export type { PartId }
