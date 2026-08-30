import type { Anchor, Finding, QuickFix, Severity, ValidationReport } from '@castor-bio/core'
import { useCastorTheme } from '../theme/useTheme.js'
import { useMessages } from '../i18n.js'

export interface ValidationPanelProps {
  report: ValidationReport
  onFocus?: (anchor: Anchor) => void
  onApplyFix?: (fix: QuickFix) => void
  filter?: Severity[]
  /** Overrides the localised default. */
  emptyMessage?: string
  className?: string
}

/**
 * Findings, worst first.
 *
 * Nothing here blocks anything. The list reports, links to the thing it is about, and — where
 * the fix is mechanical — offers it. A designer that refuses to build an unusual construct is
 * a designer people route around.
 */
export function ValidationPanel({
  report,
  onFocus,
  onApplyFix,
  filter,
  emptyMessage,
  className,
}: ValidationPanelProps) {
  const theme = useCastorTheme()
  const t = useMessages()
  const findings = filter ? report.findings.filter((f) => filter.includes(f.severity)) : report.findings

  const color = (s: Severity) =>
    s === 'error'
      ? theme.capacityBands.error
      : s === 'warning'
        ? theme.capacityBands['near-limit']
        : theme.strokeMuted

  if (findings.length === 0) {
    return <p className={['castor-hint', className].filter(Boolean).join(' ')}>{emptyMessage ?? t.findings.none}</p>
  }

  return (
    <ul className={['castor-findings', className].filter(Boolean).join(' ')}>
      {findings.map((f: Finding) => (
        <li key={f.id}>
          <button
            type="button"
            className="castor-finding"
            onClick={() => f.anchors[0] && onFocus?.(f.anchors[0])}
          >
            <span className="castor-finding__mark" style={{ background: color(f.severity) }} />
            <span>
              <span className="castor-finding__title">{f.title}</span>
              {f.detail && <span className="castor-finding__detail"> — {f.detail}</span>}
              {f.citations?.length ? (
                <span className="castor-finding__cites">
                  {f.citations.map((c, i) => (
                    <span key={i}>
                      {i > 0 && ' · '}
                      {c.url ? (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.title.length > 60 ? `${c.title.slice(0, 58)}…` : c.title}
                        </a>
                      ) : (
                        c.title
                      )}
                    </span>
                  ))}
                </span>
              ) : null}
              {f.fixes?.length ? (
                <span style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                  {f.fixes.map((fix) => (
                    <button
                      key={fix.id}
                      type="button"
                      className="castor-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        onApplyFix?.(fix)
                      }}
                    >
                      {fix.label}
                    </button>
                  ))}
                </span>
              ) : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
