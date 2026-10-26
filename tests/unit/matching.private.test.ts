import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { readSalesExport } from '../../src/main/sales/reader'
import { parseTireList } from '../../src/main/matching/tireList'
import { planLines } from '../../src/main/matching/plan'

const path = resolve('private-data/sales/material_sales.xlsx')
test.skipIf(!existsSync(path))(
  'real sample matches the October public list',
  async () => {
    const sales = await readSalesExport(path)
    const labels = readFileSync('docs/reference/tire-list-2026-10.txt', 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#'))
    const lines = planLines(
      sales.sales,
      parseTireList(labels),
      {},
      {},
      {},
      new Set(),
      [null, null]
    )
    const counts = Object.fromEntries(
      ['ready', 'needs-decision', 'not-eligible', 'not-a-tire'].map(
        (status) => [
          status,
          lines.filter((line) => line.status === status).length
        ]
      )
    )
    expect(counts).toEqual({
      ready: 21,
      'needs-decision': 2,
      'not-eligible': 18,
      'not-a-tire': 3
    })
    const patterns: [RegExp, string][] = [
      [/RT45/i, 'General Altimax RT45 - Passenger Tires'],
      [/WRG5/i, 'Nokian Remedy WRG5 - Passenger Tires'],
      [/AKLIMATE/i, 'Falken Aklimate - Passenger Tires'],
      [/SECURECONTACT/i, 'Continental SecureContact AW - Passenger Tires'],
      [
        /STRONG GUARD/i,
        'Hercules Strong Guard ST Trailer - BOAT TRAILER TIRES'
      ],
      [/OUTPOST NAT/i, 'Nokian Outpost nAT - Light Truck Tires'],
      [
        /OPEN COUNTRY A\/T III/i,
        'Toyo Open Country A/T III - Light Truck Tires'
      ],
      [/TERRA GRAPPLER G3/i, 'Nitto Terra Grappler G3 - Light Truck Tires'],
      [/WILDPEAK A\/T4W/i, 'Falken Wildpeak A/T4W - Light Truck Tires']
    ]
    const unknown = lines.filter(
      (line) =>
        line.status === 'ready' &&
        !patterns.some(
          ([pattern, label]) =>
            pattern.test(line.description) && line.tire === label
        )
    )
    expect(unknown.map((line) => line.description)).toEqual([])
    expect(
      lines.every(
        (line) => line.status !== 'ready' || labels.includes(line.tire!)
      )
    ).toBe(true)
  }
)
