export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const pathname = url.pathname

    // Пропускаем API запросы
    if (pathname.startsWith('/api/')) {
      return fetch(request)
    }

    // Для всех GET запросов
    if (request.method === 'GET') {
      const response = await fetch(request)

      // Если это JS/CSS файл и вернулась ошибка с HTML MIME типом
      if ((pathname.endsWith('.js') || pathname.endsWith('.css'))) {
        const contentType = response.headers.get('content-type') || ''

        // Если сервер вернул HTML вместо JS/CSS - это 404
        if (response.status === 404 || contentType.includes('text/html')) {
          console.log(`[Worker] 404 or wrong MIME for ${pathname}: ${response.status} ${contentType}`)
          
          // Возвращаем правильный MIME тип и сообщение об ошибке
          const headers = new Headers(response.headers)
          if (pathname.endsWith('.js')) {
            headers.set('Content-Type', 'application/javascript; charset=utf-8')
          } else if (pathname.endsWith('.css')) {
            headers.set('Content-Type', 'text/css; charset=utf-8')
          }

          return new Response('/* Module not found */', {
            status: 404,
            headers,
          })
        }

        // Проверяем MIME для успешных ответов
        if (response.status === 200) {
          if (pathname.endsWith('.js') && !contentType.includes('application/javascript')) {
            console.error(`[Worker] Wrong MIME for JS: ${contentType} for ${pathname}`)
            const headers = new Headers(response.headers)
            headers.set('Content-Type', 'application/javascript; charset=utf-8')
            return new Response(await response.text(), {
              status: 200,
              headers,
            })
          }
          if (pathname.endsWith('.css') && !contentType.includes('text/css')) {
            console.error(`[Worker] Wrong MIME for CSS: ${contentType} for ${pathname}`)
            const headers = new Headers(response.headers)
            headers.set('Content-Type', 'text/css; charset=utf-8')
            return new Response(await response.text(), {
              status: 200,
              headers,
            })
          }
        }
      }

      return response
    }

    return fetch(request)
  },
}
