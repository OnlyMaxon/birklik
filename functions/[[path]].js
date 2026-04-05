export async function onRequest(context) {
  const response = await context.next();
  
  // Если Cloudflare не нашел физический файл (вернул 404),
  // мы принудительно отдаем index.html, но с кодом 200.
  if (response.status === 404) {
    const url = new URL('/index.html', context.request.url);
    return context.env.ASSETS.fetch(url);
  }
  
  return response;
}
