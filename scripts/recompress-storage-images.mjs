/**
 * Пережимает изображения в Firebase Storage, которые лежат там как PNG.
 *
 * Зачем: canvas.toBlob в браузерах без кодирования webp молча отдавал PNG, а код
 * всё равно называл файл .webp. Такие снимки весят 1–2 МБ вместо 60 КБ и дают
 * ~80% объёма хранилища. Приток остановлен в коде, здесь разбираем накопленное.
 *
 * Запуск (из корня проекта, нужен serviceAccountKey.json рядом):
 *
 *   node scripts/recompress-storage-images.mjs               сухой прогон, ничего не меняет
 *   node scripts/recompress-storage-images.mjs --execute --limit 5
 *   node scripts/recompress-storage-images.mjs --execute     все найденные
 *
 * Ключи:
 *   --execute        реально перезаписать файлы (без него только отчёт)
 *   --limit N        обработать не больше N файлов
 *   --backup DIR     куда сложить оригиналы (по умолчанию storage-backup/png-originals,
 *                    эта папка уже в .gitignore и не попадает в пакет деплоя функций)
 *
 * ВАЖНО: в метаданных объекта лежит firebaseStorageDownloadTokens — это тот самый
 * ?token= из ссылок, сохранённых в Firestore. Скрипт переносит его на новый файл,
 * иначе все ссылки на это фото перестанут открываться.
 */

import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'

const BUCKET = 'birklik-65289.firebasestorage.app'
const PREFIXES = ['properties/', 'avatars/']

// Те же параметры, что и при загрузке из браузера: длинная сторона 900, webp q75.
const MAX_SIDE = 900
const QUALITY = 75

const args = process.argv.slice(2)
const EXECUTE = args.includes('--execute')
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || Infinity
const BACKUP_DIR = args.includes('--backup') ? args[args.indexOf('--backup') + 1] : 'storage-backup/png-originals'

const kb = n => `${Math.round(n / 1024)} КБ`
const mb = n => `${Math.round((n / 1024 / 1024) * 10) / 10} МБ`

// --- доступ ------------------------------------------------------------------

const sa = JSON.parse(readFileSync('serviceAccountKey.json', 'utf8'))
const b64 = i => Buffer.from(i).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function getToken() {
  const scope = EXECUTE
    ? 'https://www.googleapis.com/auth/devstorage.read_write'
    : 'https://www.googleapis.com/auth/devstorage.read_only'
  const iat = Math.floor(Date.now() / 1000)
  const input = `${b64(JSON.stringify({alg: 'RS256', typ: 'JWT'}))}.${b64(
    JSON.stringify({iss: sa.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600})
  )}`
  const sig = crypto.sign('RSA-SHA256', Buffer.from(input), sa.private_key)
  const assertion = `${input}.${sig.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion})
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Не удалось получить токен: ${JSON.stringify(data).slice(0, 200)}`)
  return data.access_token
}

let token = await getToken()

const api = (endpoint, init = {}) =>
  fetch(`https://storage.googleapis.com${endpoint}`, {
    ...init,
    headers: {Authorization: `Bearer ${token}`, ...init.headers}
  })

// --- поиск PNG ---------------------------------------------------------------

async function listObjects() {
  const out = []
  for (const prefix of PREFIXES) {
    let pageToken
    do {
      const url = new URL(`https://storage.googleapis.com/storage/v1/b/${BUCKET}/o`)
      url.searchParams.set('prefix', prefix)
      url.searchParams.set('fields', 'items(name,size,contentType),nextPageToken')
      url.searchParams.set('maxResults', '1000')
      if (pageToken) url.searchParams.set('pageToken', pageToken)

      const res = await fetch(url, {headers: {Authorization: `Bearer ${token}`}})
      const body = await res.json()
      if (!res.ok) throw new Error(`Список объектов: ${res.status} ${JSON.stringify(body).slice(0, 200)}`)

      for (const o of body.items ?? []) out.push({name: o.name, size: Number(o.size), type: o.contentType})
      pageToken = body.nextPageToken
    } while (pageToken)
  }
  return out
}

const mediaUrl = name => `/storage/v1/b/${BUCKET}/o/${encodeURIComponent(name)}?alt=media`

/** PNG определяем по сигнатуре файла, а не по расширению: имена тут врут. */
async function isPng(name) {
  const res = await api(mediaUrl(name), {headers: {Range: 'bytes=0-7'}})
  if (!res.ok) return false
  const head = Buffer.from(await res.arrayBuffer())
  return head[0] === 0x89 && head.toString('ascii', 1, 4) === 'PNG'
}

async function download(name) {
  const res = await api(mediaUrl(name))
  if (!res.ok) throw new Error(`Скачивание ${name}: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

/** Метаданные нужны целиком: в них токен скачивания из ссылок Firebase. */
async function getMetadata(name) {
  const res = await api(`/storage/v1/b/${BUCKET}/o/${encodeURIComponent(name)}`)
  if (!res.ok) throw new Error(`Метаданные ${name}: ${res.status}`)
  return res.json()
}

const recompress = buf =>
  sharp(buf)
    .resize({width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true})
    .webp({quality: QUALITY})
    .toBuffer()

async function upload(name, buf, meta) {
  const url =
    `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o` +
    `?uploadType=multipart&name=${encodeURIComponent(name)}`

  const boundary = `boundary${crypto.randomBytes(8).toString('hex')}`
  // Переносим пользовательские метаданные как есть — вместе с токеном скачивания.
  const descriptor = {
    name,
    contentType: 'image/webp',
    cacheControl: meta.cacheControl,
    metadata: meta.metadata
  }

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
    Buffer.from(JSON.stringify(descriptor)),
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: image/webp\r\n\r\n`),
    buf,
    Buffer.from(`\r\n--${boundary}--`)
  ])

  const res = await api(url.replace('https://storage.googleapis.com', ''), {
    method: 'POST',
    headers: {'Content-Type': `multipart/related; boundary=${boundary}`},
    body
  })
  if (!res.ok) throw new Error(`Загрузка ${name}: ${res.status} ${(await res.text()).slice(0, 200)}`)
}

// --- прогон ------------------------------------------------------------------

console.log(EXECUTE ? '=== РЕЖИМ ЗАПИСИ ===' : '=== СУХОЙ ПРОГОН, ничего не меняется ===')
console.log(`бакет: ${BUCKET}\n`)

const all = await listObjects()
console.log(`объектов всего: ${all.length}, ${mb(all.reduce((s, f) => s + f.size, 0))}`)

// Мелкие файлы почти наверняка уже webp — не тратим на них запросы.
const candidates = all.filter(f => f.size >= 200 * 1024)
console.log(`крупнее 200 КБ: ${candidates.length} — проверяю сигнатуры…`)

const pngs = []
for (const f of candidates) {
  if (await isPng(f.name)) pngs.push(f)
}

const pngBytes = pngs.reduce((s, f) => s + f.size, 0)
console.log(`\nиз них PNG: ${pngs.length} шт, ${mb(pngBytes)}`)
if (!pngs.length) {
  console.log('пережимать нечего')
  process.exit(0)
}

const targets = pngs.sort((a, b) => b.size - a.size).slice(0, LIMIT === Infinity ? pngs.length : LIMIT)

if (!EXECUTE) {
  // Считаем настоящий коэффициент на выборке, а не гадаем.
  const sample = targets.slice(0, Math.min(5, targets.length))
  let before = 0
  let after = 0
  console.log('\nпробное пережатие выборки:')
  for (const f of sample) {
    const buf = await download(f.name)
    const out = await recompress(buf)
    before += buf.length
    after += out.length
    console.log(`  ${kb(buf.length).padStart(9)} → ${kb(out.length).padStart(8)}   ${f.name.slice(-46)}`)
  }
  const ratio = after / before
  console.log(`\nкоэффициент на выборке: ${Math.round(ratio * 100)}% от исходного`)
  console.log(`прогноз для ${targets.length} файлов: ${mb(pngBytes)} → примерно ${mb(pngBytes * ratio)}`)
  console.log(`экономия около ${mb(pngBytes * (1 - ratio))}`)
  console.log('\nзапустить с --execute, чтобы применить. Оригиналы сохранятся в', BACKUP_DIR)
  process.exit(0)
}

if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, {recursive: true})

let done = 0
let freed = 0
let failed = 0

for (const f of targets) {
  try {
    const meta = await getMetadata(f.name)
    const original = await download(f.name)
    const compressed = await recompress(original)

    if (compressed.length >= original.length) {
      console.log(`  пропуск (не стало легче): ${f.name.slice(-46)}`)
      continue
    }

    // Копия оригинала на диск — чтобы откат не зависел от Google.
    const backupPath = path.join(BACKUP_DIR, f.name.replace(/[/\\]/g, '_'))
    writeFileSync(backupPath, original)

    await upload(f.name, compressed, meta)

    done += 1
    freed += original.length - compressed.length
    console.log(`  ${kb(original.length).padStart(9)} → ${kb(compressed.length).padStart(8)}   ${f.name.slice(-46)}`)
  } catch (error) {
    failed += 1
    console.log(`  ОШИБКА ${f.name.slice(-46)}: ${error.message}`)
  }
}

console.log(`\nпережато: ${done}, ошибок: ${failed}, освобождено ${mb(freed)}`)
console.log(`оригиналы лежат в ${BACKUP_DIR}`)
