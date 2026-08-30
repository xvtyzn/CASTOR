import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import TextField from '@mui/material/TextField'
import { useState } from 'react'
import {
  BackboneSelector,
  CapacityReadout,
  CartPanel,
  CassetteRuler,
  PlasmidMapWithActions,
  SlotList,
  ValidationPanel,
  useMessages,
  type PartRequest,
} from '@castor-bio/react'
import type { Anchor, BackboneId } from '@castor-bio/core'
import type { CastorDesignerApi } from '@castor-bio/react'
import { Explain } from '../shell/Explain.js'
import { Section } from '../shell/Section.js'
import type { WorkbenchMessages } from '../messages.js'

export interface DesignTabProps {
  t: WorkbenchMessages
  designer: CastorDesignerApi
  onRequestPart: (request: PartRequest) => void
}

export function DesignTab({ t, designer, onRequestPart }: DesignTabProps) {
  const { state, dispatch, template, backbone, lookup, analysis, cartAssemblies } = designer
  const [mapSpace, setMapSpace] = useState<'plasmid' | 'cassette'>('plasmid')
  const m = useMessages()
  const mapLabels = { whole: m.map.wholePlasmid, pgoi: m.map.pgoiOnly }

  const focusAnchor = (anchor: Anchor) => {
    if (anchor.kind === 'instance') dispatch({ type: 'select', instanceId: anchor.instanceId })
    if (anchor.kind === 'junction' && anchor.afterInstanceId) {
      dispatch({ type: 'select', instanceId: anchor.afterInstanceId })
    }
  }

  return (
    <Box>
      <Explain title={t.design.explainTitle} summary={t.design.explainSummary}>
        {t.design.explainBody.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </Explain>

      <Stack spacing={1.5}>
        <Section
          title={m.cassette.title}
          aside={
            <TextField
              size="small"
              variant="outlined"
              value={state.construct.name}
              onChange={(e) => dispatch({ type: 'rename', name: e.target.value })}
              slotProps={{ htmlInput: { 'aria-label': 'Design name' } }}
              sx={{ width: 240, '& .MuiInputBase-input': { py: 0.5, fontSize: 13 } }}
            />
          }
        >
          <CassetteRuler
            assembly={analysis.assembly}
            selectedInstanceId={state.selectedInstanceId}
            onSelect={(id) => dispatch({ type: 'select', instanceId: id })}
          />
          <CapacityReadout assembly={analysis.assembly} />
        </Section>

        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(340px, 440px) 1fr' },
            alignItems: 'start',
          }}
        >
          <Stack spacing={1.5}>
            <Section
              title={t.design.composition}
              aside={`${state.construct.genomeSerotype}/${state.construct.capsidSerotype} · ${
                state.construct.packaging === 'sc' ? 'self-complementary' : 'single-stranded'
              }`}
            >
              <BackboneSelector
                backbones={designer.backbonesAvailable}
                value={backbone.id}
                onChange={(id: BackboneId) => dispatch({ type: 'setBackbone', backboneId: id })}
                templateId={template.id}
              />
              <Box sx={{ borderTop: 1, borderColor: 'divider', my: 1.5 }} />
              <SlotList
                construct={state.construct}
                template={template}
                assembly={analysis.assembly}
                parts={lookup}
                findings={analysis.validation}
                selectedInstanceId={state.selectedInstanceId}
                onSelect={(id) => dispatch({ type: 'select', instanceId: id })}
                onRequestPart={onRequestPart}
                onRemove={(id) => dispatch({ type: 'removePart', instanceId: id })}
                onMove={(id, toIndex) => dispatch({ type: 'movePart', instanceId: id, toIndex })}
                onSetStrand={(id, strand) => dispatch({ type: 'setStrand', instanceId: id, strand })}
              />
            </Section>

            <Section
              title={t.design.findings}
              aside={t.design.errorsWarnings(
                analysis.validation.counts.error,
                analysis.validation.counts.warning,
              )}
            >
              <ValidationPanel
                report={analysis.validation}
                onFocus={focusAnchor}
                onApplyFix={(fix) => dispatch({ type: 'applyFix', fix })}
              />
            </Section>

            <Section title={t.design.designs} aside={t.design.saved(state.cart.items.length)}>
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
            </Section>
          </Stack>

          <Section
            title={t.design.map}
            flush
            aside={
              <ToggleButtonGroup
                size="small"
                exclusive
                value={mapSpace}
                onChange={(_, v) => v && setMapSpace(v)}
              >
                <ToggleButton value="plasmid" sx={{ px: 1, py: 0.25, fontSize: 12 }}>
                  {mapLabels.whole}
                </ToggleButton>
                <ToggleButton value="cassette" sx={{ px: 1, py: 0.25, fontSize: 12 }}>
                  {mapLabels.pgoi}
                </ToggleButton>
              </ToggleButtonGroup>
            }
          >
            <PlasmidMapWithActions
              className="castor-map"
              construct={state.construct}
              template={template}
              analysis={analysis}
              parts={lookup}
              space={mapSpace}
              selectedInstanceId={state.selectedInstanceId}
              onSelectInstance={(id) => dispatch({ type: 'select', instanceId: id })}
              onRequestPart={onRequestPart}
              onRemove={(id) => dispatch({ type: 'removePart', instanceId: id })}
              onSetStrand={(id, strand) => dispatch({ type: 'setStrand', instanceId: id, strand })}
              height={520}
            />
          </Section>
        </Box>
      </Stack>
    </Box>
  )
}
