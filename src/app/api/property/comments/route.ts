import {verifyIdToken} from '@/lib/auth/id-token'
import {addComment} from '@/app/property/[id]/lib/interactions'

/**
 * Комментарий к объявлению из мобильного приложения.
 *
 * Зачем этот адрес вообще нужен. Правила Firestore запрещают клиенту писать в
 * `comments` — раньше через это поле можно было переписать чужие отзывы. Сайт
 * обходит запрет тем, что пишет на сервере под сервис-аккаунтом; у приложения
 * своего сервера нет, поэтому оно обращается сюда.
 *
 * Логика — общая с сайтом (`addComment`), здесь только проверка, кто пришёл:
 * вместо сессионной куки браузера читаем токен входа из заголовка.
 */
export async function POST(request: Request): Promise<Response> {
  const actor = await verifyIdToken(request)
  if (!actor) {
    return Response.json({success: false, error: 'not-authenticated'}, {status: 401})
  }

  // Неподтверждённая почта — не полноценная учётная запись. На сайте до
  // комментариев такой человек не доходит: его удерживает экран подтверждения.
  if (!actor.emailVerified) {
    return Response.json({success: false, error: 'email-not-verified'}, {status: 403})
  }

  let body: {propertyId?: unknown; text?: unknown}
  try {
    body = (await request.json()) as typeof body
  } catch {
    return Response.json({success: false, error: 'invalid-input'}, {status: 400})
  }

  const result = await addComment(
    {uid: actor.uid},
    String(body.propertyId ?? ''),
    String(body.text ?? '')
  )

  // Отказ по существу — 400, а не 500: вход состоялся, просто просьба негодная.
  return Response.json(result, {status: result.success ? 200 : 400})
}
