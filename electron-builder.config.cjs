/* global require, module */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require('./package.json')

const majorMinor = version.match(/^\d+\.\d+/)?.[0]
if (!majorMinor) throw new Error(`Invalid package version: ${version}`)

module.exports = {
  appId: 'com.backburnerlabs.autospiffer',
  productName: 'Auto Spiffer',
  directories: { output: 'release', buildResources: 'build' },
  files: ['out/**/*', 'package.json'],
  asar: true,
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'build/icon.ico',
    executableName: 'AutoSpiffer'
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    allowElevation: false,
    deleteAppDataOnUninstall: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: `Auto Spiffer ${majorMinor}`,
    include: 'build/installer.nsh',
    artifactName: 'Auto-Spiffer-Setup-${version}.exe'
  },
  publish: { provider: 'github', owner: 'levicavagnetto', repo: 'auto-spiffer' }
}
