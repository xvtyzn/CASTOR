import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import type { WorkbenchMessages } from '../messages.js'
import { castorMonospace } from '../theme.js'

export interface OverviewTabProps {
  t: WorkbenchMessages
  counts: { parts: number; backbones: number; templates: number; designs: number }
  onStart: () => void
}

export function OverviewTab({ t, counts, onStart }: OverviewTabProps) {
  const o = t.overview
  const stats = [
    { n: counts.parts, label: o.status.parts },
    { n: counts.backbones, label: o.status.backbones },
    { n: counts.templates, label: o.status.templates },
    { n: counts.designs, label: o.status.designs },
  ]

  return (
    <Box sx={{ maxWidth: 900 }}>
      <Typography variant="h5" sx={{ fontWeight: 600, letterSpacing: '-0.01em', mb: 1 }}>
        {o.title}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.7 }}>
        {o.lede}
      </Typography>

      <Button variant="contained" onClick={onStart} sx={{ mb: 4 }}>
        {t.tabs.design} →
      </Button>

      <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="overline" color="text.secondary">
          {o.whatItIs.title}
        </Typography>
        <Typography variant="body2" sx={{ lineHeight: 1.75, mt: 0.5 }}>
          {o.whatItIs.body}
        </Typography>
      </Paper>

      {/* The numbered markers are load-bearing here: this really is a sequence, and the order
          is the thing a first-time user needs. */}
      <Typography variant="overline" color="text.secondary">
        {o.steps.title}
      </Typography>
      <Stack spacing={0} sx={{ mt: 1, mb: 4 }}>
        {o.steps.items.map((item, i) => (
          <Box
            key={item.title}
            sx={{
              display: 'grid',
              gridTemplateColumns: '2.25rem 1fr',
              gap: 1.5,
              py: 1.5,
              borderTop: i === 0 ? 0 : 1,
              borderColor: 'divider',
            }}
          >
            <Typography
              sx={{
                fontFamily: castorMonospace,
                fontVariantNumeric: 'tabular-nums',
                fontSize: 13,
                color: 'text.disabled',
                pt: '2px',
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </Typography>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {item.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                {item.body}
              </Typography>
            </Box>
          </Box>
        ))}
      </Stack>

      <Typography variant="overline" color="text.secondary">
        {o.principles.title}
      </Typography>
      <Box
        sx={{
          mt: 1,
          mb: 4,
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
        }}
      >
        {o.principles.items.map((p) => (
          <Paper key={p.title} variant="outlined" sx={{ p: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {p.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
              {p.body}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        }}
      >
        {stats.map((s) => (
          <Paper key={s.label} variant="outlined" sx={{ p: 2 }}>
            <Typography
              sx={{
                fontFamily: castorMonospace,
                fontVariantNumeric: 'tabular-nums',
                fontSize: 26,
                lineHeight: 1.1,
              }}
            >
              {s.n}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {s.label}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Box>
  )
}
