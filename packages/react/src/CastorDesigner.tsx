import { useMemo, useState } from 'react'
import {
  compositeProvider,
  pastedSequenceProvider,
  staticCatalogProvider,
  type CastorTheme,
  type Anchor,
  type Backbone,
  type BackboneId,
  type Cart,
  type CassetteTemplate,
  type Construct,
  type Part,
  type PartProvider,
  type Usage,
  type ValidationOptions,
} from '@castor-bio/core'
import { ThemeProvider, themeToCssVars, useCastorTheme } from './theme/useTheme.js'
import { MessagesProvider, useMessages, type CastorMessages, type LocaleCode } from './i18n.js'
import { useCastorDesigner } from './hooks/useCastorDesigner.js'
import { BackboneSelector } from './designer/BackboneSelector.js'
import { CapacityReadout, CassetteRuler } from './designer/CassetteRuler.js'
import { SlotList, type PartRequest } from './designer/SlotList.js'
import { PartPicker } from './designer/PartPicker.js'
import { ValidationPanel } from './designer/ValidationPanel.js'
import { CartPanel } from './designer/CartPanel.js'
import { PlasmidMapWithActions } from './map/PlasmidMapWithActions.js'
import { ComparisonView, type ComparisonViewOptions } from './compare/ComparisonView.js'

export interface CastorDesignerProps {
  parts: Part[]
  backbones: Backbone[]
  templates: CassetteTemplate[]
  /** Extra sources for the part picker — your in-house registry goes here. */
  providers?: PartProvider[]
  initialConstruct?: Construct
  initialCart?: Cart
  validation?: Partial<ValidationOptions>
  theme?: Partial<CastorTheme>
  /** A locale code, or a partial dictionary merged over English. */
  messages?: Partial<CastorMessages> | LocaleCode
  renderProvenance?: (usages: Usage[], part: Part) => React.ReactNode
  /** Width of the comparison figure in px. */
  comparisonWidth?: number
  className?: string
}

/**
 * Batteries-included shell.
 *
 * Composing the sub-components yourself is a first-class path — this exists so the common case
 * is one element, not so it is the only option. The state lives in a `useReducer` over the
 * pure reducer exported from core, so a host that wants to own the state imports that reducer
 * and drives everything from its own store instead.
 */
export function CastorDesigner(props: CastorDesignerProps) {
  return (
    <ThemeProvider theme={props.theme}>
      <MessagesProvider messages={props.messages}>
        <DesignerBody {...props} />
      </MessagesProvider>
    </ThemeProvider>
  )
}

function DesignerBody({
  parts,
  backbones,
  templates,
  providers,
  initialConstruct,
  initialCart,
  validation,
  renderProvenance,
  comparisonWidth = 1100,
  className,
}: CastorDesignerProps) {
  const theme = useCastorTheme()
  const t = useMessages()
  const designer = useCastorDesigner({
    parts,
    backbones,
    templates,
    ...(initialConstruct ? { initialConstruct } : {}),
    ...(initialCart ? { initialCart } : {}),
    ...(validation ? { validation } : {}),
  })
  const { state, dispatch, template, backbone, lookup, analysis, cartAssemblies, comparison } =
    designer

  const [request, setRequest] = useState<PartRequest | null>(null)
  const [compareOptions, setCompareOptions] = useState<ComparisonViewOptions>({})
  const [mapSpace, setMapSpace] = useState<'plasmid' | 'cassette'>('plasmid')

  const pickerProviders = useMemo<PartProvider[]>(() => {
    const catalogue = staticCatalogProvider(parts)
    return [catalogue, ...(providers ?? []), pastedSequenceProvider()]
  }, [parts, providers])

  const focusAnchor = (anchor: Anchor) => {
    if (anchor.kind === 'instance') dispatch({ type: 'select', instanceId: anchor.instanceId })
    if (anchor.kind === 'junction' && anchor.afterInstanceId) {
      dispatch({ type: 'select', instanceId: anchor.afterInstanceId })
    }
  }

  return (
    <div
      className={['castor-root', className].filter(Boolean).join(' ')}
      style={themeToCssVars(theme)}
    >
      {/* --- the cassette, as a length budget ------------------------------------------ */}
      <section className="castor-panel">
        <div className="castor-panel__head">
          <h2 className="castor-panel__title">{t.cassette.title}</h2>
          <input
            className="castor-input"
            value={state.construct.name}
            onChange={(e) => dispatch({ type: 'rename', name: e.target.value })}
            aria-label={t.cassette.designName}
            style={{ width: 220 }}
          />
        </div>
        <div className="castor-panel__body">
          <CassetteRuler
            assembly={analysis.assembly}
            selectedInstanceId={state.selectedInstanceId}
            onSelect={(id) => dispatch({ type: 'select', instanceId: id })}
          />
          <CapacityReadout assembly={analysis.assembly} />
        </div>
      </section>

      <div className="castor-layout">
        {/* --- left: what goes in it -------------------------------------------------- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--castor-gap)' }}>
          <section className="castor-panel">
            <div className="castor-panel__head">
              <h2 className="castor-panel__title">Composition</h2>
              <span className="castor-hint">
                {state.construct.genomeSerotype}/{state.construct.capsidSerotype} ·{' '}
                {state.construct.packaging === 'sc' ? 'self-complementary' : 'single-stranded'}
              </span>
            </div>
            <div className="castor-panel__body" style={{ paddingTop: 8 }}>
              <BackboneSelector
                backbones={backbones}
                value={backbone.id}
                onChange={(id: BackboneId) => dispatch({ type: 'setBackbone', backboneId: id })}
                templateId={template.id}
              />
              <hr
                style={{
                  border: 'none',
                  borderTop: '1px solid var(--castor-line)',
                  margin: '10px 0',
                }}
              />
              <SlotList
                construct={state.construct}
                template={template}
                assembly={analysis.assembly}
                parts={lookup}
                findings={analysis.validation}
                selectedInstanceId={state.selectedInstanceId}
                onSelect={(id) => dispatch({ type: 'select', instanceId: id })}
                onRequestPart={setRequest}
                onRemove={(id) => dispatch({ type: 'removePart', instanceId: id })}
                onMove={(id, toIndex) => dispatch({ type: 'movePart', instanceId: id, toIndex })}
                onSetStrand={(id, strand) => dispatch({ type: 'setStrand', instanceId: id, strand })}
              />
            </div>
          </section>

          <section className="castor-panel">
            <div className="castor-panel__head">
              <h2 className="castor-panel__title">Findings</h2>
              <span className="castor-hint">
                {analysis.validation.counts.error} errors ·{' '}
                {analysis.validation.counts.warning} warnings
              </span>
            </div>
            <div className="castor-panel__body">
              <ValidationPanel
                report={analysis.validation}
                onFocus={focusAnchor}
                onApplyFix={(fix) => dispatch({ type: 'applyFix', fix })}
              />
            </div>
          </section>

          <section className="castor-panel">
            <div className="castor-panel__head">
              <h2 className="castor-panel__title">Designs</h2>
              <span className="castor-hint">{state.cart.items.length} saved</span>
            </div>
            <div className="castor-panel__body">
              <CartPanel
                cart={state.cart}
                assemblies={cartAssemblies}
                canAdd={designer.isComplete}
                onAdd={() => dispatch({ type: 'cart/add' })}
                onRemove={(itemId) => dispatch({ type: 'cart/remove', itemId })}
                onToggleVisible={(itemId) => dispatch({ type: 'cart/toggleVisible', itemId })}
                onReorder={(itemIds) => dispatch({ type: 'cart/reorder', itemIds })}
                onLoad={(itemId) => dispatch({ type: 'cart/load', itemId })}
              />
            </div>
          </section>
        </div>

        {/* --- right: what it looks like ---------------------------------------------- */}
        <section className="castor-panel">
          <div className="castor-panel__head">
            <h2 className="castor-panel__title">Map</h2>
            <span style={{ display: 'flex', gap: 4 }}>
              {(['plasmid', 'cassette'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="castor-btn castor-btn--ghost"
                  aria-pressed={mapSpace === s}
                  style={mapSpace === s ? { color: 'var(--castor-ink)', fontWeight: 600 } : undefined}
                  onClick={() => setMapSpace(s)}
                >
                  {s === 'plasmid' ? t.map.wholePlasmid : t.map.pgoiOnly}
                </button>
              ))}
            </span>
          </div>
          <div className="castor-panel__body" style={{ padding: 0 }}>
            <PlasmidMapWithActions
              construct={state.construct}
              template={template}
              analysis={analysis}
              parts={lookup}
              space={mapSpace}
              selectedInstanceId={state.selectedInstanceId}
              onSelectInstance={(id) => dispatch({ type: 'select', instanceId: id })}
              onRequestPart={setRequest}
              onRemove={(id) => dispatch({ type: 'removePart', instanceId: id })}
              onSetStrand={(id, strand) => dispatch({ type: 'setStrand', instanceId: id, strand })}
              height={440}
            />
          </div>
        </section>
      </div>

      {/* --- the comparison ------------------------------------------------------------ */}
      <section className="castor-panel">
        <div className="castor-panel__head">
          <h2 className="castor-panel__title">Compare</h2>
          <span className="castor-hint">
            Ribbons join parts that are the same catalogue entry. The gaps are the differences.
          </span>
        </div>
        <ComparisonView
          model={comparison}
          options={compareOptions}
          onOptionsChange={setCompareOptions}
          width={comparisonWidth}
        />
      </section>

      <p className="castor-disclaimer">
        {t.disclaimer}
      </p>

      <PartPicker
        open={request !== null}
        request={request}
        providers={pickerProviders}
        {...(renderProvenance ? { renderProvenance } : {})}
        onClose={() => setRequest(null)}
        onPick={(part) => {
          if (request?.replacingInstanceId) {
            dispatch({ type: 'replacePart', instanceId: request.replacingInstanceId, part })
          } else if (request) {
            dispatch({
              type: 'addPart',
              slotKey: request.slotKey,
              part,
              ...(request.at !== undefined ? { at: request.at } : {}),
            })
          }
          setRequest(null)
        }}
      />
    </div>
  )
}
