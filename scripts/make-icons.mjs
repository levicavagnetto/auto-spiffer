import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = process.cwd()
const output = join(root, 'build')
const logo = await readFile(join(root, 'docs', 'brand', 'logo.svg'))
const sizes = [16, 32, 48, 256]

await mkdir(output, { recursive: true })
const paths = await Promise.all(
  sizes.map(async (size) => {
    const path = join(output, `icon-${size}.png`)
    await writeFile(path, await sharp(logo).resize(size, size).png().toBuffer())
    return path
  })
)
await writeFile(join(output, 'icon.ico'), await pngToIco(paths))
