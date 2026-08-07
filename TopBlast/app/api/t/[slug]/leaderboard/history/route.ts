import { GET as historyGet } from '@/app/api/leaderboard/history/route'
import { tenantRoute } from '@/lib/tenant/tenantRoute'

export const dynamic = 'force-dynamic'

export const GET = tenantRoute(historyGet)
