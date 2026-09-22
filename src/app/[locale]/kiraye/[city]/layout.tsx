import {notFound} from 'next/navigation'
import {cityFromSlug} from '@/lib/city-landing'

/**
 * Существует ли такой регион — решается здесь, а не только на странице.
 *
 * Тот же приём, что у `property/[id]/layout.tsx`, и по той же причине. Рядом
 * лежит `loading.tsx`, он создаёт границу Suspense, и оболочка уходит клиенту
 * сразу — с кодом 200, ещё до того как страница успеет вызвать `notFound()`.
 * Заголовки отправлены, менять статус нечем: посетитель видел правильную
 * страницу «не найдено», а поисковик получал 200 и считал адрес рабочим.
 *
 * Layout рендерится ДО границы Suspense: пока он не досчитан, ответ не уходит.
 * Значит `notFound()` отсюда выставляет настоящий 404 — и скелет ожидания при
 * этом сохраняется, чего не вышло бы, просто удалив `loading.tsx`.
 *
 * Лишнего запроса это не стоит: `cityFromSlug` ищет по справочнику городов в
 * памяти, в Firestore не ходит.
 *
 * ⚠️ Пустой регион здесь НЕ отсеивается. Город из справочника без объявлений —
 * живая страница со списком соседних регионов; от индексации её закрывает
 * `noindex` в `generateMetadata`. Проверять наличие объявлений пришлось бы
 * запросом в Firestore до границы Suspense, то есть ценой потоковой отдачи.
 */
export default async function CityLandingLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{city: string}>
}) {
  if (!cityFromSlug((await params).city)) notFound()

  return <>{children}</>
}
