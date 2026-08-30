import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { staticCatalogProvider } from '@castor-bio/core'
import { loadCatalog } from '@castor-bio/catalog'
import { MessagesProvider } from '../i18n.js'
import { ThemeProvider } from '../theme/useTheme.js'
import { PartPicker } from './PartPicker.js'
import type { PartRequest } from './SlotList.js'

const catalog = await loadCatalog(['promoter'])
const request: PartRequest = {
  slotKey: 'promoter' as never,
  repeatIndex: 0,
  roles: ['promoter'],
  label: 'Promoter',
}

afterEach(cleanup)

describe('<PartPicker>', () => {
  it('carries its theme tokens when rendered outside another CASTOR scope', async () => {
    render(
      <ThemeProvider theme={{ surface: '#abcdef' }}>
        <MessagesProvider>
          <PartPicker
            open
            request={request}
            providers={[staticCatalogProvider(catalog.parts)]}
            onPick={() => {}}
            onClose={() => {}}
          />
        </MessagesProvider>
      </ThemeProvider>,
    )

    const dialog = await screen.findByRole('dialog')
    const backdrop = dialog.parentElement
    expect(backdrop?.classList.contains('castor-scope')).toBe(true)
    expect(backdrop?.style.getPropertyValue('--castor-surface')).toBe('#abcdef')
  })

  it('cannot submit a candidate left over from an earlier search', async () => {
    const onPick = vi.fn()
    render(
      <ThemeProvider>
        <MessagesProvider>
          <PartPicker
            open
            request={request}
            providers={[staticCatalogProvider(catalog.parts)]}
            onPick={onPick}
            onClose={() => {}}
          />
        </MessagesProvider>
      </ThemeProvider>,
    )

    const [cagName] = await screen.findAllByText('CAG (935 bp)')
    fireEvent.click(cagName!.closest('button')!)
    const submit = screen.getByRole<HTMLButtonElement>('button', { name: 'Add to Promoter' })
    expect(submit.disabled).toBe(false)

    fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
      target: { value: 'EF1α' },
    })
    expect(submit.disabled).toBe(true)

    await screen.findAllByText('EF1α (full)')
    await waitFor(() => expect(submit.disabled).toBe(false))
    fireEvent.click(submit)
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'EF1α (full)' }))
  })
})
