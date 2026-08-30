import { useState, type ReactNode } from 'react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import Box from '@mui/material/Box'

export interface ExplainProps {
  title: string
  /** The one line that is always visible. Say what this is for, not what it is. */
  summary: ReactNode
  /** The rest, behind "More". Put the reasoning and the caveats here. */
  children?: ReactNode
  defaultOpen?: boolean
  severity?: 'info' | 'warning'
}

/**
 * The explanation that sits at the top of each tab.
 *
 * One always-visible line saying what the screen is for, and the reasoning folded away behind
 * it. An expert should be able to ignore this entirely after the first week, which is why it is
 * one line high when collapsed and never blocks anything.
 */
export function Explain({
  title,
  summary,
  children,
  defaultOpen = false,
  severity = 'info',
}: ExplainProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Alert
      severity={severity}
      variant="outlined"
      icon={false}
      sx={{ mb: 2, py: 0.5, borderColor: 'divider', bgcolor: 'background.paper' }}
      action={
        children ? (
          <Button size="small" onClick={() => setOpen((v) => !v)}>
            {open ? 'Less' : 'More'}
          </Button>
        ) : undefined
      }
    >
      <AlertTitle sx={{ mb: 0, fontSize: 13, fontWeight: 600 }}>{title}</AlertTitle>
      <Box sx={{ fontSize: 12.5, color: 'text.secondary' }}>{summary}</Box>
      {children && (
        <Collapse in={open}>
          <Box sx={{ fontSize: 12.5, color: 'text.secondary', mt: 1, '& p': { mt: 0, mb: 1 } }}>
            {children}
          </Box>
        </Collapse>
      )}
    </Alert>
  )
}
