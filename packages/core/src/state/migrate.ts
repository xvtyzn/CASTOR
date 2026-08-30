import { CONSTRUCT_SCHEMA_VERSION, type Construct } from '../model/construct.js'

/**
 * Validate and detach a persisted construct before it enters application state.
 *
 * There are no legacy shapes yet. Keeping the version switch at the persistence boundary means
 * the first real migration can be added without asking every host application to invent one.
 */
export function migrateConstruct(input: unknown): Construct {
  if (!input || typeof input !== 'object') {
    throw new TypeError('CASTOR: persisted construct must be an object')
  }
  const value = input as Record<string, unknown>
  if (value.schemaVersion !== CONSTRUCT_SCHEMA_VERSION) {
    throw new Error(`CASTOR: unsupported construct schema version '${String(value.schemaVersion)}'`)
  }
  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.templateId !== 'string' ||
    typeof value.backboneId !== 'string' ||
    !value.cassette ||
    typeof value.cassette !== 'object' ||
    !Array.isArray((value.cassette as Record<string, unknown>).parts)
  ) {
    throw new TypeError('CASTOR: persisted construct does not match schema version 1')
  }
  return structuredClone(input) as Construct
}
