# CASTOR

**C**assette **A**ssembly with **S**ynteny **T**racks and **O**rigin **R**ecords.

Embeddable React components for designing AAV transfer plasmids and comparing the designs
side by side. Named for the star that looks single to the eye and resolves into three pairs,
which is what the comparison view does to a stack of designs.

Two things, in one library:

1. **A cassette designer.** Pick a backbone, fill the ITR-to-ITR slots, and see the cargo
   budget move as you do. Clicking a slot — in the list, or on the plasmid map itself — opens a
   picker that shows each candidate's sequence and, the part that usually settles the choice,
   which constructs and papers it has been used in.
2. **A gggenomes-style comparison.** Every design you save becomes a row. Ribbons join parts
   that are the same catalogue entry, so the gaps between rows are exactly the differences.
   Align the rows on a part and zoom in, and the tracks resolve into the actual bases — the
   same position in every design, stacked, so a single-base difference is visible without
   leaving the figure.

Runs entirely in the browser. No backend, no network calls at runtime.

```bash
pnpm add @castor-bio/react @castor-bio/catalog
```

```tsx
// The whole application, tabs and all:
import { CastorWorkbench } from '@castor-bio/mui'
// …or just the designer, with no MUI:
import { CastorDesigner } from '@castor-bio/react'
import { loadCatalog } from '@castor-bio/catalog'
import '@castor-bio/react/styles.css'

const catalog = await loadCatalog()

<CastorDesigner
  parts={catalog.parts}
  backbones={catalog.backbones}
  templates={catalog.templates}
/>
```

## Packages

| Package | What it is | Imposes |
|---|---|---|
| `@castor-bio/core` | Domain model, sequence assembly, packaging capacity, validation rules, comparison layout. | nothing — no React, no DOM |
| `@castor-bio/catalog` | Curated parts, backbones and cassette templates as static JSON, per-role subpath exports. | nothing |
| `@castor-bio/react` | The components, plus one prefixed stylesheet. | `react`, `react-dom` |
| `@castor-bio/mui` | The batteries-included tabbed workbench: Overview, Design, Compare, Registry, Reference. **Optional.** | `@mui/material`, `@emotion/*` |

**MUI is deliberately not a dependency of the library.** MUI 9 requires `@emotion/react` and
`@emotion/styled` as peers, and forcing that on a host running Tailwind, or a different MUI
major, would break the one constraint the whole thing is built around: an embedded widget must
not fight its host's styles. So the shell is a separate package that composes the primitives and
adds nothing to them. The test for whether that boundary is holding is simple — if anything in
`core` or `react` ever needs to know a tab exists, it has failed.

## Three ways to use it

**Uncontrolled** — `<CastorDesigner>` owns its state. The common case.

**Composed** — import `BackboneSelector`, `CassetteRuler`, `SlotList`, `PartPicker`,
`PlasmidMap`, `ValidationPanel`, `CartPanel` and `ComparisonView` and lay them out yourself.

**Language** — every user-visible string in `@castor-bio/react` comes from a typed dictionary
with English defaults. Pass `messages="ja"` for the bundled Japanese, or a
`Partial<CastorMessages>` merged over English, or wire it to whatever i18n your app already
runs. It is a plain object, not a framework: a component library that ships react-i18next
imposes its choice, its provider and its bundle on every host.

Two conventions in the Japanese: terms that appear on the sequence itself (ITR, polyA, WPRE,
Kozak, pGOI) stay in Latin script because that is how they are written in a Japanese lab
notebook, and units stay `bp`. Your *data* is not translated — see the Reference tab for how to
carry `{ en, ja }` labels if you need that.

**Headless** — `useCastorDesigner()` returns `{ state, dispatch, analysis, comparison }` and
renders nothing. If your app already has a store, import `designerReducer` from
`@castor-bio/core` and drive the whole designer from it; the library imposes no provider and
creates no global.

## Showing your own parts

The picker renders one tab per `PartProvider`. Supplying your lab's registry is about twenty
lines:

```ts
import type { PartProvider } from '@castor-bio/core'

const labRegistry: PartProvider = {
  id: 'lab',
  label: 'Our lab',
  capabilities: { byRole: true, freeText: true, paste: false, paging: false },
  async search({ roles, text }) {
    const parts = await fetch(`/api/parts?role=${roles?.join(',')}&q=${text ?? ''}`).then(r => r.json())
    return { parts }
  },
  async get(id) {
    return fetch(`/api/parts/${encodeURIComponent(id)}`).then(r => r.json())
  },
}

<CastorDesigner … providers={[labRegistry]} />
```

Put your project history in each part's `provenance.usages` with `kind: 'project'`. The picker
groups those by project, so a part used in eight constructs across three projects reads as three
projects rather than eight unrelated rows, and each candidate carries a one-line badge saying
whether it is the group's standard choice (`3 projects · 4 constructs`) or somebody's one-off
(`only GT-2024-02 · 2 constructs`).

### A worked example

`apps/playground/src/registry/` is a complete, runnable version of this: a fictional archive of
eighteen pGOIs across six projects, the derivation that turns them into per-part usage records,
and a provider that offers the most-established candidates first. It is the shape a real
integration takes — swap the arrays for your API and nothing else changes.

Two things it is careful about, and yours should be too:

- **Curated provenance is kept, not replaced.** EGFP shows both the GenBank accession its
  sequence came from and which of your experiments used it. Neither half answers "should I use
  this one" alone.
- **Example sequences are unmistakably example sequences.** The lab-specific parts carry real
  published *lengths* — so the capacity meter, the ruler and the comparison behave the way the
  real thing would — but generated bases, marked `origin: 'user'`, `confidence: 'low'`,
  `redistributable: false`, and a note saying not to order from them. A scientist who cannot
  tell verified data from placeholder has to treat all of it as unverified.

## Design decisions worth knowing

**The map is an editing surface, not just a picture.** Clicking a part on the plasmid map
opens the actions for it — replace, insert before, insert after, reverse complement, remove —
and clicking between two parts offers what could go in that gap. "Could" is the template's
cardinality plus the canonical order, so a click between the Kozak and the CDS offers an
N-terminal tag and an N-terminal linker, not all twelve slots. `insertionSiteAt()` in
`@castor-bio/core` computes that, and it is advice rather than enforcement: the resulting
`addPart` carries an explicit index, so you can put a part somewhere the template never would
and get a finding about it instead of a refusal.

seqviz is still read-only. It reports a click and what kind of thing was under it; deciding
what that means needs the template, so the viewer adapter reports the click and the designer
resolves it.

**Two scopes, one stylesheet.** `.castor-scope` carries the design tokens; `.castor-root` is
that plus the built-in stacked layout. A host arranging the components itself applies the former
and keeps its own layout — they were one class at first, and an application shell that skipped
the layout silently got no custom properties and unstyled buttons.

**Order is data.** `Construct.cassette.parts` is a flat ordered array and its order is the
truth. The template supplies each slot's `roles`, `min` and `max` and decides where a newly
picked part lands; it never regenerates the array. Validation reports on unusual arrangements
and never blocks them.

That is what makes reordering real rather than cosmetic. The composition list renders parts in
array order — not grouped by template slot, which would silently undo every drag — and each
unlocked part carries a handle that works with the pointer and with the keyboard (focus it,
space to lift, arrows to move, space to drop). Move the CDS past the polyA and you get two
findings explaining what that costs, and the design you asked for. The ITRs are the packaging
boundary rather than part of the design, so they are the one thing a drag cannot move.

The saved-designs list is reorderable for the same reason and with more consequence: the
comparison links **neighbouring rows only**, so the order of that list decides which pairs get
ribbons.

**Varying components in kind and number** has two mechanisms, because it means two different things:
`SlotSpec.max = null` for more of one thing (three N-terminal tags), and `RepeatGroup` for
another whole cistron (a 2A-joined second CDS).

**The cassette editor and the capacity meter are one object.** A cassette is a length budget,
so the parts are drawn to scale on a bp ruler that runs to the packaging limit rather than to
the cassette's own length. A 1179 bp EF1α is visibly five times a 221 bp polyA, and the
remaining headroom is empty space rather than a percentage.

**Homology comes from part identity, not alignment.** Constructs are assembled from a known
registry, so two items are linked because they are the same catalogue entry. No aligner, no
threshold to tune, no false homology. Sequence-level linking is available later through an
injectable `identityOf` hook.

**Zoom has two tiers, and they never share a place on the page.** Fitted, each part's name
sits under its arrow. Zoomed past about seven pixels per base, the sequence takes that space
and the names move above it. Bases are drawn one `<text>` per base at the centre of the span
it occupies — a single stretched `<text>` per row would be far cheaper, but SVG's `textLength`
distributes slack between glyphs rather than placing each one on its own base, and "which base
is under this boundary" has to be exactly right. The viewport cull keeps the count small; past
a glyph budget the view draws none and says so, because half a figure's sequence is worse than
none.

A flipped row shows the reverse complement, since that is the strand actually drawn. Reading
the same position across rows requires anchoring on a part first — the toolbar says so while
the sequence is visible.

**Colour encodes biology, and only biology.** The chrome is entirely achromatic; every
saturated pixel on screen is data. The data palette is Okabe–Ito, which stays distinguishable
under all common forms of colour vision deficiency.

**Coordinates are 0-based and half-open** everywhere inside `core`, so concatenation is
addition. Every crossing into a foreign convention goes through an adapter in
`packages/core/src/seq/coords.ts`, and `coords.fixture.test.ts` measures those conventions
against the real dependencies rather than assuming them.

## Development

```bash
pnpm install
pnpm dev            # playground at http://localhost:5178
pnpm test
pnpm typecheck
pnpm build          # runs publint + attw
```

The catalogue is not hand-written. `tools/curate/` fetches real records from NCBI
E-utilities and extracts each part by accession and coordinates; the build asserts the
extracted length and terminal bases against the recipe and fails rather than shipping a
sequence it cannot verify.

```bash
node --experimental-strip-types tools/curate/src/build.ts
node --experimental-strip-types tools/curate/src/build-backbones.ts
pnpm --filter @castor-bio/catalog validate
```

## Scope

Ships today: single-transgene ss-AAV cassettes (`coding.simple`). The data model, the rule
engine and the comparison view are written against the full space — multicistronic 2A/IRES,
Cre-dependent DIO/FLEX, shRNA, CRISPR, self-complementary and dual-AAV — and those templates
are the next increment, not a rewrite.

Not a sequence editor. `@teselagen/ove` exists for that and would be a lazily loaded optional
mode, never the primary surface.

**This is a design aid, not a substitute for verifying the finished sequence.** Packaging
thresholds are published estimates that vary with capsid, cell line and prep. Not for clinical
use.
