import {getAccessToken} from '@/lib/firebase/google-auth'

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

    upstream = await fetch(upstreamUrl, {
      method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: upstreamHeaders,
      cache: 'no-store'
    })
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
    'X-Content-Type-Options': 'nosniff'
  })
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }

  // Passing the ReadableStream through avoids buffering the image in Worker memory.
  const body = request.method === 'HEAD' || upstream.status === 304 ? null : upstream.body
  return new Response(body, {status: upstream.status, headers})
}

export const GET = serveImage
export const HEAD = serveImage
