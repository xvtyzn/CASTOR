import { describe, expect, it } from 'vitest'
import { migrateConstruct } from './migrate.js'

const current = {
  id: 'construct-1',
  name: 'Persisted design',
  templateId: 'template/coding.simple@1.0.0',
  backboneId: 'backbone/pUC19-AAV@1.0.0',
  packaging: 'ss',
  genomeSerotype: 'AAV2',
  capsidSerotype: 'AAV9',
  cassette: { parts: [] },
  createdAt: '2026-08-30T00:00:00.000Z',
  updatedAt: '2026-08-30T00:00:00.000Z',
  schemaVersion: 1,
}

describe('migrateConstruct', () => {
  it('accepts and detaches the current persisted shape', () => {
    const migrated = migrateConstruct(current)
    expect(migrated).toEqual(current)
    expect(migrated).not.toBe(current)
    expect(migrated.cassette).not.toBe(current.cassette)
  })

  it('rejects unsupported and malformed persisted data', () => {
    expect(() => migrateConstruct({ ...current, schemaVersion: 0 })).toThrow(
      'unsupported construct schema version',
    )
    expect(() => migrateConstruct({ schemaVersion: 1 })).toThrow('does not match schema version 1')
  })
})
