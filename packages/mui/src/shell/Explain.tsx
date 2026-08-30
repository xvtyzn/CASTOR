import { useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Collapse from '@mui/material/Collapse'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

export interface ExplainProps {
  title: string
  /** The one line that is always visible. Say what this is for, not what it is. */
  summary: ReactNode
  /** The rest, behind "More". Put the reasoning and the caveats here. */
  children?: ReactNode
  defaultOpen?: boolean
}

/**
 * The explanation at the top of a tab.
 *
 * Deliberately not a callout box. An outlined, tinted panel says "read me" every time the screen
 * loads, which is right once and wrong for the rest of the time somebody uses the tool. This is
 * a heading and a caption with the reasoning folded behind a text link — visible when wanted,
 * near-invisible when not.
 */
export function Explain({ title, summary, children, defaultOpen = false }: ExplainProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Box sx={{ mb: 1.75 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 240 }}>
          {summary}
        </Typography>
        {children && (
          <Link
            component="button"
            type="button"
            variant="body2"
            underline="hover"
            color="text.secondary"
            onClick={() => setOpen((v) => !v)}
            sx={{ flex: 'none' }}
          >
            {open ? '− ' : '+ '}
            {open ? 'less' : 'why'}
          </Link>
        )}
      </Stack>
      {children && (
        <Collapse in={open}>
          <Box
            sx={{
              mt: 1,
              pl: 1.5,
              borderLeft: 2,
              borderColor: 'divider',
              fontSize: 12.5,
              lineHeight: 1.7,
              color: 'text.secondary',
              '& p': { mt: 0, mb: 1 },
              '& p:last-child': { mb: 0 },
            }}
          >
            {children}
          </Box>
        </Collapse>
      )}
    </Box>
  )
}
