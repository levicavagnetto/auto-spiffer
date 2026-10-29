import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { readSalesExport } from '../../src/main/sales/reader'

const path = resolve('private-data/sales/material_sales.xlsx')

test.skipIf(!existsSync(path))('real sample has 49 rows', async () => {
  const state = await readSalesExport(path)
  expect(state.sales.length + state.unreadable.length).toBe(49)
  expect(state.sales.filter((sale) => sale.notATire === null)).toHaveLength(46)
})
