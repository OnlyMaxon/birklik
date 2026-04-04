/**
 * Cloudflare Pages function - SPA routing handler
 * Redirects all non-file routes to index.html for React Router handoff
 */

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Skip static assets and files with extensions
  if (
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/brand/') ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return context.next();
  }

  // Try to serve the requested resource
  const response = await context.next();

  // If it exists, return it
  if (response.status !== 404) {
    return response;
  }

  // If 404 and it's not a file request, serve index.html
  if (!pathname.includes('.')) {
    // Return index.html for SPA routing
    return new Response(
      await context.next({
        request: new Request(new URL('/index.html', url))
      }).then(r => r.text()),
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600'
        }
      }
    );
  }

  return response;
}

