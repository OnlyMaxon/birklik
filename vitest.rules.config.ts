import {defineConfig} from 'vitest/config'

// Отдельный конфиг: тесты правил ходят в эмулятор Firestore по сети и требуют
// окружения node, а не jsdom. Запускать только через `pnpm test:rules` — сами по
// себе они упадут, потому что эмулятор поднимает `firebase emulators:exec`.
//
// Из основного набора (vitest.config.ts) эта папка исключена, иначе `pnpm test:run`
// падал бы у всех, кто не поднял эмулятор.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    // Правила проверяются на одной общей базе эмулятора: параллельные файлы
    // затирали бы друг другу подготовленные документы.
    fileParallelism: false,
    testTimeout: 15000
  }
})
