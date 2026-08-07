import connectDB from '@/lib/db'
import { Payout, Tenant } from '@/lib/db/models'
import { getTxExplorerUrl } from '@/lib/solana/explorer'
import {
  getPlatformTenantSlug,
  getPlatformTokenSymbol,
  isPlatformTenantSlug,
} from '@/lib/platform/config'

export interface PayoutHistoryEntry {
  rank: number
  type: 'dev_fee' | 'winner'
  wallet: string
  wallet_display: string
  amount_eth: string
  amount_usd: string
  drawdown_pct: string | null
  loss_usd: string | null
  tx_hash: string | null
  explorer_url: string | null
  status: 'success' | 'failed'
  error: string | null
}

export interface PayoutHistoryCycle {
  id: string
  cycle: number
  tenant_slug: string
  session_slug: string
  token_symbol: string
  timestamp: string
  payouts: PayoutHistoryEntry[]
  total_eth: string
  total_usd: string
  success_count: number
  failed_count: number
  status: 'success' | 'failed' | 'partial'
}

export interface AppPayoutHistory {
  network: string
  chain: 'solana'
  stats: {
    total_cycles: number
    total_payouts: number
    total_distributed_eth: string
    failed_payouts: number
    sessions: number
  }
  cycles: PayoutHistoryCycle[]
}

async function buildTenantLabelMap(): Promise<Map<string, { sessionSlug: string; symbol: string }>> {
  const map = new Map<string, { sessionSlug: string; symbol: string }>()

  const platformSlug = getPlatformTenantSlug()
  const platformSymbol = getPlatformTokenSymbol()
  map.set('_legacy', { sessionSlug: platformSlug, symbol: platformSymbol })

  await connectDB()
  const rows = await Tenant.find().select('slug symbol').lean()
  for (const row of rows) {
    map.set(row.slug, { sessionSlug: row.slug, symbol: row.symbol })
  }

  return map
}

function resolveSessionMeta(
  tenantSlug: string,
  labels: Map<string, { sessionSlug: string; symbol: string }>
): { sessionSlug: string; symbol: string } {
  const hit = labels.get(tenantSlug)
  if (hit) return hit
  if (isPlatformTenantSlug(tenantSlug)) {
    return { sessionSlug: getPlatformTenantSlug(), symbol: getPlatformTokenSymbol() }
  }
  return { sessionSlug: tenantSlug, symbol: tenantSlug.toUpperCase() }
}

export async function fetchAppPayoutHistory(limit = 50): Promise<AppPayoutHistory> {
  await connectDB()
  const labels = await buildTenantLabelMap()
  const network = process.env.SOLANA_NETWORK || 'mainnet'

  const payouts = await Payout.find().sort({ createdAt: -1 }).limit(limit * 8).lean()

  const cycleMap = new Map<string, {
    cycle: number
    tenant_slug: string
    session_slug: string
    token_symbol: string
    timestamp: Date
    payouts: PayoutHistoryEntry[]
    total_eth: number
    total_usd: number
    success_count: number
    failed_count: number
  }>()

  for (const p of payouts) {
    const tenantSlug = p.tenantSlug || '_legacy'
    const meta = resolveSessionMeta(tenantSlug, labels)
    const cycleKey = `${tenantSlug}:${p.cycle}`

    if (!cycleMap.has(cycleKey)) {
      cycleMap.set(cycleKey, {
        cycle: p.cycle,
        tenant_slug: tenantSlug,
        session_slug: meta.sessionSlug,
        token_symbol: meta.symbol,
        timestamp: p.createdAt,
        payouts: [],
        total_eth: 0,
        total_usd: 0,
        success_count: 0,
        failed_count: 0,
      })
    }

    const cycle = cycleMap.get(cycleKey)!
    if (p.createdAt > cycle.timestamp) {
      cycle.timestamp = p.createdAt
    }

    cycle.payouts.push({
      rank: p.rank,
      type: p.rank === 0 ? 'dev_fee' : 'winner',
      wallet: p.wallet,
      wallet_display: `${p.wallet.slice(0, 6)}...${p.wallet.slice(-4)}`,
      amount_eth: (p.amountTokens || 0).toFixed(6),
      amount_usd: (p.amount || 0).toFixed(2),
      drawdown_pct: p.rank > 0 ? p.drawdownPct?.toFixed(2) ?? null : null,
      loss_usd: p.rank > 0 ? p.lossUsd?.toFixed(2) ?? null : null,
      tx_hash: p.txHash,
      explorer_url: p.txHash ? getTxExplorerUrl(p.txHash) : null,
      status: p.status === 'success' ? 'success' : 'failed',
      error: p.errorMessage,
    })

    if (p.status === 'success') {
      cycle.total_eth += p.amountTokens || 0
      cycle.total_usd += p.amount || 0
      cycle.success_count++
    } else {
      cycle.failed_count++
    }
  }

  const cycles: PayoutHistoryCycle[] = Array.from(cycleMap.entries())
    .map(([id, c]) => ({
      id,
      cycle: c.cycle,
      tenant_slug: c.tenant_slug,
      session_slug: c.session_slug,
      token_symbol: c.token_symbol,
      timestamp: new Date(c.timestamp).toISOString(),
      payouts: c.payouts.sort((a, b) => a.rank - b.rank),
      total_eth: c.total_eth.toFixed(6),
      total_usd: c.total_usd.toFixed(2),
      success_count: c.success_count,
      failed_count: c.failed_count,
      status:
        c.failed_count === 0 ? 'success' : c.success_count === 0 ? 'failed' : 'partial',
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit)

  const allPayouts = await Payout.find().lean()
  const successfulPayouts = allPayouts.filter(p => p.status === 'success')
  const totalDistributed = successfulPayouts.reduce((sum, p) => sum + (p.amountTokens || 0), 0)
  const uniqueCycles = new Set(allPayouts.map(p => `${p.tenantSlug || '_legacy'}:${p.cycle}`))
  const uniqueSessions = new Set(allPayouts.map(p => p.tenantSlug || '_legacy'))

  return {
    network,
    chain: 'solana',
    stats: {
      total_cycles: uniqueCycles.size,
      total_payouts: successfulPayouts.length,
      total_distributed_eth: totalDistributed.toFixed(6),
      failed_payouts: allPayouts.length - successfulPayouts.length,
      sessions: uniqueSessions.size,
    },
    cycles,
  }
}
