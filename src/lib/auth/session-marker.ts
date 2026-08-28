// Метку серверной сессии читает браузер, поэтому имя живёт отдельно от
// session.ts: тот помечен 'server-only' и в клиентский бандл не тянется.
export const SESSION_MARKER_COOKIE_NAME = 'session_state'

/**
 * Считает ли сервер этого посетителя вошедшим.
 *
 * Только подсказка для сверки состояний, не проверка доступа: метка не подписана
 * и правится из консоли за секунду. Всё, на что она влияет, — сходить ли на
 * сервер за разлогиниванием.
 */
export function hasServerSessionMarker(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie
    .split(';')
    .some(entry => entry.trim().startsWith(`${SESSION_MARKER_COOKIE_NAME}=`))
}

// Кука сессии httpOnly, и у тех, кто застрял до появления метки, разглядеть её
// скриптом нечем. Поэтому один раз на браузер разлогиниваемся вслепую и
// запоминаем это, чтобы не слать лишний запрос при каждом заходе гостя.
const LEGACY_SWEEP_STORAGE_KEY = 'birklik.staleSessionSweep.v1'

export function legacySweepDone(): boolean {
  try {
    return localStorage.getItem(LEGACY_SWEEP_STORAGE_KEY) === '1'
  } catch {
    // Хранилище недоступно — считаем, что подчистка была: лучше не тронуть
    // куку, чем ходить на сервер на каждой загрузке страницы.
    return true
  }
}

export function markLegacySweepDone(): void {
  try {
    localStorage.setItem(LEGACY_SWEEP_STORAGE_KEY, '1')
  } catch {
    // Не записалось — не страшно, капкан снят и без этого.
  }
}
