/** `node --experimental-strip-types src/inspect.ts <accession> [featureFilter]` */
import { loadRecord } from './ncbi.ts'

const [accession, filter] = process.argv.slice(2)
if (!accession) {
  console.error('usage: inspect.ts <accession> [substring filter on type/label]')
  process.exit(1)
}

const rec = await loadRecord(accession)
console.log(`# ${rec.accession}  ${rec.definition}`)
console.log(`# length ${rec.sequence.length} bp, PMIDs: ${rec.pubmedIds.join(', ') || '(none)'}`)
console.log('')
for (const f of rec.features) {
  const label =
    f.qualifiers.label ??
    f.qualifiers.gene ??
    f.qualifiers.product ??
    f.qualifiers.note ??
    f.qualifiers.regulatory_class ??
    f.qualifiers.standard_name ??
    ''
  const line = `${f.type.padEnd(16)} ${String(f.start).padStart(6)}..${String(f.end).padEnd(6)} ${
    f.strand === -1 ? '-' : '+'
  } len=${String(f.end - f.start).padStart(5)}  ${label}`
  if (!filter || line.toLowerCase().includes(filter.toLowerCase())) console.log(line)
}
