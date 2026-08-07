import { GET as priceGet } from '@/app/api/realtime/price/route'
import { tenantRoute } from '@/lib/tenant/tenantRoute'

export const dynamic = 'force-dynamic'

export const GET = tenantRoute(priceGet)
