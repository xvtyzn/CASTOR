import type { LocaleCode } from '@castor-bio/react'

export interface RefSection {
  id: string
  title: string
  /** Paragraphs. */
  body: string[]
  code?: { lang: string; source: string }
  /** Field-by-field table. */
  fields?: { name: string; type: string; required: boolean; note: string }[]
}

const PART_SHAPE = `interface Part {
  id: string          // 'promoter/hSyn1@1.0.0' — role/name@semver, stable forever
  name: string
  aliases?: string[]
  role: PartRole      // promoter | cds | itr | polya | wpre | tag | linker | …
  sequence: string    // uppercase ACGT + IUPAC. '' only if lazily loaded
  length: number      // authoritative even when sequence is empty
  checksum: string    // 'sha1:<hex>' of the uppercased sequence
  attributes: PartAttributes   // discriminated on role — see below
  provenance: Provenance       // where it came from AND where it has been used
  license: { spdx: string; redistributable: boolean }
  version: string
  variantOf?: string  // 'wpre/WPRE@1.0.0' — makes WPRE3 a shaded ribbon, not an absent one
  deprecated?: boolean
  replacedBy?: string
}`

const PROVENANCE_SHAPE = `interface Provenance {
  origin: 'curated' | 'user' | 'imported' | 'derived'
  confidence: 'high' | 'medium' | 'low'
  curatedBy?: string
  curatedAt?: string                    // ISO date
  accessions?: { db: 'GenBank' | 'ENA' | 'UniProt' | …; id: string; url?: string }[]
  addgene?: { plasmidId: number; url?: string }
  usages?: Usage[]                      // ← the field this tool is built around
  note?: string
}

interface Usage {
  kind: 'publication' | 'project' | 'repository'
  title: string
  constructName?: string    // WHAT it was used in. The most useful field on the record.

  // kind: 'project'
  projectId?: string
  team?: string
  owner?: string
  year?: number

  // kind: 'publication'
  pmid?: string
  doi?: string
  journal?: string

  url?: string
  note?: string
}`

const PROVIDER_SHAPE = `interface PartProvider {
  id: string
  label: string                          // the picker renders one tab per provider
  capabilities: { byRole: boolean; freeText: boolean; paste: boolean; paging: boolean }
  search(query: PartQuery, signal?: AbortSignal): Promise<PartPage>
  get(id: string, signal?: AbortSignal): Promise<Part | undefined>
}

interface PartQuery {
  roles?: PartRole[]     // ALWAYS honour this — it is the slot's contract
  text?: string
  maxLength?: number     // remaining cargo budget, when the caller knows it
  tags?: string[]
  cursor?: string
  limit?: number
}

interface PartPage { parts: Part[]; nextCursor?: string; total?: number; truncated?: boolean }`

const REST_SHAPE = `GET /parts?role=promoter&q=hSyn&limit=50&cursor=…
    → { parts: Part[], nextCursor?: string, total?: number }

GET /parts/{id}
    → Part

# Optional, and worth having: derive usages server-side rather than
# making every client walk your construct table.
GET /parts/{id}/usages
    → Usage[]

# What the archive looks like on your side. CASTOR never reads this
# directly; it is what you derive usages FROM.
GET /constructs?project=NEU-2024-11
    → { name, projectId, partIds: string[], note? }[]`

export const REFERENCE: Record<
  LocaleCode,
  { title: string; lede: string; sections: RefSection[] }
> = {
  en: {
    title: 'Connecting your own registry',
    lede: 'What CASTOR needs from a parts database, what each field is used for, and the two modelling decisions that matter most.',
    sections: [
      {
        id: 'shape',
        title: '1. A part',
        body: [
          'The unit CASTOR works in. Three fields carry more weight than the rest: `id` must be stable forever, because saved designs reference it; `length` must be right even when `sequence` is lazily loaded, because the capacity meter and the ruler are computed from it; and `checksum` is what lets two entries with different ids be recognised as the same DNA.',
          'Version the id, do not mutate the record. `promoter/hSyn1@1.0.0` and `@1.1.0` are different parts, and a design built on the first keeps meaning what it meant. Editing a sequence in place silently rewrites every design that used it.',
        ],
        code: { lang: 'ts', source: PART_SHAPE },
      },
      {
        id: 'provenance',
        title: '2. Provenance, and the two questions it answers',
        body: [
          'Provenance has to answer two separate questions, and a schema that collapses them is the most common mistake here. **Where did this sequence come from** is about trust: an accession means somebody can check it. **Where has this been used** is about judgement: three projects standardised on it, or one postdoc used it once in 2023.',
          'Keep both. CASTOR renders the first as `Confidence` and an outbound accession link, and the second as the grouped project list in the picker. Neither answers "should I use this one" on its own.',
          '`constructName` is the field that earns its place in practice. "hSyn1, as in pAAV-hSyn-hChR2(H134R)-EYFP" settles a choice at a bench faster than any description.',
        ],
        code: { lang: 'ts', source: PROVENANCE_SHAPE },
      },
      {
        id: 'derive',
        title: '3. Derive usages, do not maintain them',
        body: [
          'Do not store a usage list on the part and expect it to stay true. Store the constructs — which you already have — and derive the part-level view. A construct is a name, a project and an ordered list of part ids; that is the whole input.',
          'Count a part once per construct, however many times it appears in it. A Cre-dependent cassette carries loxP four times; that is one construct, not four, and reporting four makes a routine part look like a house standard.',
        ],
        code: {
          lang: 'ts',
          source: `// one construct, one usage per distinct part
for (const construct of archive) {
  for (const id of new Set(construct.partIds)) {
    usages.get(id).push({
      kind: 'project',
      title: project.name,
      projectId: construct.projectId,
      constructName: construct.name,
      team: project.team,
      year: project.year,
    })
  }
}`,
        },
      },
      {
        id: 'api',
        title: '4. The API surface',
        body: [
          'CASTOR talks to a registry through one interface. Implementing it is roughly twenty lines against whatever you already run; the picker renders one tab per provider and nothing else changes.',
          "`roles` is not a hint. It is the slot's contract, and returning parts outside it puts a polyA in the promoter list.",
          'If your registry is large, honour `limit` and `cursor` and return `truncated`. The picker will say so rather than pretending it showed everything.',
        ],
        code: { lang: 'ts', source: PROVIDER_SHAPE },
      },
      {
        id: 'rest',
        title: '5. A REST shape that maps onto it cleanly',
        body: [
          'Nothing about CASTOR requires REST — the interface is a pair of async functions — but this is the shape that maps onto it without an adapter worth naming.',
          'One caveat learned the hard way: if you plan to call a public database from the browser, check CORS first. Addgene sends no CORS header and its API is token-gated behind a per-scope data licence, so it cannot be called from a page. NCBI E-utilities, EBI/ENA, UniProt, FPbase, SynBioHub, registry.igem.org and Europe PMC all send permissive headers and can be. Anything else belongs behind your own endpoint.',
        ],
        code: { lang: 'http', source: REST_SHAPE },
      },
      {
        id: 'labels',
        title: '6. Localising the data, not just the interface',
        body: [
          'CASTOR\'s own strings are translatable through a dictionary. Your data is not — a part named "hSyn1 (lab prep)" renders as-is in every locale, and so do the slot labels in a cassette template.',
          'If that matters to you, carry a map rather than a string: `name: { en: string; ja?: string }`, falling back to `en`. Do the same for `CassetteTemplate.nodes[].label`. It is a small change to make now and an expensive one to retrofit once designs reference the ids.',
        ],
      },
      {
        id: 'dont',
        title: '7. Four things not to do',
        body: [
          '**Do not put the sequence behind a second round trip you cannot batch.** The designer assembles on every keystroke; a part without its bases cannot be assembled, and a spinner per part is worse than a slower first load.',
          '**Do not let the id encode anything you might change.** Freezer position, owner, project. Those are attributes; the id is a name.',
          '**Do not merge "we have this in the freezer" with "this is a designable part".** Inventory and registry answer different questions and go stale on different schedules.',
          '**Do not ship unverified sequences without saying so.** `confidence` and `origin` exist so a scientist can tell curated data from a placeholder. If everything claims high confidence, all of it has to be treated as unverified.',
        ],
      },
    ],
  },
  ja: {
    title: '自前のレジストリを繋ぐ',
    lede: 'CASTOR がパーツデータベースに求めるもの、各フィールドが何に使われるか、そして最も重要な2つのモデリング判断。',
    sections: [
      {
        id: 'shape',
        title: '1. パーツ',
        body: [
          'CASTOR が扱う単位です。他より重いフィールドが3つあります。`id` は永久に不変であること（保存されたデザインが参照するため）。`length` は `sequence` が遅延ロードでも正しいこと（容量メーターとルーラーがここから計算されるため）。そして `checksum` は、id が違う2件を「同じ DNA」と認識させるためのものです。',
          'レコードを書き換えるのではなく、id をバージョニングしてください。`promoter/hSyn1@1.0.0` と `@1.1.0` は別のパーツで、前者で組んだデザインは意味を保ちます。配列をその場で書き換えると、それを使った全デザインを黙って書き換えることになります。',
        ],
        code: { lang: 'ts', source: PART_SHAPE },
      },
      {
        id: 'provenance',
        title: '2. 由来 — 2つの別々の問いに答える',
        body: [
          '由来は2つの異なる問いに答える必要があり、これを1つに潰すのがここで最もよくある失敗です。**この配列はどこから来たか**は信頼の問題で、アクセッションがあれば誰かが検証できます。**どこで使われてきたか**は判断の問題で、3プロジェクトが標準採用しているのか、2023年にポスドクが一度使っただけなのかです。',
          '両方を保持してください。CASTOR は前者を `Confidence` と外部リンクとして、後者をピッカーのプロジェクト別リストとして描きます。片方だけでは「これを使うべきか」に答えられません。',
          '実務で効くのは `constructName` です。「hSyn1、pAAV-hSyn-hChR2(H134R)-EYFP で使ったあれ」は、どんな説明文よりも早くベンチでの選択を決めます。',
        ],
        code: { lang: 'ts', source: PROVENANCE_SHAPE },
      },
      {
        id: 'derive',
        title: '3. 使用歴は「持つ」のではなく「導出する」',
        body: [
          'パーツに使用歴のリストを持たせて、それが正しいままだと期待しないでください。すでに持っている**構築**の方を保存し、パーツ単位のビューは導出します。構築とは、名前・プロジェクト・パーツ id の順序付きリストであり、入力はそれだけです。',
          '1つの構築に同じパーツが何回現れても、1回として数えてください。Cre 依存カセットは loxP を4回持ちますが、それは1構築であって4ではありません。4と報告すると、ありふれたパーツがハウススタンダードに見えてしまいます。',
        ],
        code: {
          lang: 'ts',
          source: `// 1構築につき、異なるパーツごとに使用歴1件
for (const construct of archive) {
  for (const id of new Set(construct.partIds)) {
    usages.get(id).push({
      kind: 'project',
      title: project.name,
      projectId: construct.projectId,
      constructName: construct.name,
      team: project.team,
      year: project.year,
    })
  }
}`,
        },
      },
      {
        id: 'api',
        title: '4. API の面',
        body: [
          'CASTOR は1つのインターフェース経由でレジストリと話します。既存のシステムに対して実装するのは概ね20行で、ピッカーは provider ごとに1タブを描き、他は何も変わりません。',
          '`roles` はヒントではありません。スロットの契約であり、範囲外のパーツを返すとプロモーターの一覧に polyA が並びます。',
          'レジストリが大きい場合は `limit` と `cursor` を尊重し、`truncated` を返してください。ピッカーは「全部見せた」ふりをせず、その旨を表示します。',
        ],
        code: { lang: 'ts', source: PROVIDER_SHAPE },
      },
      {
        id: 'rest',
        title: '5. きれいに対応する REST の形',
        body: [
          'CASTOR は REST を要求しません（インターフェースは非同期関数2つです）が、名前を付けるほどのアダプタなしで対応できる形はこれです。',
          '苦労して学んだ注意点が1つ。ブラウザから公開データベースを叩く予定なら、まず CORS を確認してください。Addgene は CORS ヘッダを送らず、API はスコープ別のデータ利用ライセンスの背後でトークン制なので、ページから呼べません。NCBI E-utilities、EBI/ENA、UniProt、FPbase、SynBioHub、registry.igem.org、Europe PMC はいずれも許容的なヘッダを送るので呼べます。それ以外は自前のエンドポイントの背後に置いてください。',
        ],
        code: { lang: 'http', source: REST_SHAPE },
      },
      {
        id: 'labels',
        title: '6. UI だけでなくデータも多言語化する',
        body: [
          'CASTOR 自身の文言は辞書で翻訳できますが、あなたのデータはできません。「hSyn1 (lab prep)」という名前はどの言語でもそのまま出ますし、カセットテンプレートのスロットラベルも同じです。',
          'それが問題になるなら、文字列ではなくマップを持ってください。`name: { en: string; ja?: string }` として `en` にフォールバックします。`CassetteTemplate.nodes[].label` も同様です。今なら小さな変更ですが、デザインが id を参照し始めてからでは高くつきます。',
        ],
      },
      {
        id: 'dont',
        title: '7. やってはいけない4つ',
        body: [
          '**配列をバッチ化できない2回目の往復の後ろに置かない。** 設計はキー入力ごとにアセンブルします。塩基のないパーツはアセンブルできず、パーツごとのスピナーは初回ロードが遅いことより悪い体験です。',
          '**変わりうるものを id に符号化しない。** 冷凍庫の位置、所有者、プロジェクト。それらは属性であり、id は名前です。',
          '**「冷凍庫にある」と「設計に使えるパーツである」を混ぜない。** 在庫とレジストリは別の問いに答え、陳腐化する速度も違います。',
          '**未検証の配列を、そうと言わずに出さない。** `confidence` と `origin` は、キュレーション済みのデータとプレースホルダを研究者が区別するために存在します。すべてが高確度を主張するなら、すべてを未検証として扱うしかなくなります。',
        ],
      },
    ],
  },
}
