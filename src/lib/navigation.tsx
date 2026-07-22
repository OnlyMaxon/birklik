'use client'

import NextLink, {type LinkProps as NextLinkProps} from 'next/link'
import {useParams as useNextParams, usePathname, useRouter, useSearchParams as useNextSearchParams} from 'next/navigation'
import {useEffect, type AnchorHTMLAttributes, type ReactNode} from 'react'

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> &
  Omit<NextLinkProps, 'href'> & {to: NextLinkProps['href']; children?: ReactNode}

export function Link({to, ...props}: LinkProps) {
  return <NextLink href={to} {...props} />
}

type NavLinkProps = Omit<LinkProps, 'className'> & {
  end?: boolean
  className?: string | ((state: {isActive: boolean}) => string)
}

export function NavLink({to, end = false, className, ...props}: NavLinkProps) {
  const pathname = usePathname()
  const target = typeof to === 'string' ? to.split('?')[0] : String(to)
  const isActive = end ? pathname === target : pathname.startsWith(target)
  const resolvedClassName = typeof className === 'function' ? className({isActive}) : className
  return <NextLink href={to} className={resolvedClassName} {...props} />
}

export function useNavigate() {
  const router = useRouter()
  return (to: string | number, options?: {replace?: boolean}) => {
    if (typeof to === 'number') {
      if (to < 0) router.back()
      else router.forward()
      return
    }
    if (options?.replace) router.replace(to)
    else router.push(to)
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
