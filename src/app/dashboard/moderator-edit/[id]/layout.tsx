import {redirect} from 'next/navigation'
import {getSession} from '@/lib/auth/session'

export default async function EditLayout({children}: {children: React.ReactNode}) {
  const session = await getSession()
  if (!session?.moderator) redirect('/dashboard')
  return children
}
