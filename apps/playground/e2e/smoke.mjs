/**
 * Browser smoke test: drives the whole flow the README describes.
 *
 * Worth keeping as a real script rather than a throwaway, because the bugs it has actually
 * caught were browser-only — a JSON import attribute that Node honours and every bundler
 * breaks, and a hover-only control that was unreachable by keyboard. Neither is visible from
 * jsdom or from a Node test run.
 *
 *   pnpm --filter playground dev      # in one shell
 *   node apps/playground/e2e/smoke.mjs [screenshotDir]
 */
import { chromium } from 'playwright'

const URL = process.env.PLAYGROUND_URL ?? 'http://localhost:5178/'
const OUT = process.argv[2] ?? null

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1280, height: 1400 },
  deviceScaleFactor: 2,
})

const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

await page.goto(URL, { waitUntil: 'networkidle' })
// The workbench opens on Overview; everything this script drives lives on Design.
await page.waitForSelector('button[role="tab"]')
await page.locator('button[role="tab"]', { hasText: 'Design' }).click()
await page.waitForSelector('.castor-slot')

async function pick(slotLabel, partName) {
  await page.locator('.castor-chip', { hasText: slotLabel }).first().click()
  await page.waitForSelector('.castor-dialog')
  await page.locator('.castor-candidate', { hasText: partName }).first().click()
  await page.locator('.castor-dialog__foot .castor-btn--primary').click()
  await page.waitForSelector('.castor-dialog', { state: 'detached' })
}

async function replace(slotLabel, partName) {
  const row = page.locator('.castor-slot', { hasText: slotLabel }).first()
  await row.hover()
  await row.locator('.castor-btn', { hasText: 'Replace' }).click()
  await page.waitForSelector('.castor-dialog')
  await page.locator('.castor-candidate', { hasText: partName }).first().click()
  await page.locator('.castor-dialog__foot .castor-btn--primary').click()
  await page.waitForSelector('.castor-dialog', { state: 'detached' })
}

const addDesign = () => page.locator('.castor-btn--primary', { hasText: 'Add this design' }).click()

const partNames = () => page.locator('.castor-slot .castor-slot__name').allTextContents()

// Design 1: CAG / EGFP / WPRE / SV40
await pick('Promoter', 'CAG')
await pick('Transgene', 'EGFP')
await pick('WPRE', 'WPRE')
await pick('polyA', 'SV40')
if (OUT) await page.screenshot({ path: `${OUT}/design.png`, fullPage: true })

// The map popover: click a part on the map, insert something beside it. This path only exists
// in a browser — it starts from a seqviz selection event.
// The circular view is the one to drive here: seqviz's linear view scrolls infinitely and only
// renders the blocks near the viewport, so a label further down simply is not in the DOM.
const beforeMapInsert = await partNames()
await page
  .locator('.castor-map text', { hasText: /^EGFP$/ })
  .first()
  .click({ force: true })
await page.waitForTimeout(300)
const popover = page.locator('.castor-popover')
const popoverActions = await popover.locator('.castor-popover__action').allTextContents()
await popover.locator('.castor-popover__action', { hasText: 'Insert before' }).click()
await page.waitForTimeout(250)
const offeredSlots = await popover.locator('.castor-popover__action').allTextContents()
await popover.locator('.castor-popover__action', { hasText: 'N-terminal linker' }).click()
await page.waitForSelector('.castor-dialog')
await page.locator('.castor-candidate').first().click()
await page.locator('.castor-dialog__foot .castor-btn--primary').click()
await page.waitForSelector('.castor-dialog', { state: 'detached' })
await page.waitForTimeout(300)
const afterMapInsert = await partNames()

await addDesign()

// Design 2: swap the promoter and the polyA
await replace('PROMOTER', 'EF1')
await replace('POLYA SIGNAL', 'hGH')
await addDesign()

// Design 3: add an N-terminal tag on top of design 2
await pick('N-terminal tag', '3xFLAG')
await addDesign()
await page.waitForTimeout(400)

// Reordering, by pointer and by keyboard. Both paths have broken before in ways only a real
// browser shows: a hover-only handle that was inert to the keyboard, and a list rendered in
// template order that silently undid every drag.
const beforeDrag = await partNames()

const wpreRow = page.locator('.castor-slot').filter({ hasText: 'WPRE' }).first()
const cdsRow = page.locator('.castor-slot').filter({ hasText: 'EGFP' }).first()
const grip = wpreRow.locator('.castor-slot__grip')
const gb = await grip.boundingBox()
const cb = await cdsRow.boundingBox()
await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2)
await page.mouse.down()
await page.mouse.move(gb.x + gb.width / 2, cb.y + cb.height / 2, { steps: 20 })
await page.mouse.up()
await page.waitForTimeout(300)
const afterPointer = await partNames()

const polyaGrip = page
  .locator('.castor-slot')
  .filter({ hasText: 'polyA' })
  .first()
  .locator('.castor-slot__grip')
await polyaGrip.focus()
await page.keyboard.press('Space')
await page.waitForTimeout(120)
await page.keyboard.press('ArrowUp')
await page.waitForTimeout(120)
await page.keyboard.press('Space')
await page.waitForTimeout(300)
const afterKeyboard = await partNames()

// Zoom to base level. Aligning first is what makes stacked sequence comparable: without an
// anchor the same x is a different position in each design.
await page.locator('button[role="tab"]', { hasText: 'Compare' }).click()
await page.waitForSelector('.castor-compare__svg')
await page.selectOption('.castor-compare__field:has-text("Align on") select', { label: 'EGFP' })
await page.waitForTimeout(200)
const basesAtFit = await page.locator('.castor-compare__base').count()
await page.locator('.castor-btn', { hasText: 'Read sequence' }).click()
await page.waitForTimeout(500)
const zoomedBases = await page.locator('.castor-compare__base').allTextContents()
const perRow = Math.floor(zoomedBases.length / 3)
const seqRow1 = zoomedBases.slice(0, 40).join('')
const seqRow2 = zoomedBases.slice(perRow, perRow + 40).join('')
await page.locator('.castor-btn', { hasText: 'Fit' }).click()
await page.waitForTimeout(300)
const basesAfterFit = await page.locator('.castor-compare__base').count()

const rows = await page.locator('.castor-compare__row-label').count()
const ribbons = await page.locator('.castor-compare__svg polygon').count()
const items = await page.locator('.castor-cart__item').count()
const labels = await page.locator('.castor-compare__row-label').allTextContents()

if (OUT) {
  await page.waitForTimeout(200)
  await page.locator('.castor-compare__svg').screenshot({ path: `${OUT}/compare.png` })
}

await page.locator('button[value="ja"]').click()
await page.waitForTimeout(400)
const jaTabs = await page.locator('button[role="tab"]').allTextContents()
const jaBody = (await page.locator('body').innerText()).slice(0, 4000)
await page.locator('button[value="en"]').click()
await page.waitForTimeout(300)
const enTabs = await page.locator('button[role="tab"]').allTextContents()

await browser.close()

const problems = []
if (errors.length) problems.push(`console/page errors:\n  ${errors.join('\n  ')}`)
if (items !== 3) problems.push(`expected 3 saved designs, got ${items}`)
if (rows !== 3) problems.push(`expected 3 comparison rows, got ${rows}`)
if (ribbons === 0) problems.push('no ribbons drawn between rows')
if (new Set(labels).size !== labels.length) {
  problems.push(`comparison rows are not distinguishable: ${labels.join(', ')}`)
}
if (afterPointer.join() === beforeDrag.join()) {
  problems.push('pointer drag did not reorder the cassette')
}
if (afterKeyboard.join() === afterPointer.join()) {
  problems.push('keyboard reorder did not move the part')
}
if (afterPointer[0] !== beforeDrag[0] || afterPointer.at(-1) !== beforeDrag.at(-1)) {
  problems.push('an ITR moved — the packaging boundary must not be draggable')
}
if (basesAtFit !== 0) problems.push('bases drawn while fitted, where they cannot be legible')
if (zoomedBases.length === 0) problems.push('no bases drawn after zooming to sequence level')
if (!/^[ACGT]+$/.test(seqRow1)) problems.push(`row 1 sequence is not DNA: ${seqRow1}`)
if (seqRow1 !== seqRow2) {
  problems.push(`aligned rows show different sequence:\n    ${seqRow1}\n    ${seqRow2}`)
}
if (basesAfterFit !== 0) problems.push('bases still drawn after fitting back out')
if (!jaTabs.includes('設計'))
  problems.push(`switching to Japanese did not translate the tabs: ${jaTabs.join(', ')}`)
if (!enTabs.includes('Design'))
  problems.push(`switching back to English did not restore the tabs: ${enTabs.join(', ')}`)
if (!/リボン|整列|配列/.test(jaBody)) problems.push('Japanese did not reach the component strings')
if (!popoverActions.includes('Replace…')) {
  problems.push(`clicking a part on the map gave no actions: ${popoverActions.join(', ')}`)
}
if (offeredSlots.some((s) => /promoter|polyA|ITR/i.test(s))) {
  problems.push(`insert-here offered slots that cannot go there: ${offeredSlots.join(', ')}`)
}
if (afterMapInsert.length !== beforeMapInsert.length + 1) {
  problems.push('inserting from the map did not add a part')
}
if (afterMapInsert.indexOf('EGFP') !== beforeMapInsert.indexOf('EGFP') + 1) {
  problems.push('the part inserted from the map did not land immediately before the CDS')
}

if (problems.length) {
  console.error('SMOKE FAILED:\n' + problems.map((p) => `- ${p}`).join('\n'))
  process.exit(1)
}
console.log(
  `smoke ok — ${items} designs, ${rows} rows, ${ribbons} ribbons, reorder by pointer and ` +
    `keyboard, ${zoomedBases.length} bases at sequence zoom, map popover insert, ` +
    `both locales, no console errors`,
)
