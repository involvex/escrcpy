/** @type {import('electron-builder').Configuration} */
export default {
  productName: 'Escrcpy',
  appId: 'org.viarotel.escrcpy',
  directories: {
    output: 'dist-release-new',
    buildResources: 'electron/resources/build',
  },
  files: [
    'dist',
    'dist-electron',
    '!**/node_modules/@img/sharp-*/**/*',
    '**/node_modules/@img/sharp-*${platform}-${arch}/**/*',
    '!**/node_modules/@lydell/node-pty-*/**/*',
    '**/node_modules/@lydell/node-pty-*${platform}-${arch}/**/*',
  ],
  asar: false,
  win: {
    icon: 'logo.ico',
    target: [
      { target: 'dir', arch: ['x64'] },
    ],
    extraResources: {
      from: 'electron/resources/extra',
      to: 'extra',
      filter: ['common', 'win', 'win-${arch}'],
    },
  },
  npmRebuild: false,
  buildDependenciesFromSource: false,
}
