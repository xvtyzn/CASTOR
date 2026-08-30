import { useDeferredValue, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { PART_ROLES, type Part, type PartRole, type Usage } from '@castor-bio/core'
import { Explain } from '../shell/Explain.js'
import { Section } from '../shell/Section.js'
import { castorMonospace } from '../theme.js'
import type { WorkbenchMessages } from '../messages.js'

export interface RegistryTabProps {
  t: WorkbenchMessages
  parts: Part[]
}

type SortKey = 'name' | 'role' | 'length' | 'projects' | 'constructs'

interface Row {
  part: Part
  projects: number
  constructs: number
  projectIds: string[]
  publications: number
  source: string
}

function usageRow(part: Part): Row {
  const usages: Usage[] = part.provenance.usages ?? []
  const projectUsages = usages.filter((u) => u.kind === 'project')
  const ids = [...new Set(projectUsages.map((u) => u.projectId ?? u.title))]
  const accession = part.provenance.accessions?.[0]
  return {
    part,
    projects: ids.length,
    constructs: projectUsages.length,
    projectIds: ids,
    publications: usages.filter((u) => u.kind === 'publication').length,
    source: accession ? `${accession.db} ${accession.id}` : part.provenance.origin,
  }
}

/**
 * The registry, browsable.
 *
 * The picker answers "what can go in this slot"; this answers the question that comes before
 * it — what does the group already have, and what has it actually been using? Sorting by
 * projects puts the house standards at the top and the one-offs at the bottom, which is the
 * distinction that decides whether you reach for something or look at it twice.
 */
export function RegistryTab({ t, parts }: RegistryTabProps) {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<PartRole | 'all'>('all')
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'projects', desc: true })
  const deferredQuery = useDeferredValue(query)

  const rows = useMemo(() => {
    const all = parts.map(usageRow)
    const needle = deferredQuery.trim().toLowerCase()
    const filtered = all.filter((r) => {
      if (role !== 'all' && r.part.role !== role) return false
      if (!needle) return true
      return [r.part.name, ...(r.part.aliases ?? []), String(r.part.id), r.source, ...r.projectIds]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
    const dir = sort.desc ? -1 : 1
    return filtered.sort((a, b) => {
      switch (sort.key) {
        case 'name':
          return dir * a.part.name.localeCompare(b.part.name)
        case 'role':
          return dir * a.part.role.localeCompare(b.part.role)
        case 'length':
          return dir * (a.part.length - b.part.length)
        case 'constructs':
          return dir * (a.constructs - b.constructs) || a.part.name.localeCompare(b.part.name)
        default:
          return (
            dir * (a.projects - b.projects) ||
            dir * (a.constructs - b.constructs) ||
            a.part.name.localeCompare(b.part.name)
          )
      }
    })
  }, [parts, deferredQuery, role, sort])

  const rolesPresent = useMemo(
    () => PART_ROLES.filter((r) => parts.some((p) => p.role === r)),
    [parts],
  )

  const header = (key: SortKey, label: string, numeric = false) => (
    <TableCell
      align={numeric ? 'right' : 'left'}
      sortDirection={sort.key === key ? (sort.desc ? 'desc' : 'asc') : false}
    >
      <TableSortLabel
        active={sort.key === key}
        direction={sort.key === key && sort.desc ? 'desc' : 'asc'}
        onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }))}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  )

  return (
    <Box>
      <Explain title={t.registry.explainTitle} summary={t.registry.explainSummary}>
        {t.registry.explainBody.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </Explain>

      <Section title={t.registry.parts} aside={t.registry.showing(rows.length, parts.length)} flush>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ p: 1.25, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <TextField
            size="small"
            placeholder={t.registry.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ minWidth: 320, '& .MuiInputBase-input': { py: 0.75, fontSize: 13 } }}
          />
          <TextField
            size="small"
            select
            label={t.registry.role}
            value={role}
            onChange={(e) => setRole(e.target.value as PartRole | 'all')}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="all">{t.registry.allRoles}</MenuItem>
            {rolesPresent.map((r) => (
              <MenuItem key={r} value={r}>
                {r}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <TableContainer sx={{ maxHeight: 620, borderTop: 1, borderColor: 'divider' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {header('name', t.registry.columns.part)}
                {header('role', t.registry.columns.role)}
                {header('length', t.registry.columns.length, true)}
                {header('projects', t.registry.columns.projects, true)}
                {header('constructs', t.registry.columns.constructs, true)}
                <TableCell>{t.registry.columns.usedIn}</TableCell>
                <TableCell>{t.registry.columns.source}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.part.id)} hover>
                  <TableCell>
                    <Tooltip title={r.part.description ?? ''} placement="top-start">
                      <span style={{ fontWeight: 500 }}>{r.part.name}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{r.part.role}</TableCell>
                  <TableCell align="right" sx={{ fontFamily: castorMonospace }}>
                    {r.part.length.toLocaleString('en-US')}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontFamily: castorMonospace,
                      fontWeight: r.projects > 1 ? 600 : 400,
                      color: r.projects === 0 ? 'text.disabled' : 'text.primary',
                    }}
                  >
                    {r.projects || '—'}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontFamily: castorMonospace, color: 'text.secondary' }}
                  >
                    {r.constructs || '—'}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                      {r.projectIds.slice(0, 4).map((id) => (
                        <Chip
                          key={id}
                          label={id}
                          size="small"
                          variant="outlined"
                          sx={{ height: 20, fontSize: 11 }}
                        />
                      ))}
                      {r.projectIds.length > 4 && (
                        <Typography variant="caption" color="text.secondary">
                          +{r.projectIds.length - 4}
                        </Typography>
                      )}
                      {r.projectIds.length === 0 && r.publications > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          {t.registry.publications(r.publications)}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell
                    sx={{ fontFamily: castorMonospace, fontSize: 11.5, color: 'text.secondary' }}
                  >
                    {r.source}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Section>
    </Box>
  )
}
