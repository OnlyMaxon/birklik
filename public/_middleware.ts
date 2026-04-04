export const onRequest = async (context) => {
  const { request, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Skip static assets
  if (pathname.startsWith('/assets/') || pathname.startsWith('/brand/') || /\.[a-z0-9]+$/i.test(pathname)) {
    return next();
  }

  // Try to get the resource
  const response = await next();

  // If 404 and it doesn't have a file extension, serve index.html
  if (response.status === 404 && !pathname.includes('.')) {
    try {
      const indexRequest = new Request(new URL('/index.html', url));
      const indexResponse = await next({ request: indexRequest });

      return new Response(indexResponse.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    } catch (error) {
      console.error('Error serving index.html:', error);
    }
  }

  return response;
};
