import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  instanceId,
  partId,
  rowId,
  type ComparisonModel,
  type ComparisonRow,
} from '@castor-bio/core'
import { MessagesProvider } from '../i18n.js'
import { ThemeProvider } from '../theme/useTheme.js'
import { ComparisonView } from './ComparisonView.js'

const sharedPart = partId('cds/EGFP@1.0.0')
const row = (index: number): ComparisonRow => {
  const id = rowId(`row-${index}`)
  return {
    id,
    label: `Design ${index}`,
    segments: [
      {
        id: `${id}:pgoi`,
        length: 100,
        items: [
          {
            uid: `${id}:egfp`,
            instanceId: instanceId(`${id}:instance`),
            partId: sharedPart,
            name: 'EGFP',
            role: 'cds',
            start: 0,
            end: 100,
            strand: 1,
          },
        ],
      },
    ],
  }
}
const rows = [row(1), row(2)]
const model: ComparisonModel = { rows, links: [], groups: [] }

afterEach(cleanup)

describe('<ComparisonView>', () => {
  it('makes interactive SVG parts keyboard accessible', () => {
    const onSelectItem = vi.fn()
    render(
      <ThemeProvider>
        <MessagesProvider>
          <ComparisonView
            model={model}
            toolbar={false}
            legend={false}
            onSelectItem={onSelectItem}
          />
        </MessagesProvider>
      </ThemeProvider>,
    )

    const arrows = screen.getAllByRole('button', { name: /EGFP · 100 bp · cds/ })
    expect(arrows[0]!.getAttribute('tabindex')).toBe('0')
    fireEvent.keyDown(arrows[0]!, { key: 'Enter' })
    expect(onSelectItem).toHaveBeenCalledWith(`${rows[0]!.id}:egfp`)
    fireEvent.keyDown(arrows[0]!, { key: ' ' })
    expect(onSelectItem).toHaveBeenLastCalledWith(null)
  })
})
