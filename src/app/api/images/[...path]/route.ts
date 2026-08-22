import {getCloudflareContext} from '@opennextjs/cloudflare'
import {getAccessToken} from '@/lib/firebase/google-auth'

/**
 * Общий кэш Cloudflare. Ответы, которые воркер собирает сам, на границе не
 * кэшируются автоматически — их нужно положить туда явно. В типах Next этого
 * объекта нет, поэтому достаём его из глобального окружения воркера.
 */
function edgeCache(): Cache | undefined {
  return (globalThis as {caches?: {default?: Cache}}).caches?.default
}

const CACHE_CONTROL = 'public, max-age=31536000, s-maxage=31536000, immutable'
const FORWARDED_REQUEST_HEADERS = ['range', 'if-none-match', 'if-modified-since'] as const
const FORWARDED_RESPONSE_HEADERS = [
  'accept-ranges',
  'content-length',
  'content-range',
  'content-type',
  'etag',
  'last-modified'
] as const

type RouteContext = {params: Promise<{path: string[]}>}

function isAllowedImagePath(path: string): boolean {
  const segments = path.split('/')
  return (
    (path.startsWith('properties/') || path.startsWith('avatars/')) &&
    segments.every(segment => segment !== '' && segment !== '.' && segment !== '..' && !segment.includes('\0'))
  )
}

async function serveImage(request: Request, context: RouteContext): Promise<Response> {
  const segments = (await context.params).path
  const storagePath = segments.join('/')

  if (!isAllowedImagePath(storagePath)) {
    return new Response('Invalid image path', {status: 400})
  }

  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim()
  if (!bucket) {
    return new Response('Image storage is not configured', {status: 503})
  }

  // Кэшируем только целые GET: у диапазонного запроса ответ 206 с куском файла,
  // класть его под общим ключом нельзя. Сбой кэша никогда не должен ломать
  // отдачу картинки, поэтому все обращения к нему обёрнуты.
  const cacheable = request.method === 'GET' && !request.headers.get('range')
  const cache = cacheable ? edgeCache() : undefined
  const cacheKey = new Request(request.url, {method: 'GET'})

  if (cache) {
    try {
      const hit = await cache.match(cacheKey)
      if (hit) return hit
    } catch {
      // промах по кэшу не повод отказывать в картинке
    }
  }

  const upstreamUrl =
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}` +
    `/o/${encodeURIComponent(storagePath)}?alt=media`

  let upstream: Response
  try {
    const upstreamHeaders = new Headers({Authorization: `Bearer ${await getAccessToken()}`})
    for (const name of FORWARDED_REQUEST_HEADERS) {
      const value = request.headers.get(name)
      if (value) upstreamHeaders.set(name, value)
    }

    // Кэшируем ответ Storage на границе Cloudflare. С 'no-store' воркер ходил
    // в Айову за каждым показом картинки: ответы, которые воркер собирает сам,
    // Cloudflare не кэширует, а файлы тут неизменяемые.
    upstream = await fetch(upstreamUrl, {
      method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: upstreamHeaders,
      cf: {cacheEverything: true, cacheTtl: 31536000}
    } as RequestInit)
  } catch {
    return new Response('Image storage is unavailable', {status: 502})
  }

  if (!upstream.ok && upstream.status !== 304) {
    // Do not expose Google Storage error bodies or internal object details.
    return new Response(upstream.status === 404 ? 'Image not found' : 'Unable to load image', {
      status: upstream.status === 404 ? 404 : 502,
      headers: {'Cache-Control': upstream.status === 404 ? 'public, max-age=60' : 'no-store'}
    })
  }

  const headers = new Headers({
    'Cache-Control': CACHE_CONTROL,
    'X-Content-Type-Options': 'nosniff',
    // Next подмешивает в ответ vary: rsc, next-router-state-tree и прочее —
    // для двоичной картинки это лишние измерения кэша. Задаём своё значение.
    Vary: 'Accept-Encoding'
  })
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }

  // Passing the ReadableStream through avoids buffering the image in Worker memory.
  const body = request.method === 'HEAD' || upstream.status === 304 ? null : upstream.body
  const response = new Response(body, {status: upstream.status, headers})

  if (cache && response.status === 200) {
    try {
      // Копия уходит в кэш параллельно с отдачей — пользователь не ждёт записи.
      getCloudflareContext().ctx.waitUntil(cache.put(cacheKey, response.clone()))
    } catch {
      // не удалось положить в кэш — отдаём картинку как есть
    }
  }

  return response
}

export const GET = serveImage
export const HEAD = serveImage
