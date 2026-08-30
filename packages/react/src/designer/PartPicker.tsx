import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { parsePastedSequence, type Part, type PartProvider, type Usage } from '@castor-bio/core'
import { themeToCssVars, useCastorTheme } from '../theme/useTheme.js'
import { bp, formatSequenceBlock } from '../format.js'
import { useMessages } from '../i18n.js'
import type { PartRequest } from './SlotList.js'

export interface PartPickerProps {
  open: boolean
  request: PartRequest | null
  providers: PartProvider[]
  onPick: (part: Part) => void
  onClose: () => void
  /** Replace the default provenance rendering — e.g. to link into your own project tracker. */
  renderProvenance?: (usages: Usage[], part: Part) => React.ReactNode
  sequencePreview?: 'full' | 'ends' | 'none'
}

/**
 * "Which one do you want?"
 *
 * Two panes: candidates on the left, the selected candidate in full on the right. The right
 * pane leads with what the part IS (sequence and length) and then where it has been used,
 * because "hSyn1, as in pAAV-hSyn-hChR2(H134R)-EYFP" is what actually settles the choice at
 * a bench — more than any description could.
 */
export function PartPicker({
  open,
  request,
  providers,
  onPick,
  onClose,
  renderProvenance,
  sequencePreview = 'ends',
}: PartPickerProps) {
  const theme = useCastorTheme()
  const t = useMessages()
  const [providerId, setProviderId] = useState(providers[0]?.id ?? '')
  const [text, setText] = useState('')
  const [results, setResults] = useState<Part[]>([])
  const [selected, setSelected] = useState<Part | null>(null)
  const [pasted, setPasted] = useState('')
  const [pasteName, setPasteName] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)

  const provider = providers.find((p) => p.id === providerId) ?? providers[0]

  useEffect(() => {
    if (!open) return
    setText('')
    setPasted('')
    setPasteName('')
    setSelected(null)
    setProviderId(providers[0]?.id ?? '')
  }, [open, request, providers])

  useEffect(() => {
    if (!open || !provider || !request) return
    let cancelled = false
    const controller = new AbortController()
    provider
      .search({ roles: request.roles, text: text || undefined }, controller.signal)
      .then((page) => {
        if (cancelled) return
        setResults(page.parts)
        setSelected(
          (cur) => page.parts.find((part) => part.id === cur?.id) ?? page.parts[0] ?? null,
        )
      })
      .catch(() => {
        if (!cancelled) setResults([])
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [open, provider, request, text])

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ]
      if (focusable.length === 0) {
        e.preventDefault()
        dialogRef.current.focus()
        return
      }
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    dialogRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [open, onClose])

  const parsedPaste = useMemo(() => {
    if (!pasted.trim() || !request) return null
    return parsePastedSequence(pasted, request.roles[0] ?? provider?.defaultPasteRole ?? 'custom', {
      name: pasteName,
    })
  }, [pasted, pasteName, request, provider])

  if (!open || !request) return null

  const isPaste = provider?.capabilities.paste ?? false

  return (
    <div
      className="castor-dialog-backdrop castor-scope"
      style={themeToCssVars(theme)}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="castor-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t.picker.title(request.label)}
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="castor-dialog__head">
          <div>
            <h2 className="castor-dialog__title">{t.picker.title(request.label)}</h2>
            {request.hint && <p className="castor-hint">{request.hint}</p>}
          </div>
          <button type="button" className="castor-btn castor-btn--ghost" onClick={onClose}>
            {t.common.close}
          </button>
        </div>

        <div className="castor-dialog__tabs" role="tablist">
          {providers.map((p) => (
            <button
              key={p.id}
              role="tab"
              type="button"
              className="castor-tab"
              aria-selected={p.id === providerId}
              onClick={() => {
                setProviderId(p.id)
                setResults([])
                setSelected(null)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="castor-dialog__body">
          <div className="castor-dialog__list">
            {isPaste ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="castor-hint">{t.picker.pasteName}</span>
                  <input
                    className="castor-input"
                    value={pasteName}
                    onChange={(e) => setPasteName(e.target.value)}
                    placeholder={t.picker.pasteName}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="castor-hint">{t.picker.pasteSequence}</span>
                  <textarea
                    className="castor-input"
                    style={{ fontFamily: theme.fontFamily, minHeight: 160, resize: 'vertical' }}
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    placeholder={t.picker.pastePlaceholder}
                  />
                </label>
                {parsedPaste && (
                  <p className="castor-hint">
                    {t.picker.pasteRead(bp(parsedPaste.part.length))}
                    {parsedPaste.droppedCharacters > 0 &&
                      ` · ${t.picker.pasteDropped(parsedPaste.droppedCharacters)}`}
                    {parsedPaste.fromFastaHeader && ` · ${t.picker.pasteFromHeader}`}
                  </p>
                )}
              </div>
            ) : (
              <>
                <input
                  className="castor-input"
                  style={{ width: '100%', marginBottom: 8 }}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value)
                    setResults([])
                    setSelected(null)
                  }}
                  placeholder={t.picker.searchPlaceholder(request.roles.join(', '))}
                  aria-label={t.common.search}
                />
                {results.length === 0 ? (
                  <p className="castor-hint">
                    {t.picker.nothingAccepts(request.roles.join(' / '))}
                  </p>
                ) : (
                  results.map((part) => (
                    <button
                      key={String(part.id)}
                      type="button"
                      className="castor-candidate"
                      aria-selected={selected?.id === part.id}
                      onClick={() => setSelected(part)}
                      onDoubleClick={() => onPick(part)}
                    >
                      <span className="castor-candidate__top">
                        <span className="castor-candidate__name">{part.name}</span>
                        <span className="castor-candidate__meta castor-num">{part.length} bp</span>
                      </span>
                      <span className="castor-candidate__meta">{summarise(part)}</span>
                      <UsageBadge part={part} />
                    </button>
                  ))
                )}
              </>
            )}
          </div>

          <div className="castor-dialog__detail">
            {isPaste ? (
              parsedPaste ? (
                <PartDetail
                  part={parsedPaste.part}
                  sequencePreview={sequencePreview}
                  renderProvenance={renderProvenance}
                />
              ) : (
                <p className="castor-hint">{t.picker.pastePrompt}</p>
              )
            ) : selected ? (
              <PartDetail
                part={selected}
                sequencePreview={sequencePreview}
                renderProvenance={renderProvenance}
              />
            ) : (
              <p className="castor-hint">{t.picker.selectPrompt}</p>
            )}
          </div>
        </div>

        <div className="castor-dialog__foot">
          <button type="button" className="castor-btn" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="castor-btn castor-btn--primary"
            disabled={isPaste ? !parsedPaste : !selected}
            onClick={() => {
              const part = isPaste ? parsedPaste?.part : selected
              if (part) onPick(part)
            }}
          >
            {t.picker.addTo(request.label)}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Group project usages by project rather than listing every construct flat.
 *
 * A part used in eight constructs across three projects is a three-project part; a flat list of
 * eight rows reads as eight unrelated facts and buries the one number that decides whether this
 * is the group's standard choice or somebody's one-off.
 */
function groupUsages(usages: readonly Usage[]) {
  const projects = new Map<string, { label: string; meta: string; key: string; usages: Usage[] }>()
  const other: Usage[] = []

  for (const u of usages) {
    if (u.kind !== 'project') {
      other.push(u)
      continue
    }
    const key = u.projectId ?? u.title
    const entry = projects.get(key)
    if (entry) entry.usages.push(u)
    else {
      projects.set(key, {
        label: u.title,
        // The badge uses `key` alone; team and year belong in the detail pane, where there is
        // room for them. A badge that wraps to two lines stops being a badge.
        meta: [u.projectId, u.team ?? u.owner, u.year].filter(Boolean).join(' · '),
        key,
        usages: [u],
      })
    }
  }
  return { projects: [...projects.values()], other }
}

/** "3 projects · 5 constructs", or the fact that it has only ever been used once. */
function UsageBadge({ part }: { part: Part }) {
  const t = useMessages()
  const usages = part.provenance.usages ?? []
  const { projects, other } = groupUsages(usages)
  const constructs = usages.filter((u) => u.kind === 'project').length

  if (projects.length === 0) {
    return other.length > 0 ? (
      <span className="castor-candidate__meta">{t.picker.publications(other.length)}</span>
    ) : (
      <span className="castor-candidate__meta castor-usage-badge--none">{t.picker.notUsedYet}</span>
    )
  }

  return (
    <span
      className={[
        'castor-candidate__meta',
        'castor-usage-badge',
        projects.length === 1 ? 'castor-usage-badge--unique' : 'castor-usage-badge--shared',
      ].join(' ')}
    >
      {projects.length === 1
        ? constructs > 1
          ? t.picker.onlyProjectWithCount(projects[0]!.key, constructs)
          : t.picker.onlyProject(projects[0]!.key)
        : t.picker.sharedAcross(projects.length, constructs)}
    </span>
  )
}

function UsageList({ usages }: { usages: readonly Usage[] }) {
  const t = useMessages()
  const { projects, other } = groupUsages(usages)
  return (
    <>
      {projects.length > 0 && (
        <ul className="castor-usages">
          {projects.map((p) => (
            <li className="castor-usage" key={p.label + p.meta}>
              <div className="castor-usage__title">{p.label}</div>
              <div className="castor-usage__meta">{p.meta}</div>
              <ul className="castor-usage__constructs">
                {p.usages.map((u, i) => (
                  <li key={i}>
                    <span className="castor-usage__construct">
                      {u.constructName ?? t.picker.unnamedConstruct}
                    </span>
                    {u.note && <div className="castor-usage__note">{u.note}</div>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {other.length > 0 && (
        <ul className="castor-usages" style={{ marginTop: projects.length ? 10 : 0 }}>
          {other.map((u, i) => (
            <li className="castor-usage" key={i}>
              <div className="castor-usage__title">
                {u.url ? (
                  <a href={u.url} target="_blank" rel="noreferrer noopener">
                    {u.title}
                  </a>
                ) : (
                  u.title
                )}
              </div>
              {u.constructName && (
                <div className="castor-usage__construct">
                  {t.picker.inConstruct(u.constructName)}
                </div>
              )}
              <div className="castor-usage__meta">
                {[
                  u.journal,
                  u.year,
                  u.pmid ? `PMID ${u.pmid}` : null,
                  u.doi ? `doi:${u.doi}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function summarise(part: Part): string {
  const a = part.attributes
  switch (a.role) {
    case 'promoter':
      return [`Pol ${a.polymerase}`, a.strength, a.tissue?.join(', '), a.minimal ? 'minimal' : null]
        .filter(Boolean)
        .join(' · ')
    case 'itr':
      return `${a.serotype} · ${a.form} nt · ${a.orientation}${a.deltaTRS ? ' · ΔTRS' : ''}`
    case 'cds':
      return a.product
    case 'joiner':
      return `${a.mechanism}${a.peptide ? ` · ${a.peptide}` : ''}`
    case 'wpre':
      return `${a.variant}${a.xProteinOrf ? ' · carries X-protein ORF' : ''}`
    case 'polya':
      return a.source
    case 'tag':
      return `${a.terminus === 'either' ? 'N or C' : a.terminus} terminus`
    case 'switch':
      return `${a.system} · ${a.site}`
    default:
      return part.role
  }
}

function PartDetail({
  part,
  sequencePreview,
  renderProvenance,
}: {
  part: Part
  sequencePreview: 'full' | 'ends' | 'none'
  renderProvenance?: (usages: Usage[], part: Part) => React.ReactNode
}) {
  const t = useMessages()
  const usages = part.provenance.usages ?? []
  const seq =
    sequencePreview === 'none'
      ? null
      : sequencePreview === 'full' || part.length <= 180
        ? formatSequenceBlock(part.sequence)
        : `${formatSequenceBlock(part.sequence.slice(0, 60))}\n     …  ${
            part.length - 120
          } bp not shown\n${formatSequenceBlock(part.sequence.slice(-60), 60, 10, part.length - 59)}`

  return (
    <div>
      <h3 style={{ margin: '0 0 2px', fontSize: 15 }}>{part.name}</h3>
      <p className="castor-hint" style={{ marginBottom: 12 }}>
        {part.description}
      </p>

      <dl className="castor-deflist">
        <dt>{t.common.length}</dt>
        <dd className="castor-num">{bp(part.length)}</dd>
        <dt>{t.common.role}</dt>
        <dd>{part.role}</dd>
        <dt>{t.common.confidence}</dt>
        <dd>{part.provenance.confidence}</dd>
        <dt>{t.common.licence}</dt>
        <dd>{part.license.spdx}</dd>
        {part.provenance.accessions?.map((a) => (
          <Fragment key={`${a.db}:${a.id}`}>
            <dt>{a.db}</dt>
            <dd>
              {a.url ? (
                <a href={a.url} target="_blank" rel="noreferrer noopener">
                  {a.id}
                </a>
              ) : (
                a.id
              )}
            </dd>
          </Fragment>
        ))}
        {part.provenance.addgene && (
          <>
            <dt>Addgene</dt>
            <dd>
              <a
                href={
                  part.provenance.addgene.url ??
                  `https://www.addgene.org/${part.provenance.addgene.plasmidId}/`
                }
                target="_blank"
                rel="noreferrer noopener"
              >
                #{part.provenance.addgene.plasmidId}
              </a>
            </dd>
          </>
        )}
      </dl>

      {seq && (
        <>
          <h4 className="castor-panel__title" style={{ marginBottom: 6 }}>
            {t.common.sequence}
          </h4>
          <pre className="castor-seq">{seq}</pre>
        </>
      )}

      <h4 className="castor-panel__title" style={{ margin: '16px 0 6px' }}>
        {t.picker.whereUsed}
      </h4>
      {renderProvenance ? (
        renderProvenance(usages, part)
      ) : usages.length === 0 ? (
        <p className="castor-hint">{part.provenance.note ?? t.picker.noUsage}</p>
      ) : (
        <UsageList usages={usages} />
      )}

      {part.provenance.note && usages.length > 0 && (
        <p className="castor-hint" style={{ marginTop: 10 }}>
          {part.provenance.note}
        </p>
      )}
    </div>
  )
}
