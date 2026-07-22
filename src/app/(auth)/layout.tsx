import {AuthRoute} from '@/components/route-guards'
export default function AuthLayout({children}: {children: React.ReactNode}) { return <AuthRoute>{children}</AuthRoute> }
