import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createConstruct,
  createCountingIdFactory,
  templateId,
  type CassetteTemplate,
} from '@castor-bio/core'
import { loadCatalog } from '@castor-bio/catalog'
import { useCastorDesigner } from './useCastorDesigner.js'

const catalog = await loadCatalog()
const firstTemplate = catalog.templates[0]!
const secondTemplate: CassetteTemplate = {
  ...firstTemplate,
  id: templateId('template/coding.second@1.0.0'),
  name: 'Second template',
}

afterEach(cleanup)

describe('useCastorDesigner', () => {
  it('resolves the template named by the initial construct instead of assuming index zero', () => {
    const initialConstruct = createConstruct(secondTemplate, catalog.backbones[0]!, {
      idFactory: createCountingIdFactory(),
      now: '2026-08-30T00:00:00.000Z',
    })
    const { result } = renderHook(() =>
      useCastorDesigner({
        parts: catalog.parts,
        backbones: catalog.backbones,
        templates: [firstTemplate, secondTemplate],
        initialConstruct,
      }),
    )

    expect(result.current.template.id).toBe(secondTemplate.id)
    expect(result.current.analysis.assembly.cassette.length).toBeGreaterThan(0)
  })

  it('fails with a useful message when required catalogue collections are empty', () => {
    expect(() =>
      renderHook(() =>
        useCastorDesigner({ parts: catalog.parts, backbones: [], templates: [firstTemplate] }),
      ),
    ).toThrow('at least one backbone is required')
  })
})
