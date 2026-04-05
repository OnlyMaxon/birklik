export async function onRequest(context) {
  const { request, env } = context;
  
  // 1. Пытаемся получить запрошенную страницу/файл
  const response = await env.ASSETS.fetch(request);

  // 2. Если файл не найден (404)
  if (response.status === 404) {
    // Создаем новый URL, указывающий строго на корень /index.html
    const url = new URL(request.url);
    url.pathname = '/index.html';
    
    // Делаем новый запрос именно к корню
    return env.ASSETS.fetch(new Request(url.toString(), request));
  }

  // 3. Если файл найден (картинка, js, css или главная), просто отдаем его
  return response;
}