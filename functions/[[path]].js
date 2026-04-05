export async function onRequest(context) {
  const { request, env } = context;
  const response = await env.ASSETS.fetch(request);

  // Если файл не найден (404), отдаем содержимое index.html
  if (response.status === 404) {
    const url = new URL(request.url);
    url.pathname = '/index.html';
    return env.ASSETS.fetch(new Request(url.toString(), request));
  }

  return response;
}