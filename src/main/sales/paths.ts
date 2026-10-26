import { readdir, stat } from 'node:fs/promises'
import { basename, extname, isAbsolute, join } from 'node:path'

export async function validateExportPath(path: string): Promise<string> {
  if (!isAbsolute(path)) throw new Error('Choose an Excel export file.')
  let details
  try {
    details = await stat(path)
  } catch {
    throw new Error('The sales export was not found. Choose it again.')
  }
  if (!details.isFile()) throw new Error('Choose an Excel export file.')
  if (extname(path).toLowerCase() !== '.xlsx')
    throw new Error('Choose an Excel .xlsx export file.')
  return path
}

export async function collectPdfPaths(inputs: string[]): Promise<{
  paths: string[]
  warnings: string[]
}> {
  const paths: string[] = []
  const warnings: string[] = []
  const seen = new Set<string>()
  const add = (path: string): void => {
    const key = path.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    paths.push(path)
  }
  for (const input of inputs) {
    if (!isAbsolute(input)) {
      warnings.push(`${input || 'A dropped item'} has no usable file path.`)
      continue
    }
    let details
    try {
      details = await stat(input)
    } catch {
      warnings.push(`${basename(input)} was not found.`)
      continue
    }
    if (details.isDirectory()) {
      const entries = (await readdir(input, { withFileTypes: true })).sort(
        (a, b) => a.name.localeCompare(b.name)
      )
      for (const entry of entries) {
        if (entry.isFile() && extname(entry.name).toLowerCase() === '.pdf')
          add(join(input, entry.name))
      }
    } else if (details.isFile() && extname(input).toLowerCase() === '.pdf') {
      add(input)
    } else {
      warnings.push(`${basename(input)} is not a PDF file.`)
    }
  }
  return { paths, warnings }
}
