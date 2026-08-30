import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import type { WorkbenchMessages } from '../messages.js'
import { castorMonospace } from '../theme.js'

export interface OverviewTabProps {
  t: WorkbenchMessages
  counts: { parts: number; backbones: number; templates: number; designs: number }
  onStart: () => void
}

/**
 * Orientation, not a landing page.
 *
 * An earlier version led with a large headline, a call to action and four oversized numbers,
 * which is the shape of a marketing page and the wrong shape for the first tab of a tool
 * somebody opens every day. This is closer to the front matter of a manual: the steps in order,
 * the three facts that make the rest make sense, and the counts as a status line rather than a
 * feature.
 */
export function OverviewTab({ t, counts, onStart }: OverviewTabProps) {
  const o = t.overview
  const stats = [
    { n: counts.parts, label: o.status.parts(counts.parts) },
    { n: counts.backbones, label: o.status.backbones(counts.backbones) },
    { n: counts.templates, label: o.status.templates(counts.templates) },
    { n: counts.designs, label: o.status.designs(counts.designs) },
  ]

  return (
    <Box sx={{ maxWidth: 880 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
        {o.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.7 }}>
        {o.lede}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.7 }}>
        {o.whatItIs.body}
      </Typography>

      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ display: 'block', px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider' }}
        >
          {o.steps.title}
        </Typography>
        <Box sx={{ px: 1.5, py: 0.5 }}>
          {/* The numbers are load-bearing: this is a real sequence, and the order is what a
              first-time user needs. They are not decoration. */}
          {o.steps.items.map((item, i) => (
            <Box
              key={item.title}
              sx={{
                display: 'grid',
                gridTemplateColumns: '1.6rem minmax(9rem, 12rem) 1fr',
                gap: 1.5,
                py: 0.9,
                borderTop: i === 0 ? 0 : 1,
                borderColor: 'divider',
                alignItems: 'baseline',
              }}
            >
              <Typography
                sx={{
                  fontFamily: castorMonospace,
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 12,
                  color: 'text.disabled',
                }}
              >
                {i + 1}.
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {item.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                {item.body}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ display: 'block', px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider' }}
        >
          {o.principles.title}
        </Typography>
        <Box sx={{ px: 1.5, py: 0.5 }}>
          {o.principles.items.map((p, i) => (
            <Box
              key={p.title}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'minmax(11rem, 14rem) 1fr' },
                gap: 1.5,
                py: 0.9,
                borderTop: i === 0 ? 0 : 1,
                borderColor: 'divider',
                alignItems: 'baseline',
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {p.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                {p.body}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2.5,
          flexWrap: 'wrap',
          py: 1,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        {stats.map((s) => (
          <Typography key={s.label} variant="body2" color="text.secondary">
            <Box
              component="span"
              sx={{ fontFamily: castorMonospace, fontVariantNumeric: 'tabular-nums', color: 'text.primary' }}
            >
              {s.n}
            </Box>{' '}
            {s.label}
          </Typography>
        ))}
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="outlined" onClick={onStart}>
          {t.tabs.design} →
        </Button>
      </Box>
    </Box>
  )
}
