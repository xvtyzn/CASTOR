import { useEffect, useMemo, useState } from 'react'
import { CastorWorkbench } from '@castor-bio/mui'
import { loadCatalog, type CatalogBundle } from '@castor-bio/catalog'
import type { LocaleCode } from '@castor-bio/react'
import type { PartProvider } from '@castor-bio/core'
import { labRegistryProvider, withProjectHistory } from './registry/index.js'

/**
 * Everything a host application has to do:
 *   1. load a catalogue
 *   2. supply a PartProvider for its own construct history
 *
 * `withProjectHistory` attaches the archive's usage records to the parts themselves, so the
 * registry table and the picker both see them; `labRegistryProvider` is the same data behind
 * the provider interface, which is what adds the "Our lab" tab to the picker.
 */
export function App() {
  const [catalog, setCatalog] = useState<CatalogBundle | null>(null)
  const [locale, setLocale] = useState<LocaleCode>(
    typeof navigator !== 'undefined' && navigator.language.startsWith('ja') ? 'ja' : 'en',
  )

  useEffect(() => {
    loadCatalog().then(setCatalog)
  }, [])

  const providers = useMemo<PartProvider[]>(
    () => (catalog ? [labRegistryProvider(catalog.parts)] : []),
    [catalog],
  )
  const parts = useMemo(
    () => (catalog ? withProjectHistory(catalog.parts) : []),
    [catalog],
  )

  if (!catalog) {
    return <div className="pg-loading">Loading catalogue…</div>
  }

  return (
    <CastorWorkbench
      parts={parts}
      backbones={catalog.backbones}
      templates={catalog.templates}
      providers={providers}
      locale={locale}
      onLocaleChange={setLocale}
    />
  )
}
