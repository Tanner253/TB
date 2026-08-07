import { GET as poolGet } from '@/app/api/pool/route'
import { tenantRoute } from '@/lib/tenant/tenantRoute'

export const dynamic = 'force-dynamic'

export const GET = tenantRoute(poolGet)
