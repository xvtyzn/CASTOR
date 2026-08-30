import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { LocaleCode } from '@castor-bio/react'
import { REFERENCE } from './reference-content.js'
import { castorMonospace } from '../theme.js'

export interface ReferenceTabProps {
  locale: LocaleCode
}

/** Renders **bold** and `code` spans. Enough markup for prose, and no dependency. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) {
          return <strong key={i}>{p.slice(2, -2)}</strong>
        }
        if (p.startsWith('`') && p.endsWith('`')) {
          return (
            <Box
              key={i}
              component="code"
              sx={{
                fontFamily: castorMonospace,
                fontSize: '0.92em',
                bgcolor: 'action.hover',
                px: 0.5,
                borderRadius: 0.5,
              }}
            >
              {p.slice(1, -1)}
            </Box>
          )
        }
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

export function ReferenceTab({ locale }: ReferenceTabProps) {
  const ref = REFERENCE[locale]

  return (
    <Box sx={{ maxWidth: 900 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
        {ref.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {ref.lede}
      </Typography>

      <Stack spacing={3}>
        {ref.sections.map((s) => (
          <Paper key={s.id} variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
              {s.title}
            </Typography>
            <Stack spacing={1.25}>
              {s.body.map((p, i) => (
                <Typography key={i} variant="body2" sx={{ lineHeight: 1.75 }}>
                  <Rich text={p} />
                </Typography>
              ))}
            </Stack>
            {s.code && (
              <Box
                component="pre"
                sx={{
                  mt: 2,
                  mb: 0,
                  p: 1.5,
                  fontFamily: castorMonospace,
                  fontSize: 11.5,
                  lineHeight: 1.65,
                  bgcolor: 'action.hover',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  overflowX: 'auto',
                }}
              >
                {s.code.source}
              </Box>
            )}
          </Paper>
        ))}
      </Stack>

      <Divider sx={{ my: 3 }} />
      <Typography variant="caption" color="text.secondary">
        The types above are exported from{' '}
        <Box component="code" sx={{ fontFamily: castorMonospace }}>
          @castor-bio/core
        </Box>
        . A worked implementation of a project-history registry lives in{' '}
        <Box component="code" sx={{ fontFamily: castorMonospace }}>
          apps/playground/src/registry/
        </Box>
        .{' '}
        <Link href="https://www.ncbi.nlm.nih.gov/books/NBK25497/" target="_blank" rel="noreferrer">
          NCBI E-utilities
        </Link>{' '}
        ·{' '}
        <Link href="https://europepmc.org/RestfulWebService" target="_blank" rel="noreferrer">
          Europe PMC REST
        </Link>
      </Typography>
    </Box>
  )
}
