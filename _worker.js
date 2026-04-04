/**
 * Cloudflare Worker for SPA routing
 * Handles all requests and serves index.html for 404s on non-file routes
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Only handle GET requests
    if (request.method !== 'GET') {
      return fetch(request);
    }

    // Pass through static assets and files
    if (
      pathname.startsWith('/assets/') ||
      pathname.startsWith('/brand/') ||
      /\.[a-zA-Z0-9]+$/.test(pathname)
    ) {
      return fetch(request);
    }

    // Try to fetch the requested resource
    const response = await fetch(request);

    // If it's a 404 and not a file request, serve index.html
    if (response.status === 404) {
      const indexUrl = new URL('/index.html', url);
      const indexResponse = await fetch(new Request(indexUrl, request));

      if (indexResponse.status === 200) {
        return new Response(indexResponse.body, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      }
    }

    return response;
  }
};


