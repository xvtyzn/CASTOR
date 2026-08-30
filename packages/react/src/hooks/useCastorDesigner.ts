import { useCallback, useMemo, useReducer, useRef } from 'react'
import {
  analyze,
  buildComparisonModel,
  createConstruct,
  createRandomIdFactory,
  designerReducer,
  emptyCart,
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
  const template = templates[0]!
  const partIndex = useMemo(() => indexBy(parts, (p) => p.id), [parts])
  const lookup = useCallback((id: PartId) => partIndex.get(id), [partIndex])

  const [state, rawDispatch] = useReducer(
    (s: DesignerState, a: DesignerAction) =>
      designerReducer(s, a, {
        template,
        backbones,
        idFactory,
        now: () => new Date().toISOString(),
      }),
    undefined,
    (): DesignerState => ({
      construct:
        initialConstruct ??
        createConstruct(template, backbones[0]!, { name: 'Design 1', idFactory }),
      cart: initialCart ?? emptyCart(),
      selectedInstanceId: null,
    }),
  )

  const dispatch = useCallback((a: DesignerAction) => rawDispatch(a), [])

  const backbone =
    backbones.find((b) => b.id === state.construct.backboneId) ?? backbones[0]!

  const analysis = useMemo(
    () => analyze(state.construct, backbone, template, lookup, { ...(validation ? { validation } : {}) }),
    [state.construct, backbone, template, lookup, validation],
  )

  const cartAssemblies = useMemo(() => {
    const map = new Map<string, AnalysisResult['assembly']>()
    for (const item of state.cart.items) {
      const bb = backbones.find((b) => b.id === item.construct.backboneId) ?? backbones[0]!
      map.set(String(item.itemId), analyze(item.construct, bb, template, lookup).assembly)
    }
    return map
  }, [state.cart.items, backbones, template, lookup])

  const comparison = useMemo(
    () => buildComparisonModel(state.cart, { assemblies: cartAssemblies, parts: lookup }),
    [state.cart, cartAssemblies, lookup],
  )

  const isComplete = useMemo(() => {
    const required = template.nodes.filter(
      (n): n is Extract<typeof n, { kind: 'slot' }> => n.kind === 'slot' && n.min > 0,
    )
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
