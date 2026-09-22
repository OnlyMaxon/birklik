import {notFound} from 'next/navigation'
import {getPropertyMetadata} from './queries'
import {propertyIdSchema} from './validators'

/**
 * Существует ли объявление — решается здесь, а не только на странице.
 *
 * Причина в том, как Next отправляет ответ. Рядом лежит `loading.tsx`, он
 * создаёт границу Suspense, и оболочка уходит клиенту сразу — с кодом 200, ещё
 * до того как страница сходит в Firestore и вызовет `notFound()`. Заголовки уже
 * отправлены, менять статус нечем: посетитель видел правильную страницу «не
 * найдено», а поисковик получал обычный ответ 200 и считал адрес рабочим.
 *
 * Layout рендерится ДО границы Suspense: пока он не досчитан, ответ не уходит.
 * Значит `notFound()` отсюда успевает выставить настоящий 404 — и при этом
 * скелет ожидания сохраняется, чего не вышло бы, просто удалив `loading.tsx`.
 *
 * До 2026-09-22 проверка не работала, и не по своей вине: в корне приложения
 * лежал `src/app/loading.tsx`, он открывал поток ещё раньше. Стоял он там
 * вынужденно — на нём держался запас по процессорному времени тарифа Workers
 * Free. С переходом на Workers Paid корневой файл удалён, и 404 заработали без
 * единой правки здесь.
 *
 * ⚠️ Отсюда общее правило: **`loading.tsx` выше по дереву отменяет честные коды
 * ответа ниже.** Заводя новую заглушку, ставить её в тот же сегмент, что и
 * страницу, а не в общий родительский.
 *
 * Лишнего запроса это не стоит: `getPropertyMetadata` закэширован, и страница с
 * `generateMetadata` берут тот же результат.
 */
export default async function PropertyIdLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{id: string}>
}) {
  const parsedId = propertyIdSchema.safeParse((await params).id)
  if (!parsedId.success) notFound()

  const property = await getPropertyMetadata(parsedId.data)
  if (!property) notFound()

  return <>{children}</>
}
