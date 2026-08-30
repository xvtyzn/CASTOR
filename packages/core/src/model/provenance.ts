/**
 * Where a part came from, and — the thing this whole tool exists to surface — what it has
 * been used in.
 */

/** One place this part was used. The picker renders a list of these under each candidate. */
export interface Usage {
  kind: 'publication' | 'project' | 'repository'
  title: string
  /** Publication identity. */
  pmid?: string
  pmcid?: string
  doi?: string
  year?: number
  journal?: string
  authorsShort?: string
  /** In-house project identity, supplied by the consuming application via a PartProvider. */
  projectId?: string
  owner?: string
  team?: string
  /**
   * The construct the part was used IN. In practice this is the most useful field on the
   * whole record — "hSyn1, as in pAAV-hSyn-hChR2(H134R)-EYFP" tells a bench scientist more
   * than the paper title does.
   */
  constructName?: string
  url?: string
  note?: string
}

export interface Accession {
  db: 'GenBank' | 'ENA' | 'RefSeq' | 'UniProt' | 'FPbase' | 'iGEM' | 'SynBioHub'
  id: string
  url?: string
}

export interface AddgeneRef {
  plasmidId: number
  url?: string
  /** Addgene's own name for the plasmid, kept verbatim. */
  name?: string
}

export interface Provenance {
  origin: 'curated' | 'user' | 'imported' | 'derived'
  /**
   * How much to trust the sequence and the annotations. Surfaced in the picker, because a
   * user who acts on a low-confidence part deserves to know before, not after.
   */
  confidence: 'high' | 'medium' | 'low'
  curatedBy?: string
  /** ISO date. */
  curatedAt?: string
  accessions?: Accession[]
  /**
   * Addgene is a CURATION-TIME source only: www.addgene.org sends no CORS header and its
   * API is token-gated behind a per-scope data licence, so nothing here is fetched at
   * runtime. These fields are baked into the shipped JSON and rendered as outbound links.
   */
  addgene?: AddgeneRef
  usages?: Usage[]
  note?: string
}

export interface LicenseInfo {
  /** SPDX identifier, or 'NOASSERTION'. */
  spdx: string
  /**
   * Whether this record may ship inside the published catalogue. CI fails the build if a
   * part with `false` reaches the shipped set.
   */
  redistributable: boolean
  source?: string
  note?: string
}

export interface Citation {
  title: string
  pmid?: string
  doi?: string
  url?: string
  year?: number
}
