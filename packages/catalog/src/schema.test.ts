import Ajv from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import partSchema from '../schema/part.schema.json'
import templateSchema from '../schema/template.schema.json'
import backboneSchema from '../schema/backbone.schema.json'
import promoterFile from '../data/parts/promoter.json'
import templatesFile from '../data/templates.json'
import backbonesFile from '../data/backbones.json'

const ajv = new Ajv({ strict: true, strictRequired: false })
const validateParts = ajv.compile(partSchema)
const validateTemplates = ajv.compile(templateSchema)
const validateBackbones = ajv.compile(backboneSchema)

describe('catalogue JSON Schemas', () => {
  it('accepts every current top-level data shape', () => {
    expect(validateParts(promoterFile)).toBe(true)
    expect(validateTemplates(templatesFile)).toBe(true)
    expect(validateBackbones(backbonesFile)).toBe(true)
  })

  it('rejects a promoter without its required polymerase', () => {
    const invalid = structuredClone(promoterFile) as unknown as {
      parts: { attributes: { polymerase?: string } }[]
    }
    delete invalid.parts[0]!.attributes.polymerase
    expect(validateParts(invalid)).toBe(false)
  })

  it('rejects malformed template slots and out-of-bounds backbone features', () => {
    const template = structuredClone(templatesFile) as unknown as {
      templates: { nodes: { roles?: string[] }[] }[]
    }
    delete template.templates[0]!.nodes[0]!.roles
    expect(validateTemplates(template)).toBe(false)

    const backbone = structuredClone(backbonesFile) as unknown as {
      backbones: { features: { start: number }[] }[]
    }
    backbone.backbones[0]!.features[0]!.start = -1
    expect(validateBackbones(backbone)).toBe(false)
  })
})
