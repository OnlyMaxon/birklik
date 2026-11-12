import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase/client'
import type { MonthlyRevenue } from '@birklik/core/types'

/**
 * Выручка площадки по месяцам — для вкладки модераторки.
 *
 * Документы собирает триггер `recordRevenue` в функциях, по журналу платежей.
 * Отсюда коллекция только читается: правила Firestore запрещают запись в неё
 * ВСЕМ, включая модератора.
 *
 * Порядок считается в памяти, а не запросом: месяцев тут десятки за всю жизнь
 * площадки, и ради них заводить `orderBy` незачем — а имя документа само по
 * себе сортируется как дата (`2026-11` после `2026-09`).
 *
 * Отказ отдаёт пустой список, а не бросает: вкладка выручки не должна ронять
 * остальную модераторку. Что это именно отказ, а не «покупок не было», видно
 * по второму значению.
 */
export const getRevenueMonths = async (): Promise<{months: MonthlyRevenue[]; failed: boolean}> => {
	try {
		const snapshot = await getDocs(collection(db, 'revenue'))
		const months = snapshot.docs
			.map(document => ({month: document.id, ...document.data()}) as MonthlyRevenue)
			.sort((a, b) => b.month.localeCompare(a.month))
		return {months, failed: false}
	} catch {
		return {months: [], failed: true}
	}
}
