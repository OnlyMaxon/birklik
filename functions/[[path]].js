/**
 * Cloudflare Pages function - catch all routes for SPA
 * Must be named [[path]].js or [[path]].ts to catch all routes
 */

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Skip static paths
  if (pathname.startsWith('/assets/') || pathname.startsWith('/brand/')) {
    return context.next();
  }

  // If it has a file extension, it's a file - try to serve it
  if (pathname.includes('.')) {
    return context.next();
  }

  // It's a potential SPA route
  const response = await context.next();

  // If the route exists, return it
  if (response.status !== 404) {
    return response;
  }

  // Route doesn't exist - serve index.html for React Router
  try {
    // Get the index.html file
    const indexResponse = await context.env.ASSETS.fetch(
      new URL('/index.html', url)
    );

    if (indexResponse.ok) {
      // Return with 200 status for SPA routing
      const buffer = await indexResponse.arrayBuffer();
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        }
      });
    }
  } catch (error) {
    console.error('[SPA] Error serving index.html:', error);
  }

  // Return original 404 as fallback
  return response;
}
