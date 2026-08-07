import { GET as leaderboardGet } from '@/app/api/leaderboard/route'
import { tenantRoute } from '@/lib/tenant/tenantRoute'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const GET = tenantRoute(leaderboardGet)
