/**
 * Number formatting. Every length in this interface is base pairs, and lengths are the
 * subject of the tool, so they are always monospaced, always tabular, and always carry
 * their unit.
 */
export function bp(n: number): string {
  return `${n.toLocaleString('en-US')} bp`
}

export function kb(n: number, digits = 2): string {
  return `${(n / 1000).toFixed(digits)} kb`
}

/** Compact form for tight spots: bases under 1 kb, kilobases above. */
export function shortLength(n: number): string {
  return n < 1000 ? `${n}` : `${(n / 1000).toFixed(n < 10000 ? 2 : 1)}k`
}

/**
 * GenBank-style 60-column blocks, in groups of ten, with a 1-based position gutter.
 *
 * `startAt` is the 1-based position of the first base, so a preview that shows only the ends of
 * a long sequence can still number the 3' block correctly. Numbering both blocks from 1 makes
 * the preview quietly wrong about where you are in the part.
 */
export function formatSequenceBlock(seq: string, perLine = 60, group = 10, startAt = 1): string {
  const lines: string[] = []
  const width = String(startAt + seq.length).length
  for (let i = 0; i < seq.length; i += perLine) {
    const chunk = seq.slice(i, i + perLine)
    const groups: string[] = []
    for (let j = 0; j < chunk.length; j += group) groups.push(chunk.slice(j, j + group))
    lines.push(`${String(startAt + i).padStart(width, ' ')}  ${groups.join(' ')}`)
  }
  return lines.join('\n')
}
