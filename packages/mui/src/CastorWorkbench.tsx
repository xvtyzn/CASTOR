import { lazy, Suspense, useMemo, useState } from 'react'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import CssBaseline from '@mui/material/CssBaseline'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { ThemeProvider } from '@mui/material/styles'
import {
  MessagesProvider,
  PartPicker,
  ThemeProvider as CastorThemeProvider,
  themeToCssVars,
  useCastorDesigner,
  useCastorTheme,
  type LocaleCode,
  type PartRequest,
} from '@castor-bio/react'
import {
  pastedSequenceProvider,
  staticCatalogProvider,
  type Backbone,
  type CassetteTemplate,
  type CastorTheme,
  type Part,
  type PartProvider,
  type Usage,
  type ValidationOptions,
} from '@castor-bio/core'
import { createCastorMuiTheme, castorMonospace } from './theme.js'
import { workbenchLocales } from './messages.js'

// Tabs carry very different heavy dependencies (seqviz, comparison SVGs, registry tables).
// Loading the active one keeps the workbench's initial bundle small without changing its API.
const OverviewTab = lazy(() =>
  import('./tabs/OverviewTab.js').then((module) => ({ default: module.OverviewTab })),
)
const DesignTab = lazy(() =>
  import('./tabs/DesignTab.js').then((module) => ({ default: module.DesignTab })),
)
const CompareTab = lazy(() =>
  import('./tabs/CompareTab.js').then((module) => ({ default: module.CompareTab })),
)
const RegistryTab = lazy(() =>
  import('./tabs/RegistryTab.js').then((module) => ({ default: module.RegistryTab })),
)
const ReferenceTab = lazy(() =>
  import('./tabs/ReferenceTab.js').then((module) => ({ default: module.ReferenceTab })),
)

export interface CastorWorkbenchProps {
  parts: Part[]
  backbones: Backbone[]
  templates: CassetteTemplate[]
  providers?: PartProvider[]
  validation?: Partial<ValidationOptions>
  theme?: Partial<CastorTheme>
  renderProvenance?: (usages: Usage[], part: Part) => React.ReactNode
  locale?: LocaleCode
  onLocaleChange?: (locale: LocaleCode) => void
  /** Set false when the host already renders MUI's CssBaseline. */
  cssBaseline?: boolean
  comparisonWidth?: number
}

type TabKey = 'overview' | 'design' | 'compare' | 'registry' | 'reference'
const TAB_ORDER: TabKey[] = ['overview', 'design', 'compare', 'registry', 'reference']

/**
 * The batteries-included application.
 *
 * This composes `@castor-bio/react` and adds nothing to it — the tabs, the MUI chrome and the
 * onboarding copy live here so that a host embedding the primitives never carries them. The
 * boundary is worth stating because it is easy to erode: if anything in `core` or `react` ever
 * needs to know a tab exists, the split has failed.
 *
 * Locale is controlled when `onLocaleChange` is supplied and internal otherwise, so an app that
 * already has a language switcher can drive this one from it.
 */
export function CastorWorkbench(props: CastorWorkbenchProps) {
  const muiTheme = useMemo(() => createCastorMuiTheme(props.theme), [props.theme])
  return (
    <ThemeProvider theme={muiTheme}>
      {props.cssBaseline !== false && <CssBaseline />}
      <CastorThemeProvider theme={props.theme}>
        <WorkbenchBody {...props} />
      </CastorThemeProvider>
    </ThemeProvider>
  )
}

function WorkbenchBody({
  parts,
  backbones,
  templates,
  providers,
  validation,
  renderProvenance,
  locale,
  onLocaleChange,
  comparisonWidth = 1180,
}: CastorWorkbenchProps) {
  const castorTheme = useCastorTheme()
  const [internalLocale, setInternalLocale] = useState<LocaleCode>(locale ?? 'en')
  const activeLocale = locale ?? internalLocale
  const setLocale = (next: LocaleCode) => {
    setInternalLocale(next)
    onLocaleChange?.(next)
  }

  const t = workbenchLocales[activeLocale]
  const [tab, setTab] = useState<TabKey>('overview')
  const [request, setRequest] = useState<PartRequest | null>(null)

  const designer = useCastorDesigner({
    parts,
    backbones,
    templates,
    ...(validation ? { validation } : {}),
  })

  const pickerProviders = useMemo<PartProvider[]>(
    () => [staticCatalogProvider(parts), ...(providers ?? []), pastedSequenceProvider()],
    [parts, providers],
  )

  /** Materialized entries for the registry table; async providers stay in the picker. */
  const registryParts = useMemo(() => {
    const merged = new Map<string, Part>()
    for (const p of parts) merged.set(String(p.id), p)
    return [...merged.values()]
  }, [parts])

  const cap = designer.analysis.assembly.capacity
  const worst = designer.analysis.validation.worst

  return (
    <MessagesProvider messages={activeLocale}>
      <Box
        className="castor-scope"
        style={themeToCssVars(castorTheme)}
        sx={{ bgcolor: 'background.default', minHeight: '100vh' }}
      >
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Toolbar variant="dense" sx={{ gap: 1.5, minHeight: 44 }}>
            <Tooltip title={`${t.tagline} — ${t.expansion}`}>
              <Typography sx={{ fontWeight: 700, fontSize: 15, cursor: 'default' }}>
                {t.appName}
              </Typography>
            </Tooltip>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: { xs: 'none', md: 'block' } }}
            >
              {t.tagline}
            </Typography>

            <Box sx={{ flex: 1 }} />

            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Tooltip title={cap.message}>
                <Typography
                  variant="caption"
                  sx={{ fontFamily: castorMonospace, cursor: 'default' }}
                  color={
                    cap.severity === 'error'
                      ? 'error'
                      : cap.severity === 'warning'
                        ? 'warning.main'
                        : 'text.secondary'
                  }
                >
                  {cap.itrToItr.toLocaleString()} bp
                </Typography>
              </Tooltip>
              {worst && (
                <Typography variant="caption" color={worst === 'error' ? 'error' : 'warning.main'}>
                  {designer.analysis.validation.counts.error +
                    designer.analysis.validation.counts.warning}{' '}
                  ⚑
                </Typography>
              )}
              <ToggleButtonGroup
                size="small"
                exclusive
                value={activeLocale}
                onChange={(_, v) => v && setLocale(v as LocaleCode)}
                aria-label={t.language}
              >
                <ToggleButton value="en" sx={{ px: 1, py: 0.2, fontSize: 11 }}>
                  EN
                </ToggleButton>
                <ToggleButton value="ja" sx={{ px: 1, py: 0.2, fontSize: 11 }}>
                  日本語
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Toolbar>

          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v as TabKey)}
            sx={{ px: 2, minHeight: 38, borderTop: 1, borderColor: 'divider' }}
          >
            {TAB_ORDER.map((key) => (
              <Tab key={key} value={key} label={t.tabs[key]} />
            ))}
          </Tabs>
        </AppBar>

        {/* castor-scope carries the library's design tokens without its stacked layout, which
            this shell provides instead. */}
        <Container maxWidth="xl" sx={{ py: 2 }}>
          <Suspense
            fallback={
              <Box role="status" sx={{ py: 4, color: 'text.secondary' }}>
                {t.loading}
              </Box>
            }
          >
            {tab === 'overview' && (
              <OverviewTab
                t={t}
                counts={{
                  parts: parts.length,
                  backbones: backbones.length,
                  templates: templates.length,
                  designs: designer.state.cart.items.length,
                }}
                onStart={() => setTab('design')}
              />
            )}
            {tab === 'design' && <DesignTab t={t} designer={designer} onRequestPart={setRequest} />}
            {tab === 'compare' && <CompareTab t={t} designer={designer} width={comparisonWidth} />}
            {tab === 'registry' && <RegistryTab t={t} parts={registryParts} />}
            {tab === 'reference' && <ReferenceTab locale={activeLocale} />}
          </Suspense>
        </Container>

        <PartPicker
          open={request !== null}
          request={request}
          providers={pickerProviders}
          {...(renderProvenance ? { renderProvenance } : {})}
          onClose={() => setRequest(null)}
          onPick={(part) => {
            if (request?.replacingInstanceId) {
              designer.dispatch({
                type: 'replacePart',
                instanceId: request.replacingInstanceId,
                part,
              })
            } else if (request) {
              designer.dispatch({
                type: 'addPart',
                slotKey: request.slotKey,
                part,
                ...(request.at !== undefined ? { at: request.at } : {}),
              })
            }
            setRequest(null)
          }}
        />
      </Box>
    </MessagesProvider>
  )
}
