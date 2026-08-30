import { bench } from 'vitest'
import {
  groupId,
  instanceId,
  partId,
  rowId,
  type ComparisonModel,
  type ComparisonRow,
} from '../index.js'
import { DEFAULT_GEOM } from './geometry.js'
import { computeLayout, DEFAULT_LAYOUT_OPTIONS } from './layout.js'
import { DEFAULT_PROJECT_OPTIONS, project } from './project.js'

const rows: ComparisonRow[] = Array.from({ length: 40 }, (_, rowIndex) => {
  const id = rowId(`row-${rowIndex}`)
  return {
    id,
    label: `Design ${rowIndex + 1}`,
    segments: [
      {
        id: `${id}:pgoi`,
        length: 2_000,
        items: Array.from({ length: 20 }, (_, itemIndex) => ({
          uid: `${id}:part-${itemIndex}`,
          instanceId: instanceId(`${id}:instance-${itemIndex}`),
          partId: partId(`part-${itemIndex}`),
          name: `Part ${itemIndex + 1}`,
          role: itemIndex % 2 === 0 ? ('cds' as const) : ('linker' as const),
          start: itemIndex * 100,
          end: (itemIndex + 1) * 100,
          strand: 1 as const,
        })),
      },
    ],
  }
})

const model: ComparisonModel = {
  rows,
  groups: Array.from({ length: 20 }, (_, index) => ({
    id: groupId(`part-${index}`),
    label: `Part ${index + 1}`,
    color: '#888888',
    memberPartIds: [partId(`part-${index}`)],
  })),
  links: rows.slice(0, -1).flatMap((row, rowIndex) =>
    Array.from({ length: 20 }, (_, itemIndex) => ({
      id: `link-${rowIndex}-${itemIndex}`,
      a: `${row.id}:part-${itemIndex}`,
      b: `${rows[rowIndex + 1]!.id}:part-${itemIndex}`,
      identity: 1,
      groupId: groupId(`part-${itemIndex}`),
      inverted: false,
    })),
  ),
}

const layout = computeLayout(model, {
  ...DEFAULT_LAYOUT_OPTIONS,
  order: rows.map((row) => row.id),
})

bench('project 40 rows x 20 parts', () => {
  project(
    layout,
    (bp) => 190 + bp * 0.45,
    { width: 1_100, plotLeft: 190 },
    {
      ...DEFAULT_PROJECT_OPTIONS,
      geom: DEFAULT_GEOM,
      rowHeight: DEFAULT_LAYOUT_OPTIONS.rowHeight,
    },
  )
})
