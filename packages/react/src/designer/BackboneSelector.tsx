import type { Backbone, BackboneId, TemplateId } from '@castor-bio/core'
import { bp } from '../format.js'
import { useMessages } from '../i18n.js'

export interface BackboneSelectorProps {
  backbones: Backbone[]
  value: BackboneId | null
  onChange: (id: BackboneId) => void
  templateId?: TemplateId
  className?: string
}

export function BackboneSelector({
  backbones,
  value,
  onChange,
  templateId,
  className,
}: BackboneSelectorProps) {
  const t = useMessages()
  const options = templateId
    ? backbones.filter(
        (b) => !b.compatibleTemplates || b.compatibleTemplates.includes(templateId),
      )
    : backbones
  const selected = options.find((b) => b.id === value)

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="castor-slot__label">{t.backbone.label}</span>
        <select
          className="castor-select"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value as BackboneId)}
          style={{ flex: 1 }}
        >
          {options.map((b) => (
            <option key={String(b.id)} value={String(b.id)}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <p className="castor-hint">
          <span className="castor-num">{t.backbone.outsideItrs(bp(selected.length))}</span>
          {selected.selectionMarker ? ` · ${selected.selectionMarker}` : ''}
          {selected.origin ? ` · ${selected.origin}` : ''}. {t.backbone.notPackaged}
        </p>
      )}
    </div>
  )
}
