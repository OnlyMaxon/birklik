/**
 * Cloudflare Pages route handler for SPA
 * Serves index.html for all non-file routes that return 404
 */

export const onRequest = async ({ request, next }) => {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // First, try to get the requested resource
  const response = await next();

  // If it exists, return it as-is
  if (response.status !== 404) {
    return response;
  }

  // If it's a 404, check if it's a route (no file extension)
  if (!pathname.includes('.')) {
    try {
      // It's a route - serve index.html instead
      const indexResponse = await next({
        request: new Request(new URL('/index.html', url))
      });

      if (indexResponse.status === 200) {
        // Return index.html with 200 status for SPA routing
        return new Response(indexResponse.body, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      }
    } catch (error) {
      console.error('[SPA Router] Error:', error);
    }
  }

  // Return the original 404
  return response;
};

