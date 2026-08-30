import 'server-only'
import {getLocale, getMessages, setRequestLocale} from 'next-intl/server'
import type {Language, Translations} from '@/types'

/**
 * Переводы для серверной страницы.
 *
 * **Страницам под сегментом `[locale]` язык надо передавать явно.** Казалось бы,
 * достаточно `setRequestLocale` в `[locale]/layout.tsx` — но рядом с этими
 * страницами лежит `loading.tsx`. Он создаёт границу Suspense, и страница
 * считается отдельным проходом, куда закреплённый в layout язык уже не доезжает:
 * next-intl откатывается на куку, а у робота её нет — и отдавался
 * азербайджанский. `/ru/about`, `/en/about`, `/ru/contact` и `/ru/terms` месяцами
 * показывали азербайджанский текст, хотя в карте сайта числились как русские и
 * английские. Для поиска это ровно дубликат.
 *
 * Заметно это не было, потому что главная и разделы регионов работали правильно:
 * у главной переводы идут через клиентский провайдер, а у регионов своего
 * `loading.tsx` нет.
 *
 * Без аргумента функция берёт язык из куки — так и надо нелокализованным
 * страницам (объявление, кабинет, вход).
 */
export async function getAppTranslations(locale?: string) {
  if (locale) setRequestLocale(locale)
  const language = (await getLocale()) as Language
  const messages = (await getMessages()) as {App: Translations}
  return {language, t: messages.App}
}
