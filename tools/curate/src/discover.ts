/**
 * Find GenBank records that actually annotate the parts we still need.
 *
 * Hand-browsing NCBI for well-annotated vectors is the slow half of curation: most synthetic
 * construct records annotate one CDS and nothing else. This searches, fetches, and scores each
 * record by how many of the wanted features it labels, so the shortlist is mechanical.
 *
 *   node --experimental-strip-types tools/curate/src/discover.ts "<esearch term>" [maxRecords]
 */
import { loadRecord } from './ncbi.ts'

/** What we are still missing, as case-insensitive label patterns. */
const WANTED: Record<string, RegExp> = {
  mCherry: /mcherry/i,
  tdTomato: /tdtomato/i,
  Cre: /\bcre\b/i,
  SpCas9: /spcas9|streptococcus pyogenes cas9|\bcas9\b/i,
  SaCas9: /sacas9|staphylococcus aureus cas9/i,
  hSyn: /synapsin|hsyn|\bsyn1\b/i,
  CMVprom: /\bcmv\b.*promoter|promoter.*\bcmv\b/i,
  CBh: /\bcbh\b/i,
  CAG: /\bcag\b|cbа|chicken beta-actin/i,
  bGHpA: /\bbgh\b|bovine growth hormone/i,
  SV40pA: /sv40.*(polya|poly\(a\)|polyadenyl)/i,
  WPRE3: /\bwpre3\b|\bw3\b/i,
  WPRE: /\bwpre\b/i,
  intron: /intron/i,
  U6: /\bu6\b/i,
  loxP: /loxp/i,
  FLAG: /flag/i,
  NLS: /\bnls\b|nuclear localization/i,
  stuffer: /stuffer/i,
}

const term = process.argv[2]
const max = Number(process.argv[3] ?? 12)
if (!term) {
  console.error('usage: discover.ts "<esearch term>" [maxRecords]')
  process.exit(1)
}

const url =
  `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=nuccore&retmode=json` +
  `&retmax=${max}&term=${encodeURIComponent(term)}`
const ids: string[] = (await (await fetch(url)).json()).esearchresult?.idlist ?? []
console.error(`${ids.length} hit(s) for ${JSON.stringify(term)}`)

for (const id of ids) {
  let rec
  try {
    rec = await loadRecord(id)
  } catch (err) {
    console.error(`  ${id}: ${(err as Error).message}`)
    continue
  }
  const labels = rec.features.map((f) =>
    [f.type, ...Object.values(f.qualifiers)].join(' '),
  )
  const found = Object.entries(WANTED)
    .filter(([, re]) => labels.some((l) => re.test(l)))
    .map(([name]) => name)

  if (found.length === 0) continue
  console.log(
    `${rec.accession.padEnd(12)} ${String(rec.sequence.length).padStart(6)} bp  ` +
      `[${found.length}] ${found.join(', ')}`,
  )
  console.log(`             ${rec.definition.slice(0, 96)}`)
}
