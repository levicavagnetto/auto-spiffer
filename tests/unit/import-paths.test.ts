import { afterEach, expect, test } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { collectPdfPaths, validateExportPath } from '../../src/main/sales/paths'

const folders: string[] = []
function fixtureFolder(): string {
  const folder = mkdtempSync(join(tmpdir(), 'auto-spiffer-paths-'))
  folders.push(folder)
  return folder
}
afterEach(() => {
  for (const folder of folders.splice(0))
    rmSync(folder, { recursive: true, force: true })
})

test('dropped PDFs and a folder are checked in main without scanning subfolders', async () => {
  const folder = fixtureFolder()
  const direct = join(folder, 'one.pdf')
  const other = join(folder, 'two.PDF')
  const text = join(folder, 'notes.txt')
  const nested = join(folder, 'nested')
  writeFileSync(direct, 'PDF')
  writeFileSync(other, 'PDF')
  writeFileSync(text, 'not a PDF')
  mkdirSync(nested)
  writeFileSync(join(nested, 'three.pdf'), 'PDF')

  const result = await collectPdfPaths([
    direct,
    folder,
    direct,
    text,
    join(folder, 'missing.pdf'),
    'relative.pdf'
  ])
  expect(result.paths).toEqual([direct, other])
  expect(result.warnings).toHaveLength(3)
  expect(result.warnings.join(' ')).toContain('notes.txt')
  expect(result.warnings.join(' ')).toContain('missing.pdf')
  expect(result.warnings.join(' ')).toContain('relative.pdf')
})

test('an export path must be an existing xlsx file', async () => {
  const folder = fixtureFolder()
  const valid = join(folder, 'sales.xlsx')
  writeFileSync(valid, 'content')
  writeFileSync(join(folder, 'sales.pdf'), 'content')
  await expect(validateExportPath(valid)).resolves.toBe(valid)
  await expect(validateExportPath(join(folder, 'sales.pdf'))).rejects.toThrow(
    'Excel'
  )
  await expect(
    validateExportPath(join(folder, 'missing.xlsx'))
  ).rejects.toThrow('not found')
  await expect(validateExportPath(folder)).rejects.toThrow('file')
})
