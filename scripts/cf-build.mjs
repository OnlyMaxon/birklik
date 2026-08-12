// Сборка воркера Cloudflare без серверных секретов в артефакте.
//
// OpenNext складывает в бандл значения ВСЕХ env-файлов сразу — в
// .open-next/cloudflare/next-env.mjs появляются секции production, development
// и test, и отключить это нечем (см. extract-project-env-vars в адаптере).
// Приватный ключ сервис-аккаунта нужен только локальному `pnpm dev`, а на
// Cloudflare он приходит из wrangler secret уже в рантайме. Поэтому на время
// сборки .env.development.local убирается в сторону и возвращается обратно —
// артефакт получается такой же чистый, как при сборке на CI, где этого файла
// просто нет.
import {execFileSync} from 'node:child_process'
import {existsSync, renameSync} from 'node:fs'

const DEV_ENV_FILE = '.env.development.local'
const STASH_FILE = '.env.development.local.build-stash'

if (existsSync(STASH_FILE)) {
  // Остался от прерванной сборки — вернём, иначе `pnpm dev` лишится секретов.
  if (existsSync(DEV_ENV_FILE)) {
    throw new Error(`Найдены сразу ${DEV_ENV_FILE} и ${STASH_FILE}. Удалите лишний файл вручную.`)
  }
  renameSync(STASH_FILE, DEV_ENV_FILE)
}

const stashed = existsSync(DEV_ENV_FILE)
if (stashed) renameSync(DEV_ENV_FILE, STASH_FILE)

try {
  execFileSync('opennextjs-cloudflare', ['build', ...process.argv.slice(2)], {
    stdio: 'inherit',
    shell: true
  })
} finally {
  if (stashed) renameSync(STASH_FILE, DEV_ENV_FILE)
}
