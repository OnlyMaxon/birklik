import {PropertyCardSkeleton} from '@/components'
import './city-landing.css'

/**
 * Заглушка посадочной страницы региона.
 *
 * Заведена вместе с удалением корневого `src/app/loading.tsx`. Тот был один на
 * всё приложение и закрывал собой в том числе этот раздел — ценой кодов ответа:
 * поток открывался раньше, чем страница успевала решить, и выдуманный регион
 * отдавал 200. Теперь граница ожидания своя, а `layout.tsx` рядом проверяет
 * адрес ДО неё — скелет остался, 404 стал настоящим.
 *
 * ⚠️ Разметка повторяет `page.tsx`: те же классы `city-landing*`. Разъедутся —
 * страница дёрнется при подстановке содержимого. Стили импортируются и здесь:
 * заглушка уходит клиенту раньше, чем отрисуется страница.
 */
export default function CityLandingLoading() {
  return (
    <div className="city-landing container" aria-busy="true" aria-label="Loading">
      <div className="city-landing-crumbs">
        <div className="skeleton-line skeleton-shimmer" style={{height: '0.85rem', width: '8rem'}} />
      </div>

      <header className="city-landing-head">
        <div className="skeleton-line skeleton-shimmer" style={{height: '2rem', width: '55%'}} />
        <div className="skeleton-line skeleton-shimmer" style={{height: '0.95rem', width: '25%'}} />
        <div className="skeleton-line skeleton-shimmer" style={{height: '0.9rem', width: '100%'}} />
        <div className="skeleton-line skeleton-shimmer" style={{height: '0.9rem', width: '70%'}} />
      </header>

      <div className="city-landing-grid">
        {Array.from({length: 6}, (_, index) => <PropertyCardSkeleton key={index} />)}
      </div>
    </div>
  )
}
