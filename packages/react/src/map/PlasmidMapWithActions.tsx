import { useState } from 'react'
import {
  insertionSiteAround,
  resolveCassettePosition,
  type AnalysisResult,
  type CassetteTemplate,
  type Construct,
  type InstanceId,
  type Part,
  type PartId,
  type SlotSpec,
} from '@castor-bio/core'
import { PlasmidMap, type PlasmidMapClick } from './PlasmidMap.js'
import { MapPopover, type MapPopoverTarget } from './MapPopover.js'
import type { PartRequest } from '../designer/SlotList.js'

export interface PlasmidMapWithActionsProps {
  construct: Construct
  template: CassetteTemplate
  analysis: AnalysisResult
  parts: (id: PartId) => Part | undefined
  space?: 'plasmid' | 'cassette'
  viewer?: 'circular' | 'linear' | 'both' | 'both_flip'
  selectedInstanceId?: InstanceId | null
  onSelectInstance?: (id: InstanceId | null) => void
  onRequestPart: (request: PartRequest) => void
  onRemove: (id: InstanceId) => void
  onSetStrand: (id: InstanceId, strand: 1 | -1) => void
  enzymes?: string[]
  height?: number | string
  className?: string
}

/**
 * The map, plus the actions that hang off a click on it.
 *
 * Kept as one component because the two halves are useless apart: the viewer reports a click
 * and knows nothing about slots, and the popover needs a template to say what could go where.
 * Anything that shows the map and lets you edit wants both, so bundling them stops that wiring
 * being written twice.
 */
export function PlasmidMapWithActions({
  construct,
  template,
  analysis,
  parts,
  space = 'plasmid',
  viewer,
  selectedInstanceId,
  onSelectInstance,
  onRequestPart,
  onRemove,
  onSetStrand,
  enzymes,
  height = 440,
  className,
}: PlasmidMapWithActionsProps) {
  const [popover, setPopover] = useState<{
    target: MapPopoverTarget
    anchor: { x: number; y: number }
  } | null>(null)

  const requestFor = (
    slot: SlotSpec,
    extra: { at?: number; replacingInstanceId?: InstanceId } = {},
  ): PartRequest => ({
    slotKey: slot.key,
    repeatIndex: 0,
    roles: slot.roles,
    label: slot.label,
    ...(slot.hint !== undefined ? { hint: slot.hint } : {}),
    ...extra,
  })

  const handleClick = (click: PlasmidMapClick) => {
    if (click.instanceId) {
      const instance = construct.cassette.parts.find((p) => p.instanceId === click.instanceId)
      if (instance) {
        const node = template.nodes.find(
          (n) => n.kind === 'slot' && String(n.key) === String(instance.slotKey),
        )
        setPopover({
          target: {
            kind: 'instance',
            instance,
            part: parts(instance.partId),
            slot: node?.kind === 'slot' ? node : undefined,
          },
          anchor: click.anchor,
        })
        return
      }
    }
    if (click.position === undefined) {
      setPopover(null)
      return
    }
    const ranges = new Map([...analysis.assembly.index].map(([id, r]) => [id, r[click.space]]))
    const resolved = resolveCassettePosition(construct, template, ranges, click.position)
    setPopover(
      resolved.kind === 'site'
        ? { target: { kind: 'site', site: resolved.site }, anchor: click.anchor }
        : null,
    )
  }

  const selectedLength =
    popover?.target.kind === 'instance'
      ? (() => {
          const r = analysis.assembly.index.get(popover.target.instance.instanceId)?.cassette
          return r ? r.end - r.start : undefined
        })()
      : undefined

  return (
    <div className={className} style={{ position: 'relative' }}>
      <PlasmidMap
        assembly={analysis.assembly}
        space={space}
        viewer={viewer ?? (space === 'plasmid' ? 'circular' : 'linear')}
        name={construct.name}
        {...(selectedInstanceId !== undefined ? { selectedInstanceId } : {})}
        {...(onSelectInstance ? { onSelectInstance } : {})}
        onMapClick={handleClick}
        findings={analysis.validation}
        {...(enzymes ? { enzymes } : {})}
        height={height}
      />
      {popover && (
        <MapPopover
          target={popover.target}
          anchor={popover.anchor}
          {...(selectedLength !== undefined ? { length: selectedLength } : {})}
          onClose={() => setPopover(null)}
          onReplace={(instance, slot) => {
            onRequestPart(requestFor(slot, { replacingInstanceId: instance.instanceId }))
            setPopover(null)
          }}
          onRemove={(instance) => {
            onRemove(instance.instanceId)
            setPopover(null)
          }}
          onFlip={(instance) => {
            onSetStrand(instance.instanceId, instance.strand === 1 ? -1 : 1)
            setPopover(null)
          }}
          onInsert={(slot, index) => {
            onRequestPart(requestFor(slot, { at: index }))
            setPopover(null)
          }}
          onInsertAround={(instance, side) => {
            // Stay in the popover: "insert after the promoter" still has to say after it WHAT.
            const site = insertionSiteAround(construct, template, instance.instanceId, side)
            setPopover({ target: { kind: 'site', site }, anchor: popover.anchor })
          }}
        />
      )}
    </div>
  )
}
