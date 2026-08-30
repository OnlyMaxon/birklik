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
 * ⚠️ Сейчас это не работает, и не по своей вине: в корне приложения лежит
 * `src/app/loading.tsx`, он открывает поток ещё раньше. Стоит он там вынужденно
 * — на нём держится запас по процессорному времени тарифа Workers Free.
 * Проверка ниже остаётся готовой к включению: удалить корневой файл после
 * перехода на платный тариф, и 404 заработают без единой правки здесь.
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
