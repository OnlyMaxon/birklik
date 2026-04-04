/**
 * Cloudflare Pages function for SPA routing
 * This handles all requests and serves index.html for non-asset routes
 */

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  // For asset files and files with extensions, use default behavior  
  if (pathname.startsWith('/assets/) ||
      pathname.startsWith('/brand/') ||
      /\.[a-zA-Z0-9]+$/.test(pathname)) {
    return context.next();
  }

  // For routes (paths without file extension), serve index.html
  try {
    // Try to get the actual file first
    const response = await context.next();
    
    if (response.status === 404 && !pathname.includes('.')) {
      // It's a 404 and no file extension, so it's a route - serve index.html
      const indexResponse = await context.next({
        data: {},
      });
      
      return new Response(indexResponse.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }
    
    return response;
  } catch (e) {
    // On error, serve index.html
    return new Response(await context.next().then(r => r.text()), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
}


