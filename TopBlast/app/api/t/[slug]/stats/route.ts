import { GET as statsGet } from '@/app/api/stats/route'
import { tenantRoute } from '@/lib/tenant/tenantRoute'

export const dynamic = 'force-dynamic'

export const GET = tenantRoute(statsGet)
