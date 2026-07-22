import {ProtectedRoute} from '@/components/route-guards'
export default function DashboardLayout({children}: {children: React.ReactNode}) { return <ProtectedRoute>{children}</ProtectedRoute> }
