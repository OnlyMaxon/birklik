'use client'

import React from 'react'
import {useLanguage} from '@/components/providers'
import './password-field.css'

type Props = Omit<React.ComponentPropsWithoutRef<'input'>, 'type'>

/**
 * Поле пароля с кнопкой-глазом.
 *
 * Обёртка вокруг обычного `input`, а не своя реализация поля: все атрибуты
 * пробрасываются как есть. Это важно для `autoComplete` — по нему менеджеры
 * паролей отличают вход (`current-password`) от регистрации (`new-password`),
 * и подменять его обёрткой нельзя.
 *
 * ⚠️ Кнопка обязана быть `type="button"`. Внутри формы кнопка без типа считается
 * отправляющей — нажатие на глаз отправляло бы форму.
 *
 * Состояние видимости живёт здесь и у каждого поля своё: в регистрации их два,
 * и показывать оба разом человек не просил.
 */
export const PasswordField = React.forwardRef<HTMLInputElement, Props>(
  function PasswordField({className, ...props}, ref) {
    const {language} = useLanguage()
    const [visible, setVisible] = React.useState(false)

    const label = visible
      ? language === 'en'
        ? 'Hide password'
        : language === 'ru'
          ? 'Скрыть пароль'
          : 'Şifrəni gizlət'
      : language === 'en'
        ? 'Show password'
        : language === 'ru'
          ? 'Показать пароль'
          : 'Şifrəni göstər'

    return (
      <div className="password-field">
        <input
          {...props}
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={className}
        />
        <button
          type="button"
          className="password-field__toggle"
          onClick={() => setVisible(v => !v)}
          // Поле выключено — выключен и глаз: показывать пароль там, где его
          // сейчас нельзя править, незачем, да и фокус на мёртвой кнопке сбивает.
          disabled={props.disabled}
          // Кнопка подписана только для читалок: на экране у неё значок.
          // `aria-pressed` сообщает, что это переключатель, а не действие.
          aria-label={label}
          aria-pressed={visible}
          title={label}
        >
          {visible ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
              <path d="M17.9 17.9A10.3 10.3 0 0 1 12 19c-6.5 0-10-7-10-7a18.5 18.5 0 0 1 5.1-5.9" />
              <path d="M9.9 5.2A9.5 9.5 0 0 1 12 5c6.5 0 10 7 10 7a18.6 18.6 0 0 1-2.2 3.2" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    )
  }
)
