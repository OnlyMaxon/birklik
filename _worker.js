/**
 * Cloudflare Worker for serving SPA with proper routing
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // For non-GET requests, pass through
    if (request.method !== 'GET') {
      return fetch(request);
    }

    const pathname = url.pathname;

    // Skip asset routes - they should be served as-is
    if (pathname.startsWith('/assets/') || 
        pathname.startsWith('/brand/') ||
        /\.[a-zA-Z0-9]+$/.test(pathname)) { // Has file extension
      return fetch(request);
    }

    // For all other GET requests (routes without file extensions),
    // check if the file exists. If not, return index.html for SPA routing
    try {
      const response = await fetch(request);
      
      // If the asset exists, return it
      if (response.status !== 404) {
        return response;
      }

      // If it's a 404 and not a file request, serve index.html
      if (!pathname.includes('.')) {
        const indexUrl = new URL('/index.html', url.origin);
        return fetch(new Request(indexUrl, { headers: request.headers }));
      }

      return response;
    } catch (error) {
      // On error, try to serve index.html for SPA routing
      const indexUrl = new URL('/index.html', url.origin);
      return fetch(new Request(indexUrl, { headers: request.headers }));
    }
  }
};

