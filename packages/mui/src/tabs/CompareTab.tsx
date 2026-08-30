import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import { CartPanel, ComparisonView, type ComparisonViewOptions } from '@castor-bio/react'
import type { CastorDesignerApi } from '@castor-bio/react'
import { Explain } from '../shell/Explain.js'
import { Section } from '../shell/Section.js'
import type { WorkbenchMessages } from '../messages.js'

export interface CompareTabProps {
  t: WorkbenchMessages
  designer: CastorDesignerApi
  width?: number
}

export function CompareTab({ t, designer, width = 1180 }: CompareTabProps) {
  const { state, dispatch, comparison, cartAssemblies } = designer
  const [options, setOptions] = useState<ComparisonViewOptions>({})

  return (
    <Box>
      <Explain title={t.compare.explainTitle} summary={t.compare.explainSummary}>
        {t.compare.explainBody.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </Explain>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: '1fr minmax(260px, 320px)' },
          alignItems: 'start',
        }}
      >
        <Section title={t.tabs.compare} flush>
          <ComparisonView
            model={comparison}
            options={options}
            onOptionsChange={setOptions}
            width={width}
          />
        </Section>

        <Stack spacing={2}>
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
      </Box>
    </Box>
  )
}
