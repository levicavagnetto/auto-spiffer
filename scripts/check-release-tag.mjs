import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import process from 'node:process'
import console from 'node:console'

const tag = process.argv[2] || process.env.GITHUB_REF_NAME || ''
const packageFile = fileURLToPath(new URL('../package.json', import.meta.url))
const { version } = JSON.parse(readFileSync(packageFile, 'utf8'))

if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(tag)) {
  console.error(
    `Release tag "${tag}" is not a version tag such as v1.0.0 or v1.0.0-rc1.`
  )
  process.exitCode = 1
} else if (tag !== `v${version}`) {
  console.error(
    `Release tag ${tag} does not match package.json version v${version}.`
  )
  process.exitCode = 1
} else {
  console.log(`Release tag ${tag} matches package.json.`)
}
