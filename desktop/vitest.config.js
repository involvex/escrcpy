import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      $: resolve('src'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
  },
})
