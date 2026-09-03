import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
    // Тесты правил живут в tests/rules и требуют поднятого эмулятора Firestore.
    // Здесь их быть не должно: `pnpm test:run` обязан проходить без эмулятора.
    // Запуск — `pnpm test:rules`, конфиг vitest.rules.config.ts.
    exclude: ['**/node_modules/**', '**/dist/**', '.next/**', 'tests/rules/**'],
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
