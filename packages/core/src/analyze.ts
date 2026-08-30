/**
 * assemble -> scan -> validate, in one call.
 *
 * Derived state is never stored anywhere; callers memoise this on a cheap structural hash of
 * the construct. Storing an assembled sequence beside the construct that produced it is how
 * tools in this space drift out of sync with themselves.
 */
import type { Backbone } from './model/backbone.js'
import type { Construct } from './model/construct.js'
import type { CassetteTemplate } from './model/template.js'
import {
  assemble,
  type AssembleOptions,
  type AssemblyResult,
  type PartLookup,
} from './seq/assemble.js'
import { scanSequence, type SequenceScan } from './validate/scan.js'
import {
  DEFAULT_VALIDATION_OPTIONS,
  validate,
  type Rule,
  type ValidationOptions,
  type ValidationReport,
} from './validate/engine.js'
import { defaultRules } from './validate/rules/index.js'

export interface AnalysisResult {
  assembly: AssemblyResult
  scan: SequenceScan
  validation: ValidationReport
}

export interface AnalyzeOptions extends AssembleOptions {
  validation?: Partial<ValidationOptions>
  rules?: readonly Rule[]
}

export function analyze(
  construct: Construct,
  backbone: Backbone,
  template: CassetteTemplate,
  parts: PartLookup,
  options: AnalyzeOptions = {},
): AnalysisResult {
  const assembly = assemble(construct, backbone, template, parts, options)
  const validationOptions: ValidationOptions = {
    ...DEFAULT_VALIDATION_OPTIONS,
    ...options.validation,
  }
  const scan = scanSequence(assembly.cassette.sequence, {
    gcWindow: validationOptions.gcWindow,
    homopolymerMin: validationOptions.homopolymerMin,
  })
  const validation = validate(
    { construct, template, backbone, parts, assembly, scan, options: validationOptions },
    options.rules ?? defaultRules,
  )
  return { assembly, scan, validation }
}

/** Cheap structural hash for memoisation. Not a checksum — collisions only cost a recompute. */
export function constructHash(construct: Construct): string {
  const parts = construct.cassette.parts
    .map((p) => `${p.instanceId}:${p.partId}:${p.strand}:${p.override?.sequence?.length ?? 0}`)
    .join('|')
  return `${construct.id}:${construct.backboneId}:${construct.templateId}:${construct.packaging}:${parts}`
}
