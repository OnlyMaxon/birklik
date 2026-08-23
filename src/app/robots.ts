import type {MetadataRoute} from 'next'

const SITE_URL = 'https://birklik.az'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Личный кабинет и страницы входа индексировать незачем: содержимое
      // либо приватное, либо одинаковое для всех. Ссылка на подтверждение
      // почты и сброс пароля вообще одноразовая.
      disallow: ['/dashboard', '/login', '/register', '/verify-email', '/auth/', '/api/']
    },
    sitemap: `${SITE_URL}/sitemap.xml`
  }
}
