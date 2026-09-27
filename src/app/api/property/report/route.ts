import {verifyIdToken} from '@/lib/auth/id-token'
import {reportComment} from '@/app/property/[id]/lib/interactions'
import type {ReportReason} from '@birklik/core/types'

/**
 * Жалоба на отзыв из мобильного приложения.
 *
 * Устроен так же, как соседние `comments` и `ratings`, и по той же причине:
 * правила Firestore не дают клиенту писать в `commentReports`, а логика жалобы
 * — общая с сайтом (`reportComment`). Здесь только проверка, кто пришёл: вместо
 * сессионной куки браузера читаем токен входа из заголовка.
 *
 * ⚠️ Адрес появился ради правил Google Play: приложение с пользовательским
 * контентом обязано давать встроенный способ пожаловаться. До этого жалобу
 * можно было подать только с сайта, а очередь модерации в приложении её лишь
 * показывала.
 */
export async function POST(request: Request): Promise<Response> {
  const actor = await verifyIdToken(request)
  if (!actor) {
    return Response.json({success: false, error: 'not-authenticated'}, {status: 401})
  }

  // Неподтверждённая почта — не полноценная учётная запись, как и в отзывах.
  if (!actor.emailVerified) {
    return Response.json({success: false, error: 'email-not-verified'}, {status: 403})
  }

  let body: {
    propertyId?: unknown
    commentId?: unknown
    commentText?: unknown
    reason?: unknown
    details?: unknown
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return Response.json({success: false, error: 'invalid-input'}, {status: 400})
  }

  const result = await reportComment(
    {uid: actor.uid},
    String(body.propertyId ?? ''),
    String(body.commentId ?? ''),
    String(body.commentText ?? ''),
    String(body.reason ?? '') as ReportReason,
    body.details === undefined ? undefined : String(body.details)
  )

  // Отказ по существу — 400: вход состоялся, просто просьба негодная.
  // Повторная жалоба приходит сюда же с `error: 'duplicate'`.
  return Response.json(result, {status: result.success ? 200 : 400})
}
