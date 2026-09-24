import {ContentPageSkeleton} from '@/components'

/**
 * Заглушка своя, как и у остальных информационных страниц.
 *
 * Корневой `src/app/loading.tsx` удалён вместе с переходом на Workers Paid: он
 * был один на всё приложение и отменял честные коды ответа ниже по дереву.
 * Правило с тех пор простое — заглушку класть в тот же сегмент, что и страницу.
 */
export default function Loading() {
  return <ContentPageSkeleton />
}
