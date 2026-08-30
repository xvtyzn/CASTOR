# Catalogue licensing

Every shipped part carries `license.spdx` and `license.redistributable`. CI fails the build if
a part with `redistributable: false` reaches the shipped set.

## Where the sequences come from

All extracted sequences are slices of public GenBank records, identified by accession and
coordinates in `tools/curate/src/recipes.ts` and re-derived by the build. Short literals
(Kozak, loxP, epitope tags, 2A peptides) are written out directly, each with a stated
rationale — they are either a single published consensus or a back-translation from a
canonical peptide with a documented codon choice.

## Sources deliberately NOT used

**pLannotate** (GPL-3.0-or-later) has the best open catalogue of common plasmid feature names.
It is used as a naming cross-reference only. Its database is not copied and the tool is not
bundled; the GPL would otherwise reach the whole library.

**VectorBuilder** and **SnapGene** catalogues are proprietary. They are useful references when
deciding what a curated catalogue should contain, and nothing from them is redistributed.

**Addgene** is a curation-time source only. `www.addgene.org` sends no CORS header and the
developer API is token-gated behind a per-scope data licence, so the shipped library never
calls it. Addgene plasmid ids and the PMIDs they link to are baked into the JSON at curation
time and rendered as outbound links.

## Browser-callable sources, if runtime enrichment is ever added

Verified to send permissive CORS headers: NCBI E-utilities, EBI/ENA, UniProt, FPbase,
SynBioHub, `registry.igem.org`, and Europe PMC. Anything added later should come from that
list.

## SBOL Visual glyphs

Taken from the `SynBioDex/SBOL-visual` GitHub repository, where the glyphs are released under
CC0 — not from sbolstandard.org, whose site content is CC BY-NC-ND. Note that the standard
glyph set has no ITR and no WPRE glyph, and that `insulator` is deprecated; any glyphs for
those are original work on the same 0.5 inch canvas convention.
