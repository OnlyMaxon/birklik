'use client'

import NextLink, {type LinkProps as NextLinkProps} from 'next/link'
import {useParams as useNextParams, usePathname, useRouter, useSearchParams as useNextSearchParams} from 'next/navigation'
import {useEffect, type AnchorHTMLAttributes, type ReactNode} from 'react'
import {DEFAULT_LOCALE, localeFromPath, localizePath, stripLocalePrefix} from '@/lib/locale-routes'

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> &
  Omit<NextLinkProps, 'href'> & {to: NextLinkProps['href']; children?: ReactNode}

/**
 * Сохраняет язык в ссылке.
 *
 * Все ссылки сайта идут через эту обёртку, поэтому язык подставляется в одном
 * месте. Берётся он из адреса текущей страницы, а не из состояния: на сервере
 * состояния ещё нет, и при первом рендере ссылки уехали бы на азербайджанский.
 *
 * Нелокализованные адреса (объявление, кабинет) возвращаются нетронутыми —
 * там язык по-прежнему из куки, см. locale-routes.
 */
function useLocalizedHref(to: NextLinkProps['href']): NextLinkProps['href'] {
  const pathname = usePathname()
  if (typeof to !== 'string' || !to.startsWith('/')) return to
  const locale = localeFromPath(pathname) ?? DEFAULT_LOCALE
  return localizePath(to, locale)
}

export function Link({to, ...props}: LinkProps) {
  const href = useLocalizedHref(to)
  return <NextLink href={href} {...props} />
}

type NavLinkProps = Omit<LinkProps, 'className'> & {
  end?: boolean
  className?: string | ((state: {isActive: boolean}) => string)
}

export function NavLink({to, end = false, className, ...props}: NavLinkProps) {
  const pathname = usePathname()
  const href = useLocalizedHref(to)
  // Сравниваем без языкового префикса, иначе на /ru/about пункт «О нас»
  // перестал бы подсвечиваться как активный.
  const currentPath = stripLocalePrefix(pathname)
  const target = stripLocalePrefix(typeof to === 'string' ? to.split('?')[0] : String(to))
  const isActive = end ? currentPath === target : currentPath.startsWith(target)
  const resolvedClassName = typeof className === 'function' ? className({isActive}) : className
  return <NextLink href={href} className={resolvedClassName} {...props} />
}

export function useNavigate() {
  const router = useRouter()
  const pathname = usePathname()
  const locale = localeFromPath(pathname) ?? DEFAULT_LOCALE
  return (to: string | number, options?: {replace?: boolean}) => {
    if (typeof to === 'number') {
      if (to < 0) router.back()
      else router.forward()
      return
    }
    // Переходы кодом тоже обязаны сохранять язык, иначе с /ru/ любой
    // router.push увозил бы на азербайджанскую версию.
    const target = to.startsWith('/') ? localizePath(to, locale) : to
    if (options?.replace) router.replace(target)
    else router.push(target)
  }
}

export function useLocation() {
  const pathname = usePathname()
  const searchParams = useNextSearchParams()
  const search = searchParams.toString()
  return {pathname, search: search ? `?${search}` : '', hash: ''}
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string>>() {
  return useNextParams() as T
}

export function useSearchParams(): [URLSearchParams, (next: URLSearchParams) => void] {
  const params = useNextSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  return [new URLSearchParams(params.toString()), next => router.replace(`${pathname}?${next.toString()}`)]
}

export function Navigate({to, replace}: {to: string; replace?: boolean}) {
  const router = useRouter()
  useEffect(() => {
    if (replace) router.replace(to)
    else router.push(to)
  }, [replace, router, to])
  return null
}
