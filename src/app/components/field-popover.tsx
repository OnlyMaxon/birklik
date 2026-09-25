'use client'

import React from 'react'
import ReactDOM from 'react-dom'

/**
 * Выпадающая панель поля поиска, вынесенная в портал к `document.body`.
 *
 * ⚠️ Портал здесь не для красоты. Панель обязана рисоваться ПОВЕРХ раздела с
 * объявлениями, а обычным `position: absolute` этого не добиться: строка поиска
 * лежит внутри `.hero`, а у него `overflow: hidden`. Всё, что свисает ниже
 * обложки, просто обрезается — со стороны это выглядит как «подсказки уехали
 * под сетку объявлений», хотя `z-index` у них и так больше. Поднимать `z-index`
 * бесполезно: обрезка к порядку наложения отношения не имеет.
 *
 * Заодно снимается вторая помеха: `.hero-content` с `position: relative` и
 * `z-index: 1` создаёт свой контекст наложения, внутри которого никакой
 * `z-index` дочернего элемента не может перебить соседей обложки.
 *
 * Панель позиционируется от привязки через `getBoundingClientRect`, поэтому
 * пересчитывается на прокрутке и изменении размера окна. Прокрутка слушается с
 * перехватом (`capture`), иначе прокрутка внутри любого предка панель не
 * подвинет.
 */

type Placement = {
  left: number
  width: number
  maxHeight: number
  top?: number
  bottom?: number
}

const GAP = 4
const VIEWPORT_MARGIN = 8
/** Ниже этого панель вниз не раскрывается — вместо того раскрывается вверх. */
const MIN_ROOM_BELOW = 150

interface FieldPopoverProps {
  anchorRef: React.RefObject<HTMLElement | null>
  open: boolean
  children: React.ReactNode
  /** Опознавательная роль списка; у подсказок и выбора гостей она одна. */
  role?: string
  id?: string
  className?: string
  minWidth?: number
  /** Вызывается по Escape и по нажатию вне панели и привязки. */
  onDismiss?: () => void
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>
}

export const FieldPopover: React.FC<FieldPopoverProps> = ({
  anchorRef,
  open,
  children,
  role = 'listbox',
  id,
  className = '',
  minWidth = 0,
  onDismiss,
  onKeyDown
}) => {
  const [placement, setPlacement] = React.useState<Placement | null>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)

  // ⚠️ Именно useEffect, а не useLayoutEffect: строка поиска отдаётся с сервера,
  // а useLayoutEffect на сервере ругается. Панель не рисуется, пока положение не
  // посчитано, поэтому мигания в углу экрана всё равно не будет.
  React.useEffect(() => {
    if (!open) {
      setPlacement(null)
      return
    }

    const update = () => {
      const anchor = anchorRef.current
      if (!anchor) return

      const rect = anchor.getBoundingClientRect()
      const roomBelow = window.innerHeight - rect.bottom - GAP - VIEWPORT_MARGIN
      const roomAbove = rect.top - GAP - VIEWPORT_MARGIN
      const openUp = roomBelow < MIN_ROOM_BELOW && roomAbove > roomBelow

      const width = Math.min(
        Math.max(rect.width, minWidth),
        window.innerWidth - VIEWPORT_MARGIN * 2
      )
      const left = Math.min(
        Math.max(rect.left, VIEWPORT_MARGIN),
        Math.max(window.innerWidth - width - VIEWPORT_MARGIN, VIEWPORT_MARGIN)
      )

      setPlacement({
        left,
        width,
        maxHeight: Math.max(openUp ? roomAbove : roomBelow, 120),
        ...(openUp
          ? {bottom: Math.max(window.innerHeight - rect.top + GAP, VIEWPORT_MARGIN)}
          : {top: rect.bottom + GAP})
      })
    }

    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, anchorRef, minWidth])

  React.useEffect(() => {
    if (!open || !onDismiss) return

    // Имя нарочно не onKeyDown: так называется свойство панели, и затенять его
    // здесь значило бы путать два разных обработчика.
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (panelRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onDismiss()
    }

    document.addEventListener('keydown', onEscape)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onEscape)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, onDismiss, anchorRef])

  // Выбранное значение показывается сразу, без прокрутки руками: список гостей
  // доходит до «10+», и открывать его на единице, когда выбрано восемь, — та же
  // потеря, что была у системного селектора.
  //
  // ⚠️ Прокручивается сама панель, а не через scrollIntoView: тот уводит и
  // страницу, а страница здесь — главный экран под обложкой.
  React.useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const selected = panel.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!selected) return
    panel.scrollTop = Math.max(selected.offsetTop - (panel.clientHeight - selected.offsetHeight) / 2, 0)
  }, [placement])

  if (!open || !placement) return null

  return ReactDOM.createPortal(
    <div
      ref={panelRef}
      id={id}
      role={role}
      className={`field-popover ${className}`.trim()}
      onKeyDown={onKeyDown}
      style={{
        left: placement.left,
        width: placement.width,
        maxHeight: placement.maxHeight,
        ...(placement.top !== undefined ? {top: placement.top} : {}),
        ...(placement.bottom !== undefined ? {bottom: placement.bottom} : {})
      }}
    >
      {children}
    </div>,
    document.body
  )
}

/**
 * Перевод фокуса стрелками внутри панели.
 *
 * Клавиатура здесь не прихоть: системный `<select>`, который панель заменяет,
 * стрелками работал. Уйти от него, потеряв клавиатуру, значило бы сделать поле
 * хуже, а не лучше.
 */
export function moveFocusWithArrows(event: React.KeyboardEvent<HTMLElement>): boolean {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return false

  const container = event.currentTarget
  const options = Array.from(container.querySelectorAll<HTMLElement>('[data-popover-option]'))
  if (options.length === 0) return false

  const current = options.indexOf(document.activeElement as HTMLElement)
  const step = event.key === 'ArrowDown' ? 1 : -1
  const next = current < 0
    ? (step === 1 ? 0 : options.length - 1)
    : (current + step + options.length) % options.length

  event.preventDefault()
  options[next].focus()
  return true
}
