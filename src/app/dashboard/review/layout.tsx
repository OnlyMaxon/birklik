import {ModeratorRoute} from '@/components/route-guards'
export default function ReviewLayout({children}: {children: React.ReactNode}) { return <ModeratorRoute>{children}</ModeratorRoute> }
