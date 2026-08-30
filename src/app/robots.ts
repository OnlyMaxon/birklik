import type {MetadataRoute} from 'next'

const SITE_URL = 'https://birklik.az'

// Личный кабинет и страницы входа индексировать незачем: содержимое либо
// приватное, либо одинаковое для всех. Ссылка на подтверждение почты и сброс
// пароля вообще одноразовая.
const DISALLOW = ['/dashboard', '/login', '/register', '/verify-email', '/auth/', '/api/']

// Сборщики данных для ИИ-поиска. Формально их покрывает правило для «*», но
// перечисляем поимённо, и вот почему: у части из них поведение по умолчанию
// зависит от площадки-посредника, а некоторые (Google-Extended,
// Applebot-Extended) вообще не занимаются обходом — это переключатели, можно ли
// использовать уже собранное для обучения и для ответов помощника. Молчание
// robots.txt они трактуют по-своему, явное разрешение — однозначно.
//
// Нам это выгодно: объявления живут неделями, площадка молодая, и упоминание в
// ответе ChatGPT или Gemini приводит людей раньше, чем обычная выдача успевает
// нас поднять.
const AI_AGENTS = [
  'GPTBot', // OpenAI, обучение
  'OAI-SearchBot', // OpenAI, поиск в ChatGPT
  'ChatGPT-User', // переход по ссылке из ответа ChatGPT
  'ClaudeBot', // Anthropic, обход
  'Claude-User', // Anthropic, переход по ссылке из ответа
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended', // Gemini и Vertex: не обходчик, а разрешение на использование
  'Applebot-Extended', // Apple Intelligence, тоже разрешение
  'Amazonbot',
  'Bytespider',
  'CCBot', // Common Crawl — из него учится половина остальных
  'meta-externalagent',
  'cohere-ai'
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {userAgent: '*', allow: '/', disallow: DISALLOW},
      ...AI_AGENTS.map(userAgent => ({userAgent, allow: '/', disallow: DISALLOW}))
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  }
}
