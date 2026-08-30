import type { ReactNode } from 'react'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import type { SxProps, Theme } from '@mui/material/styles'

export interface SectionProps {
  title: string
  /** Right-aligned status: a count, a size, a control. */
  aside?: ReactNode
  children: ReactNode
  /** Remove the body padding, for panels that render their own edge-to-edge content. */
  flush?: boolean
  sx?: SxProps<Theme>
}

/** A titled panel. One component so every panel in the workbench has the same head. */
export function Section({ title, aside, children, flush, sx }: SectionProps) {
  return (
    <Paper
      variant="outlined"
      sx={[{ overflow: 'hidden' }, ...(Array.isArray(sx) ? sx : [sx])] as SxProps<Theme>}
    >
      {/* MUI 9 moved Stack's alignment props into sx; keeping them there also keeps every
          layout value in one place per component. */}
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'baseline',
          justifyContent: 'space-between',
          px: 1.5,
          py: 0.75,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="overline" color="text.secondary">
          {title}
        </Typography>
        <Box sx={{ fontSize: 12, color: 'text.secondary' }}>{aside}</Box>
      </Stack>
      <Box sx={{ p: flush ? 0 : 1.25 }}>{children}</Box>
    </Paper>
  )
}
