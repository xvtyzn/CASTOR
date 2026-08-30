import type { LocaleCode } from '@castor-bio/react'

/**
 * The workbench's own strings.
 *
 * Kept separate from `@castor-bio/react`'s dictionary on purpose: the library's strings are
 * about parts and cassettes and every host needs them; these are about tabs and onboarding and
 * only this shell does. A host embedding the primitives should not have to carry copy for an
 * application it is not using.
 */
export interface WorkbenchMessages {
  appName: string
  tagline: string
  expansion: string
  tabs: { overview: string; design: string; compare: string; registry: string; reference: string }
  language: string
  overview: {
    title: string
    lede: string
    whatItIs: { title: string; body: string }
    steps: { title: string; items: { title: string; body: string }[] }
    principles: { title: string; items: { title: string; body: string }[] }
    /** Counts pluralise in English and do not in Japanese, so the label takes the number. */
    status: {
      parts: (n: number) => string
      backbones: (n: number) => string
      templates: (n: number) => string
      designs: (n: number) => string
    }
  }
  design: {
    explainTitle: string
    explainSummary: string
    explainBody: string[]
    composition: string
    findings: string
    designs: string
    map: string
    errorsWarnings: (errors: number, warnings: number) => string
    saved: (n: number) => string
  }
  compare: { explainTitle: string; explainSummary: string; explainBody: string[] }
  registry: {
    explainTitle: string
    explainSummary: string
    explainBody: string[]
    parts: string
    searchPlaceholder: string
    role: string
    allRoles: string
    columns: {
      part: string
      role: string
      length: string
      projects: string
      constructs: string
      usedIn: string
      source: string
    }
  }
  reference: {
    title: string
    lede: string
    sections: { id: string; title: string; body: string; code?: string }[]
  }
}

export const workbenchEn: WorkbenchMessages = {
  appName: 'CASTOR',
  tagline: 'Cassette Assembly with Synteny Tracks and Origin Records',
  expansion:
    'Named for the star that looks single to the eye and resolves into three pairs — which is what the comparison view does to a stack of designs.',
  tabs: {
    overview: 'Overview',
    design: 'Design',
    compare: 'Compare',
    registry: 'Registry',
    reference: 'Reference',
  },
  language: 'Language',
  overview: {
    title: 'Design an AAV cassette, then see what changed',
    lede: 'CASTOR builds ITR-to-ITR cassettes from parts your group already uses, and lays the results side by side so the differences are the thing you look at.',
    whatItIs: {
      title: 'What this is',
      body: 'An embeddable component library, not a service. Everything runs in the browser: the catalogue ships as static JSON, no sequence leaves the page, and there is no account to create. The shell you are looking at is one way to arrange the components; the components are the product.',
    },
    steps: {
      title: 'How it goes',
      items: [
        {
          title: 'Pick a backbone',
          body: 'Everything outside the ITRs. It is not packaged, so it does not count against the cargo budget — but it decides the selection marker and the origin.',
        },
        {
          title: 'Fill the cassette',
          body: 'Add parts from the catalogue, from your own registry, or by pasting a sequence. The ruler runs to the packaging limit, so the empty space on the right is the headroom you have left.',
        },
        {
          title: 'Read the findings',
          body: 'Size, ITR integrity, ordering, Kozak context, QC-digest conflicts. Advisory, always: an unusual arrangement produces a finding, never a refusal.',
        },
        {
          title: 'Save it and change something',
          body: 'Each saved design is a frozen snapshot. Swap the promoter, save again, and the comparison shows exactly what moved.',
        },
      ],
    },
    principles: {
      title: 'Three things worth knowing',
      items: [
        {
          title: 'Colour means biology',
          body: 'The chrome is deliberately grey. Every saturated pixel on screen is a part, a homology group or a packaging band — so colour never competes with itself.',
        },
        {
          title: 'Homology is identity, not alignment',
          body: 'Two parts are linked in the comparison because they are the same registry entry, which the designer knows for certain. No aligner, no threshold, no false homology.',
        },
        {
          title: 'Validation never blocks',
          body: 'Order is data. You can drag a tag past the CDS, insert something the template would never place, and build it anyway — with a finding explaining what it costs.',
        },
      ],
    },
    status: {
      parts: (n) => `part${n === 1 ? '' : 's'} in the catalogue`,
      backbones: (n) => `backbone${n === 1 ? '' : 's'}`,
      templates: (n) => `cassette template${n === 1 ? '' : 's'}`,
      designs: (n) => `design${n === 1 ? '' : 's'} saved`,
    },
  },
  design: {
    explainTitle: 'Build the cassette between the ITRs',
    explainSummary:
      'Everything you add sits inside a fixed budget. The ruler shows how much of it is left.',
    explainBody: [
      'The ruler runs to the packaging limit, not to the length of what you have built, so the empty space to the right is the headroom you still have. Parts are drawn to scale — a 1,179 bp EF1α really is five times a 221 bp polyA.',
      'Click a part on the map to replace it, flip it, or insert something beside it; clicking between two parts offers only what can legally go in that gap. Drag the handle on the left of a row to reorder. Nothing is blocked: an unusual arrangement produces a finding, not a refusal.',
    ],
    composition: 'Composition',
    findings: 'Findings',
    designs: 'Designs',
    map: 'Map',
    errorsWarnings: (e, w) => `${e} errors · ${w} warnings`,
    saved: (n) => `${n} saved`,
  },
  compare: {
    explainTitle: 'Read the differences off the figure',
    explainSummary: 'Ribbons join parts that are the same catalogue entry. The gaps are what differs.',
    explainBody: [
      'There is no alignment and no similarity threshold here: two parts are linked because they are the same registry entry, which is something the designer knows for certain. Where no ribbon crosses between two rows, those rows genuinely differ.',
      'Ribbons are drawn between neighbouring rows only, so the order of the saved designs decides what is compared against what — drag them to change it. Align the rows on a part and zoom in and the tracks resolve into individual bases, the same position in every design, stacked.',
    ],
  },
  registry: {
    explainTitle: 'What the group already has',
    explainSummary: 'Every part the designer can offer, and how much use each one has actually seen.',
    explainBody: [
      'Sorted by projects, the parts your group has standardised on come first and the one-offs come last. That ordering is most of what a registry is for: a promoter three projects already used is usually the one you want, and a transgene used once two years ago is usually the one to look at carefully before reusing.',
      'Source says where the sequence came from. A GenBank accession means the bases were extracted from a named public record and checked; anything else is unverified and marked low-confidence in the picker.',
    ],
    parts: 'Parts',
    searchPlaceholder: 'Search name, alias, accession or project',
    role: 'Role',
    allRoles: 'All roles',
    columns: {
      part: 'Part',
      role: 'Role',
      length: 'Length',
      projects: 'Projects',
      constructs: 'Constructs',
      usedIn: 'Used in',
      source: 'Source',
    },
  },
  reference: {
    title: 'Connecting your own registry',
    lede: 'What CASTOR needs from a parts database, and what it does with each field.',
    sections: [],
  },
}

export const workbenchJa: WorkbenchMessages = {
  appName: 'CASTOR',
  tagline: 'Cassette Assembly with Synteny Tracks and Origin Records',
  expansion:
    '肉眼では1つに見えて3組の連星に分かれる星の名前から。重なって見えるものを対にして分解するのは、比較ビューがやっていることそのものです。',
  tabs: {
    overview: '概要',
    design: '設計',
    compare: '比較',
    registry: 'レジストリ',
    reference: 'リファレンス',
  },
  language: '言語',
  overview: {
    title: 'AAV カセットを設計し、何が変わったかを見る',
    lede: 'CASTOR は、あなたのグループがすでに使っているパーツから ITR 間のカセットを組み立て、結果を横に並べて「違いそのもの」を見えるようにします。',
    whatItIs: {
      title: 'これは何か',
      body: 'サービスではなく、埋め込み可能なコンポーネントライブラリです。すべてブラウザ内で動きます。カタログは静的 JSON として同梱され、配列がページの外に出ることはなく、アカウント登録もありません。いま見えているシェルはコンポーネントの並べ方の一例で、製品はコンポーネントの方です。',
    },
    steps: {
      title: '進め方',
      items: [
        {
          title: 'バックボーンを選ぶ',
          body: 'ITR の外側すべて。パッケージされないのでカーゴ予算には効きませんが、選択マーカーと複製起点はここで決まります。',
        },
        {
          title: 'カセットを埋める',
          body: 'カタログから、自分たちのレジストリから、あるいは配列を貼り付けて追加します。ルーラーはパッケージング上限まで引かれるので、右側の空白がそのまま残容量です。',
        },
        {
          title: '指摘を読む',
          body: 'サイズ、ITR の整合、順序、Kozak 文脈、QC ダイジェストの衝突。常に助言であり、変わった構成は指摘を出すだけで拒否はしません。',
        },
        {
          title: '保存して、どこかを変える',
          body: '保存したデザインは凍結されたスナップショットです。プロモーターを差し替えてもう一度保存すると、何が動いたかが比較図に出ます。',
        },
      ],
    },
    principles: {
      title: '知っておくと良い3点',
      items: [
        {
          title: '色は生物学だけを意味する',
          body: 'UI のクロムは意図的に無彩色です。画面上の彩度のある画素はすべて、パーツ・相同グループ・パッケージング帯のいずれか。色が色と競合しません。',
        },
        {
          title: '相同性はアラインメントではなく同一性',
          body: '比較図でリボンが繋がるのは「同じレジストリ項目だから」で、これは設計側が確実に知っている事実です。アライナも閾値も偽陽性もありません。',
        },
        {
          title: '検証は決して妨げない',
          body: '順序はデータです。タグを CDS の後ろにドラッグしても、テンプレートが置かない位置に挿入しても、そのまま作れます。代償を説明する指摘が出るだけです。',
        },
      ],
    },
    status: {
      parts: () => 'カタログのパーツ',
      backbones: () => 'バックボーン',
      templates: () => 'カセットテンプレート',
      designs: () => '保存済みデザイン',
    },
  },
  design: {
    explainTitle: 'ITR の間にカセットを組む',
    explainSummary: '追加するものはすべて固定の予算の中に入ります。残量はルーラーが示します。',
    explainBody: [
      'ルーラーは組んだ長さではなくパッケージング上限まで引かれるので、右側の空白がそのまま残容量です。パーツは実寸で描かれ、1,179 bp の EF1α は 221 bp の polyA の5倍の幅になります。',
      'マップ上のパーツをクリックすると差し替え・反転・隣への挿入ができ、2つのパーツの間をクリックすると、そこに入れられるものだけが出ます。行の左のハンドルをドラッグすると並べ替えられます。何も禁止されません。変わった構成は指摘であって拒否ではありません。',
    ],
    composition: '構成',
    findings: '指摘',
    designs: 'デザイン',
    map: 'マップ',
    errorsWarnings: (e, w) => `エラー ${e} · 警告 ${w}`,
    saved: (n) => `${n} 件保存済み`,
  },
  compare: {
    explainTitle: '違いを図から読む',
    explainSummary: 'リボンは同じカタログ項目どうしを繋ぎます。途切れているところが違いです。',
    explainBody: [
      'ここにアラインメントも類似度の閾値もありません。2つのパーツが繋がるのは同じレジストリ項目だからで、これは設計側が確実に知っている事実です。リボンが渡っていない箇所は、本当に違います。',
      'リボンは隣り合う行の間にしか引かれないので、保存デザインの並び順が「何と何を比べるか」を決めます。ドラッグで変えられます。パーツで整列してから拡大すると、トラックが個々の塩基に分解され、全デザインの同じ位置が縦に並びます。',
    ],
  },
  registry: {
    explainTitle: 'グループがすでに持っているもの',
    explainSummary: '設計で選べるすべてのパーツと、それぞれが実際にどれだけ使われてきたか。',
    explainBody: [
      'プロジェクト数で並べると、グループの標準になっているものが上に、一度きりのものが下に来ます。この順序がレジストリの価値の大半です。3プロジェクトで使われたプロモーターはたいてい今回も正解で、2年前に一度だけ使われた導入遺伝子はたいてい再利用前に確認すべきものです。',
      '「Source」は配列の出所です。GenBank のアクセッションがあれば、名前のついた公開記録から抽出して照合済みという意味で、それ以外は未検証としてピッカーでも低確度と表示されます。',
    ],
    parts: 'パーツ',
    searchPlaceholder: '名前・別名・アクセッション・プロジェクトで検索',
    role: '種別',
    allRoles: 'すべての種別',
    columns: {
      part: 'パーツ',
      role: '種別',
      length: '長さ',
      projects: 'プロジェクト',
      constructs: '構築',
      usedIn: '使用先',
      source: '出所',
    },
  },
  reference: {
    title: '自前のレジストリを繋ぐ',
    lede: 'CASTOR がパーツデータベースに求めるもの、そして各フィールドが何に使われるか。',
    sections: [],
  },
}

export const workbenchLocales: Record<LocaleCode, WorkbenchMessages> = {
  en: workbenchEn,
  ja: workbenchJa,
}
