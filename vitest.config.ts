import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Маркер server-only отдельным пакетом не ставится, его приносит Next и
      // подменяет при сборке. В тестах берём ту же пустую версию, иначе Vite
      // спотыкается на импорте ещё до того, как отработают моки.
      'server-only': path.resolve(__dirname, './node_modules/next/dist/compiled/server-only/empty.js'),
    },
  },
})
