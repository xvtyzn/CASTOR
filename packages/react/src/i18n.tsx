import { createContext, useContext, useMemo, type ReactNode } from 'react'

/**
 * The library's user-visible strings.
 *
 * Deliberately a plain typed dictionary rather than an i18n framework. A component library that
 * ships react-i18next forces its choice, its provider and its bundle on every host, including
 * the many that already run something else; a dictionary is a prop. Interpolation is done with
 * functions, so the argument order is the translator's business and TypeScript catches a missing
 * key at compile time rather than rendering `undefined` at a bench.
 *
 * `en` is the source of truth. Any other locale is `Partial<CastorMessages>` merged over it, so
 * a half-finished translation degrades to English instead of to blanks.
 */
export interface CastorMessages {
  common: {
    replace: string
    remove: string
    flip: string
    cancel: string
    close: string
    open: string
    locked: string
    add: string
    search: string
    name: string
    role: string
    length: string
    sequence: string
    confidence: string
    licence: string
    bp: (n: number) => string
    reorderHint: (what: string) => string
  }
  backbone: {
    label: string
    outsideItrs: (bp: string) => string
    notPackaged: string
  }
  cassette: {
    title: string
    designName: string
    limit: (kb: string) => string
    itrToItr: string
    cargo: string
    headroom: (bp: string) => string
    overLimit: (bp: string) => string
  }
  slots: {
    addLabel: string
    addOne: (label: string) => string
    addAnother: (label: string) => string
    required: (label: string) => string
    requiredFootnote: string
    lockedHint: string
    reverseComplement: string
    autoInserted: string
  }
  picker: {
    title: (slot: string) => string
    addTo: (slot: string) => string
    searchPlaceholder: (roles: string) => string
    nothingAccepts: (roles: string) => string
    pasteName: string
    pasteSequence: string
    pastePlaceholder: string
    pasteRead: (bp: string) => string
    pasteDropped: (n: number) => string
    pasteFromHeader: string
    pastePrompt: string
    selectPrompt: string
    whereUsed: string
    noUsage: string
    notUsedYet: string
    publications: (n: number) => string
    onlyProject: (project: string) => string
    onlyProjectWithCount: (project: string, constructs: number) => string
    sharedAcross: (projects: number, constructs: number) => string
    unnamedConstruct: string
  }
  findings: {
    none: string
  }
  cart: {
    empty: string
    addDesign: string
    fillRequired: string
    neighbourHint: string
    showInComparison: (name: string) => string
  }
  compare: {
    needTwo: string
    colour: string
    byPartType: string
    byHomologyGroup: string
    byIdentity: string
    ribbons: string
    straight: string
    curved: string
    alignOn: string
    alignNothing: string
    orderBySimilarity: string
    autoOrient: string
    zoom: string
    zoomIn: string
    zoomOut: string
    readSequence: string
    fit: string
    sequenceShownAligned: (part: string) => string
    sequenceShownUnaligned: string
    sequenceHidden: string
    tooManyRows: string
  }
  map: {
    wholePlasmid: string
    pgoiOnly: string
    partActions: string
    insertHere: string
    insertBefore: string
    insertAfter: string
    backToForward: string
    between: (a: string, b: string) => string
    beforeOnly: (a: string) => string
    afterOnly: (a: string) => string
    emptyCassette: string
    nothingFits: string
    boundaryFixed: string
  }
  disclaimer: string
}

export const en: CastorMessages = {
  common: {
    replace: 'Replace',
    remove: 'Remove',
    flip: 'Flip',
    cancel: 'Cancel',
    close: 'Close',
    open: 'Open',
    locked: 'locked',
    add: 'Add',
    search: 'Search',
    name: 'Name',
    role: 'Role',
    length: 'Length',
    sequence: 'Sequence',
    confidence: 'Confidence',
    licence: 'Licence',
    bp: (n) => `${n.toLocaleString('en-US')} bp`,
    reorderHint: (what) => `Reorder ${what}. Press space, then use the arrow keys.`,
  },
  backbone: {
    label: 'Backbone',
    outsideItrs: (bp) => `${bp} outside the ITRs`,
    notPackaged: 'Not packaged.',
  },
  cassette: {
    title: 'Cassette',
    designName: 'Design name',
    limit: (kb) => `${kb} limit`,
    itrToItr: 'ITR-to-ITR',
    cargo: 'cargo',
    headroom: (bp) => `${bp} bp headroom`,
    overLimit: (bp) => `${bp} bp over the limit`,
  },
  slots: {
    addLabel: 'Add',
    addOne: (label) => `Add ${label.toLowerCase()}`,
    addAnother: (label) => `Add another ${label.toLowerCase()}`,
    required: (label) => `Required — choose a ${label.toLowerCase()}`,
    requiredFootnote: '* required before this design can be saved',
    lockedHint: 'Fixed by the template — it defines the packaging boundary',
    reverseComplement: 'Reverse complement',
    autoInserted: 'Inserted automatically to satisfy a junction',
  },
  picker: {
    title: (slot) => `Choose a part for ${slot}`,
    addTo: (slot) => `Add to ${slot}`,
    searchPlaceholder: (roles) => `Search ${roles}`,
    nothingAccepts: (roles) =>
      `Nothing here accepts ${roles}. Try another source, or paste a sequence.`,
    pasteName: 'Name',
    pasteSequence: 'Sequence or FASTA',
    pastePlaceholder: '>my insert\nATGGTGAGCAAGGGCGAGGAG…',
    pasteRead: (bp) => `${bp} read`,
    pasteDropped: (n) => `${n} non-nucleotide character${n === 1 ? '' : 's'} removed`,
    pasteFromHeader: 'name taken from the FASTA header',
    pastePrompt: 'Paste a sequence to see it here before adding it.',
    selectPrompt: 'Select a candidate to see its sequence and history.',
    whereUsed: 'Where this has been used',
    noUsage: 'No usage records for this part yet.',
    notUsedYet: 'not used yet',
    publications: (n) => `${n} publication${n === 1 ? '' : 's'}`,
    onlyProject: (project) => `only ${project}`,
    onlyProjectWithCount: (project, constructs) => `only ${project} · ${constructs} constructs`,
    sharedAcross: (projects, constructs) => `${projects} projects · ${constructs} constructs`,
    unnamedConstruct: 'unnamed construct',
  },
  findings: {
    none: 'No findings. The cassette is well formed and within the packaging limit.',
  },
  cart: {
    empty:
      'Nothing here yet. Add the design you are working on, change something, and add it again — the comparison shows what moved.',
    addDesign: 'Add this design',
    fillRequired: 'Fill the required slots first.',
    neighbourHint:
      'Ribbons are drawn between neighbouring rows only — drag to choose what is compared against what.',
    showInComparison: (name) => `Show ${name} in the comparison`,
  },
  compare: {
    needTwo: 'Add at least two designs to compare them.',
    colour: 'Colour',
    byPartType: 'by part type',
    byHomologyGroup: 'by part identity',
    byIdentity: 'ribbons by identity',
    ribbons: 'Ribbons',
    straight: 'straight',
    curved: 'curved',
    alignOn: 'Align on',
    alignNothing: 'nothing (left edges)',
    orderBySimilarity: 'Order by similarity',
    autoOrient: 'Auto-orient',
    zoom: 'Zoom',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    readSequence: 'Read sequence',
    fit: 'Fit',
    sequenceShownAligned: (part) => `Sequence shown · aligned on ${part}`,
    sequenceShownUnaligned:
      'Sequence shown — align on a part to read the same position across rows',
    sequenceHidden: 'Zoom in, or press Read sequence, to see individual bases',
    tooManyRows: 'Too many rows to show the sequence — hide some designs',
  },
  map: {
    wholePlasmid: 'Whole plasmid',
    pgoiOnly: 'pGOI only',
    partActions: 'Part actions',
    insertHere: 'Insert here',
    insertBefore: 'Insert before…',
    insertAfter: 'Insert after…',
    backToForward: 'Back to forward strand',
    between: (a, b) => `Between ${a} and ${b}`,
    beforeOnly: (a) => `Before ${a}`,
    afterOnly: (a) => `After ${a}`,
    emptyCassette: 'In an empty cassette',
    nothingFits:
      'Nothing else belongs between these two. Drag a part here from the composition list if you meant to move one.',
    boundaryFixed: 'Fixed by the template — it defines the packaging boundary.',
  },
  disclaimer:
    'A design aid, not a substitute for verifying the finished sequence. Packaging thresholds are published estimates and vary with capsid, cell line and prep. Not for clinical use.',
}

/**
 * Japanese.
 *
 * Two conventions worth stating, because they are choices rather than accidents: technical
 * terms that appear on the sequence itself (ITR, polyA, WPRE, Kozak, pGOI) stay in Latin script,
 * because that is how they are written in a Japanese lab notebook and translating them would
 * make the screen harder to read, not easier. Units stay "bp" for the same reason.
 */
export const ja: Partial<CastorMessages> = {
  common: {
    replace: '差し替え',
    remove: '削除',
    flip: '反転',
    cancel: 'キャンセル',
    close: '閉じる',
    open: '開く',
    locked: '固定',
    add: '追加',
    search: '検索',
    name: '名前',
    role: '種別',
    length: '長さ',
    sequence: '配列',
    confidence: '確度',
    licence: 'ライセンス',
    bp: (n) => `${n.toLocaleString('ja-JP')} bp`,
    reorderHint: (what) => `${what} を並べ替え。スペースキーで持ち上げ、矢印キーで移動します。`,
  },
  backbone: {
    label: 'バックボーン',
    outsideItrs: (bp) => `ITR の外側 ${bp}`,
    notPackaged: 'パッケージされません。',
  },
  cassette: {
    title: 'カセット',
    designName: 'デザイン名',
    limit: (kb) => `${kb} 上限`,
    itrToItr: 'ITR 間',
    cargo: 'カーゴ',
    headroom: (bp) => `残り ${bp} bp`,
    overLimit: (bp) => `上限を ${bp} bp 超過`,
  },
  slots: {
    addLabel: '追加',
    addOne: (label) => `${label} を追加`,
    addAnother: (label) => `${label} をもう1つ追加`,
    required: (label) => `必須 — ${label} を選んでください`,
    requiredFootnote: '* 保存するには必須です',
    lockedHint: 'テンプレートが固定。パッケージング境界を定義します',
    reverseComplement: '逆相補',
    autoInserted: '接合部の要件を満たすため自動挿入されました',
  },
  picker: {
    title: (slot) => `${slot} のパーツを選択`,
    addTo: (slot) => `${slot} に追加`,
    searchPlaceholder: (roles) => `${roles} を検索`,
    nothingAccepts: (roles) =>
      `${roles} を受け入れるパーツがありません。別のソースを見るか、配列を貼り付けてください。`,
    pasteName: '名前',
    pasteSequence: '配列または FASTA',
    pastePlaceholder: '>my insert\nATGGTGAGCAAGGGCGAGGAG…',
    pasteRead: (bp) => `${bp} を読み取りました`,
    pasteDropped: (n) => `塩基以外の文字を ${n} 個除去`,
    pasteFromHeader: '名前は FASTA ヘッダから取得',
    pastePrompt: '配列を貼り付けると、追加する前にここで確認できます。',
    selectPrompt: '候補を選ぶと、配列と使用歴が表示されます。',
    whereUsed: 'どこで使われたか',
    noUsage: 'このパーツの使用記録はまだありません。',
    notUsedYet: '未使用',
    publications: (n) => `論文 ${n} 件`,
    onlyProject: (project) => `${project} のみ`,
    onlyProjectWithCount: (project, constructs) => `${project} のみ · ${constructs} 構築`,
    sharedAcross: (projects, constructs) => `${projects} プロジェクト · ${constructs} 構築`,
    unnamedConstruct: '名称未設定の構築',
  },
  findings: {
    none: '指摘はありません。カセットは整合しており、パッケージング上限の内側です。',
  },
  cart: {
    empty:
      'まだ何もありません。作業中のデザインを追加し、どこかを変えて、もう一度追加してください。何が動いたかが比較図に出ます。',
    addDesign: 'このデザインを追加',
    fillRequired: '必須スロットを埋めてください。',
    neighbourHint:
      'リボンは隣り合う行の間にしか引かれません。ドラッグして、何と何を比べるかを決めてください。',
    showInComparison: (name) => `${name} を比較図に表示`,
  },
  compare: {
    needTwo: '比較するにはデザインを2つ以上追加してください。',
    colour: '配色',
    byPartType: 'パーツ種別',
    byHomologyGroup: 'パーツ同一性',
    byIdentity: 'リボンを同一度で',
    ribbons: 'リボン',
    straight: '直線',
    curved: '曲線',
    alignOn: '整列',
    alignNothing: 'なし（左端揃え）',
    orderBySimilarity: '類似度で並べ替え',
    autoOrient: '向きを自動調整',
    zoom: '拡大',
    zoomIn: '拡大',
    zoomOut: '縮小',
    readSequence: '配列を読む',
    fit: '全体表示',
    sequenceShownAligned: (part) => `配列を表示中 · ${part} で整列`,
    sequenceShownUnaligned: '配列を表示中 — 同じ位置を行間で比べるにはパーツで整列してください',
    sequenceHidden: '拡大するか「配列を読む」を押すと、個々の塩基が見えます',
    tooManyRows: '行が多すぎて配列を表示できません — 一部のデザインを非表示にしてください',
  },
  map: {
    wholePlasmid: 'プラスミド全体',
    pgoiOnly: 'pGOI のみ',
    partActions: 'パーツの操作',
    insertHere: 'ここに挿入',
    insertBefore: 'この前に挿入…',
    insertAfter: 'この後に挿入…',
    backToForward: '順鎖に戻す',
    between: (a, b) => `${a} と ${b} の間`,
    beforeOnly: (a) => `${a} の前`,
    afterOnly: (a) => `${a} の後`,
    emptyCassette: '空のカセット内',
    nothingFits:
      'この2つの間に入るものはありません。パーツを移動したい場合は、構成リストからドラッグしてください。',
    boundaryFixed: 'テンプレートが固定。パッケージング境界を定義します。',
  },
  disclaimer:
    '設計を助けるツールであり、完成配列の検証を代替するものではありません。パッケージング閾値は公表された推定値で、カプシド・細胞株・調製法により変動します。臨床用途には使用できません。',
}

export const locales = { en, ja } as const
export type LocaleCode = keyof typeof locales

/** Deep-merges a partial locale over English, one level of nesting. */
export function resolveMessages(
  overrides?: Partial<CastorMessages> | LocaleCode,
): CastorMessages {
  const partial = typeof overrides === 'string' ? locales[overrides] : overrides
  if (!partial) return en
  const out = { ...en } as CastorMessages
  for (const key of Object.keys(partial) as (keyof CastorMessages)[]) {
    const value = partial[key]
    if (value && typeof value === 'object') {
      // @ts-expect-error one level of nesting, checked by the CastorMessages type itself
      out[key] = { ...en[key], ...value }
    } else if (value !== undefined) {
      // @ts-expect-error scalar leaf (disclaimer)
      out[key] = value
    }
  }
  return out
}

const MessagesContext = createContext<CastorMessages>(en)

export function useMessages(): CastorMessages {
  return useContext(MessagesContext)
}

export function MessagesProvider({
  messages,
  children,
}: {
  messages?: Partial<CastorMessages> | LocaleCode
  children: ReactNode
}) {
  const value = useMemo(() => resolveMessages(messages), [messages])
  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>
}
