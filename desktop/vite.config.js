import { resolve } from 'node:path'
import useVueRouter from 'unplugin-vue-router/vite'
import useVue from '@vitejs/plugin-vue'
import useVueJsx from '@vitejs/plugin-vue-jsx'
import useUnoCSS from 'unocss/vite'
import { defineConfig, mergeConfig } from 'vite'

import useElectron from 'vite-plugin-electron/simple'

import postcssConfig from './postcss.config.js'

import useInternalPlugins from './src/plugins/internal.js'

const alias = {
  $: resolve('src'),
  $root: resolve(),
  $docs: resolve('docs'),
  $renderer: resolve('src'),
  $electron: resolve('electron'),
  $control: resolve('pages/control'),
  $explorer: resolve('pages/explorer'),
  $copilot: resolve('pages/copilot'),
  $terminal: resolve('pages/terminal'),
}

function mergeCommon(config, { command = '' } = {}) {
  return mergeConfig(
    {
      resolve: {
        alias,
      },
      build: {
        rollupOptions: {
          external: [
            'sharp',
            'i18next-fs-backend',
            '@lydell/node-pty',
            'autoglm.js',
          ],
        },
      },
    },
    config,
  )
}

export default function (args) {
  return mergeCommon(
    defineConfig({
      server: {
        port: 1535,
      },
      build: {
        rollupOptions: {
          input: {
            main: resolve('index.html'),
            control: resolve('pages/control/index.html'),
            explorer: resolve('pages/explorer/index.html'),
            copilot: resolve('pages/copilot/index.html'),
            terminal: resolve('pages/terminal/index.html'),
            logcat: resolve('pages/logcat/index.html'),
            apps: resolve('pages/apps/index.html'),
          },
        },
      },
      plugins: [
        useUnoCSS(),
        useVueRouter({
          routesFolder: 'src/views',
          exclude: ['src/views/**/components'],
        }),
        useVue(),
        useVueJsx(),
        useElectron({
          main: {
            entry: 'electron/main.js',
            vite: mergeCommon({}, args),
            onstart(args) {
              args.startup()
            },
          },
          preload: {
            input: 'electron/preload.js',
            vite: mergeCommon({}, args),
            onstart(args) {
              args.reload()
            },
          },
        }),
        ...useInternalPlugins(),
      ],
      css: {
        postcss: postcssConfig,
      },
    }),
  )
}
