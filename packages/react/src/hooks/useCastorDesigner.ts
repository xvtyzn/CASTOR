import { useCallback, useMemo, useReducer, useRef } from 'react'
import {
  analyze,
  buildComparisonModel,
  createConstruct,
  createRandomIdFactory,
  designerReducer,
  emptyCart,
  flattenSlots,
  indexBy,
  type AnalysisResult,
  type Backbone,
  type Cart,
  type CassetteTemplate,
  type ComparisonModel,
  type Construct,
  type DesignerAction,
  type DesignerState,
  type Part,
  type PartId,
  type TemplateId,
  type ValidationOptions,
} from '@castor-bio/core'

export interface UseCastorDesignerArgs {
  parts: Part[]
  backbones: Backbone[]
  templates: CassetteTemplate[]
  initialConstruct?: Construct
  initialCart?: Cart
  validation?: Partial<ValidationOptions>
}

export interface CastorDesignerApi {
  state: DesignerState
  dispatch: (action: DesignerAction) => void
  template: CassetteTemplate
  backbone: Backbone
  /** Every backbone the designer was given, for the selector. */
  backbonesAvailable: Backbone[]
  lookup: (id: PartId) => Part | undefined
  analysis: AnalysisResult
  /** One assembly per cart item, keyed by itemId. */
  cartAssemblies: Map<string, AnalysisResult['assembly']>
  comparison: ComparisonModel
  /** True when every `min: 1` slot is filled — the gate on adding to the cart. */
  isComplete: boolean
}

function templateFor(templates: readonly CassetteTemplate[], id: TemplateId): CassetteTemplate {
  const template = templates.find((candidate) => candidate.id === id)
  if (!template) throw new Error(`CASTOR: template '${String(id)}' was not provided`)
  return template
}

function backboneFor(backbones: readonly Backbone[], id: Construct['backboneId']): Backbone {
  const backbone = backbones.find((candidate) => candidate.id === id)
  if (!backbone) throw new Error(`CASTOR: backbone '${String(id)}' was not provided`)
  return backbone
}

/**
 * The headless designer.
 *
 * Everything derived — assembly, validation, the comparison model — is memoised here and
 * never stored. Keeping an assembled sequence beside the construct that produced it is how
 * tools in this space quietly desynchronise from themselves.
 */
export function useCastorDesigner({
  parts,
  backbones,
  templates,
  initialConstruct,
  initialCart,
  validation,
}: UseCastorDesignerArgs): CastorDesignerApi {
  const idFactory = useRef(createRandomIdFactory()).current
  const defaultTemplate = initialConstruct
    ? templateFor(templates, initialConstruct.templateId)
    : templates[0]
  if (!defaultTemplate) throw new Error('CASTOR: at least one template is required')
  const defaultBackbone = initialConstruct
    ? backboneFor(backbones, initialConstruct.backboneId)
    : backbones[0]
  if (!defaultBackbone) throw new Error('CASTOR: at least one backbone is required')
  const partIndex = useMemo(() => indexBy(parts, (p) => p.id), [parts])
  const lookup = useCallback((id: PartId) => partIndex.get(id), [partIndex])

  const [state, rawDispatch] = useReducer(
    (s: DesignerState, a: DesignerAction) => {
      const currentTemplate = templateFor(templates, s.construct.templateId)
      return designerReducer(s, a, {
        template: currentTemplate,
        backbones,
        idFactory,
        now: () => new Date().toISOString(),
      })
    },
    undefined,
    (): DesignerState => ({
      construct:
        initialConstruct ??
        createConstruct(defaultTemplate, defaultBackbone, { name: 'Design 1', idFactory }),
      cart: initialCart ?? emptyCart(),
      selectedInstanceId: null,
    }),
  )

  const dispatch = useCallback((a: DesignerAction) => rawDispatch(a), [])

  const template = templateFor(templates, state.construct.templateId)
  const backbone = backboneFor(backbones, state.construct.backboneId)

  const analysis = useMemo(
    () =>
      analyze(state.construct, backbone, template, lookup, {
        ...(validation ? { validation } : {}),
      }),
    [state.construct, backbone, template, lookup, validation],
  )

  const cartAssemblies = useMemo(() => {
    const map = new Map<string, AnalysisResult['assembly']>()
    for (const item of state.cart.items) {
      const itemBackbone = backboneFor(backbones, item.construct.backboneId)
      const itemTemplate = templateFor(templates, item.construct.templateId)
      map.set(
        String(item.itemId),
        analyze(item.construct, itemBackbone, itemTemplate, lookup).assembly,
      )
    }
    return map
  }, [state.cart.items, backbones, templates, lookup])

  const comparison = useMemo(
    () => buildComparisonModel(state.cart, { assemblies: cartAssemblies, parts: lookup }),
    [state.cart, cartAssemblies, lookup],
  )

  const isComplete = useMemo(() => {
    const required = flattenSlots(template.nodes).filter((slot) => slot.min > 0)
    return required.every((slot) =>
      state.construct.cassette.parts.some((p) => String(p.slotKey) === String(slot.key)),
    )
  }, [template, state.construct])

  return {
    state,
    dispatch,
    template,
    backbone,
    backbonesAvailable: backbones,
    lookup,
    analysis,
    cartAssemblies,
    comparison,
    isComplete,
  }
}
