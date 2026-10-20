import {getFunctions, httpsCallable} from 'firebase/functions'
import firebaseApp from '@/lib/firebase/client'

/**
 * Блокировка и разблокировка человека модератором.
 *
 * Вызываемая функция, а не запись в Firestore из браузера, и вариантов тут нет:
 * блокировка ставит ЗАЯВКУ В ТОКЕН (`setCustomUserClaims`), отзывает токены и
 * снимает объявления с витрины — всё это умеет только Admin SDK. Правила
 * Firestore вообще не дают браузеру писать поля `blocked*` ни себе, ни другому.
 *
 * ⚠️ Та же функция зовётся из приложения. Логика блокировки существует в
 * единственном экземпляре на сервере, и разъехаться двум клиентам не на чем.
 */

export interface BlockResult {
  /** Сколько объявлений сняла с витрины или вернула на неё эта операция. */
  listings: number
}

/**
 * @param userId  кого
 * @param blocked true — заблокировать, false — снять блокировку
 * @param reason  причина словами модератора; обязательна при блокировке,
 *                потому что человек увидит её у себя в кабинете
 */
export async function setUserBlocked(
  userId: string,
  blocked: boolean,
  reason: string
): Promise<BlockResult> {
  const fns = getFunctions(firebaseApp, 'europe-west1')
  const call = httpsCallable<
    {userId: string; blocked: boolean; reason: string},
    BlockResult
  >(fns, 'setUserBlocked')

  const {data} = await call({userId, blocked, reason})
  return data
}
