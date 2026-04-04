/**
 * Cloudflare Pages route handler for SPA
 * Default route for all requests - serves index.html for SPA
 */

export const onRequest: PagesFunction = async ({ request, next }) => {
  const url = new URL(request.url);

  // For all requests that aren't files, check if file exists
  // If not, return index.html for React Router
  const response = await next();
  
  // If 404 and not a file request, serve index.html
  if (response.status === 404) {
    const pathname = url.pathname;
    
    // Check if it looks like a file
    if (!pathname.includes('.') && pathname !== '/') {
      //  It's likely a route - serve index.html
      const indexResponse = await next({
        request: new Request(new URL('/index.html', url))
      });
      
      if (indexResponse.ok) {
        return new Response(indexResponse.body, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      }
    }
  }
  
  return response;
};
