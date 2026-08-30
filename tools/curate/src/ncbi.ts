/**
 * NCBI E-utilities client for the AUTHORING-TIME curation pipeline.
 *
 * Nothing in the shipped library calls this. The published package is strictly offline: the
 * catalogue JSON is the whole data source. Fetching happens here, a human reviews the diff,
 * and the reviewed JSON is what ships.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const CACHE_DIR = new URL('../cache/', import.meta.url).pathname
const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

/** NCBI asks for <=3 requests/second without an API key. */
const MIN_INTERVAL_MS = 400
let lastRequest = 0

async function throttle(): Promise<void> {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequest)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastRequest = Date.now()
}

/** Fetches a GenBank flat file, caching it on disk so re-runs are free and reproducible. */
export async function fetchGenBank(accession: string): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true })
  const cached = join(CACHE_DIR, `${accession}.gb`)
  if (existsSync(cached)) return readFileSync(cached, 'utf8')

  await throttle()
  const url = `${EUTILS}/efetch.fcgi?db=nuccore&id=${encodeURIComponent(accession)}&rettype=gbwithparts&retmode=text`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`NCBI ${accession}: HTTP ${res.status}`)
  const text = await res.text()
  if (!text.startsWith('LOCUS')) {
    throw new Error(`NCBI ${accession}: not a GenBank record (got ${text.slice(0, 80)})`)
  }
  writeFileSync(cached, text)
  return text
}

export interface GenBankFeature {
  type: string
  /** OUR convention: 0-based, half-open. */
  start: number
  end: number
  strand: 1 | -1
  qualifiers: Record<string, string>
}

export interface GenBankRecord {
  accession: string
  definition: string
  sequence: string
  features: GenBankFeature[]
  /** PMIDs from the REFERENCE blocks — the accession -> publication join. */
  pubmedIds: string[]
}

/**
 * A deliberately small GenBank parser. `@teselagen/bio-parsers` is the right choice for the
 * shipped `io` package, but the curation pipeline needs feature coordinates and PMIDs only,
 * and keeping this dependency-free means the tool cannot drift from the library it feeds.
 */
export function parseGenBank(text: string): GenBankRecord {
  const definition =
    /^DEFINITION\s+([\s\S]*?)\n(?=[A-Z])/m.exec(text)?.[1]?.replace(/\s+/g, ' ').trim() ?? ''
  const accession = /^ACCESSION\s+(\S+)/m.exec(text)?.[1] ?? ''

  const originIdx = text.indexOf('\nORIGIN')
  // Start AFTER the ORIGIN line itself. Slicing from the marker and dropping one array
  // element leaves the literal word "ORIGIN" at the head of the sequence, which shifts every
  // downstream coordinate by six bases -- silently, because the lengths still look right.
  const seqBlock = originIdx === -1 ? '' : text.slice(originIdx + 1)
  const sequence = seqBlock
    .split('\n')
    .slice(1)
    .map((l) => l.replace(/[\d\s]/g, ''))
    .join('')
    .replace(/\/\//g, '')
    .toUpperCase()

  // The LOCUS line states the record length. Cross-checking it against what we parsed is the
  // cheapest possible guard against exactly the class of bug described above, and it is why
  // this check exists rather than trusting the parser.
  const declaredLength = Number(/^LOCUS\s+\S+\s+(\d+)\s+bp/m.exec(text)?.[1] ?? '0')
  if (declaredLength > 0 && sequence.length !== declaredLength) {
    throw new Error(
      `GenBank parse error: LOCUS declares ${declaredLength} bp but ${sequence.length} bp were ` +
        `parsed. Refusing to return a record whose coordinates cannot be trusted.`,
    )
  }

  const pubmedIds = [...text.matchAll(/^\s*PUBMED\s+(\d+)/gm)].map((m) => m[1]!)

  const featuresStart = text.indexOf('\nFEATURES')
  const featureText =
    featuresStart === -1 ? '' : text.slice(featuresStart, originIdx === -1 ? undefined : originIdx)

  const features: GenBankFeature[] = []
  // Feature keys start at column 5; qualifiers at column 21.
  const lines = featureText.split('\n').slice(1)
  let current: { type: string; location: string; quals: string[] } | null = null

  const flush = () => {
    if (!current) return
    const loc = current.location
    const complement = /complement\(/.test(loc)
    const m = /(\d+)\.\.[><]?(\d+)/.exec(loc) ?? /^[><]?(\d+)$/.exec(loc)
    if (m) {
      const s1 = Number(m[1])
      const e1 = m[2] === undefined ? s1 : Number(m[2])
      const qualifiers: Record<string, string> = {}
      for (const q of current.quals) {
        const qm = /^\/([^=]+)=?"?([\s\S]*?)"?$/.exec(q)
        if (qm) qualifiers[qm[1]!] = qm[2]!.replace(/\s+/g, ' ').trim()
      }
      features.push({
        type: current.type,
        start: s1 - 1, // GenBank is 1-based inclusive; ours is 0-based half-open
        end: e1,
        strand: complement ? -1 : 1,
        qualifiers,
      })
    }
    current = null
  }

  for (const line of lines) {
    if (/^ {5}\S/.test(line)) {
      flush()
      const m = /^ {5}(\S+)\s+(.*)$/.exec(line)
      if (m) current = { type: m[1]!, location: m[2]!, quals: [] }
    } else if (/^ {21}\//.test(line) && current) {
      current.quals.push(line.trim())
    } else if (/^ {21}/.test(line) && current) {
      if (current.quals.length > 0) current.quals[current.quals.length - 1] += ' ' + line.trim()
      else current.location += line.trim()
    }
  }
  flush()

  return { accession, definition, sequence, features, pubmedIds }
}

export async function loadRecord(accession: string): Promise<GenBankRecord> {
  return parseGenBank(await fetchGenBank(accession))
}
