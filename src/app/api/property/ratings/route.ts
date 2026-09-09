import {verifyIdToken} from '@/lib/auth/id-token'
import {addRating} from '@/app/property/[id]/lib/interactions'

/**
 * Оценка объявления из мобильного приложения.
 *
 * Устроено так же, как соседний адрес для комментариев, и по той же причине:
 * поля `ratings`, `rating` и `reviews` правила клиенту писать не дают — иначе
 * оценку можно было бы выставить на чужом объявлении не останавливаясь в нём.
 *
 * Проверку «оценивает тот, кто здесь жил» делает общая `addRating`, а не этот
 * обработчик: она одна на сайт и приложение.
 */
export async function POST(request: Request): Promise<Response> {
  const actor = await verifyIdToken(request)
  if (!actor) {
    return Response.json({success: false, error: 'not-authenticated'}, {status: 401})
  }

  if (!actor.emailVerified) {
    return Response.json({success: false, error: 'email-not-verified'}, {status: 403})
  }

  let body: {propertyId?: unknown; rating?: unknown}
  try {
    body = (await request.json()) as typeof body
  } catch {
    return Response.json({success: false, error: 'invalid-input'}, {status: 400})
  }

  const result = await addRating(
    {uid: actor.uid},
    String(body.propertyId ?? ''),
    Number(body.rating)
  )

  return Response.json(result, {status: result.success ? 200 : 400})
}
