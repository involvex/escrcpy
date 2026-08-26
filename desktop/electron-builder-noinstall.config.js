/** @type {import('electron-builder').Configuration} */
export default {
  productName: 'Escrcpy',
  appId: 'org.viarotel.escrcpy',
  directories: {
    output: 'dist-release',
    buildResources: 'electron/resources/build',
  },
  files: [
    'dist',
    'dist-electron',
    '!**/node_modules/@img/sharp-*/**/*',
    '**/node_modules/@img/sharp-*${platform}-${arch}/**/*',
    '!**/node_modules/@lydell/node-pty-*/**/*',
    '**/node_modules/@lydell/node-pty-*${platform}-${arch}/**/*',
    '**/node_modules/autoglm.js/**/*',
    '**/node_modules/@autoglm.js/**/*',
  ],
  asar: false,
  asarUnpack: [
    '**/node_modules/sharp/**/*',
    '**/node_modules/@img/**/*',
    '**/node_modules/@lydell/**/*',
    '**/node_modules/autoglm.js/**/*',
    '**/node_modules/@autoglm.js/**/*',
  ],
  win: {
    icon: 'logo.ico',
    target: [
      { target: 'nsis', arch: ['x64', 'arm64'] },
      { target: 'portable', arch: ['x64', 'arm64'] },
    ],
    artifactName: '${productName}-${version}-win-${arch}.${ext}',
    extraResources: {
      from: 'electron/resources/extra',
      to: 'extra',
      filter: ['common', 'win', 'win-${arch}'],
    },
  },
  nsis: {
    artifactName: '${productName}-${version}-win-setup-${arch}.${ext}',
    shortcutName: '${productName}',
    uninstallDisplayName: '${productName}',
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false,
  },
  portable: {
    artifactName: '${productName}-${version}-win-portable-${arch}.${ext}',
    requestExecutionLevel: 'user',
  },
  npmRebuild: false,
  buildDependenciesFromSource: false,
  publish: {
    provider: 'github',
    owner: 'viarotel-org',
    repo: 'escrcpy',
    updaterCacheDirName: 'escrcpy-updater',
  },
}
