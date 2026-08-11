import connectDB from '@/lib/db'
import { Payout, Tenant } from '@/lib/db/models'
import { aggregateSuccessfulPayoutTotals } from '@/lib/payout/payoutTotals'
import { getTokenMintExplorerUrl, getTxExplorerUrl } from '@/lib/solana/explorer'
import {
  formatHistoryUsd,
  formatHistoryUsdLabel,
  formatPayoutAmount,
  resolvePayoutAmountAsset,
  type PayoutAmountAsset,
} from '@/lib/payout/historyFormat'
import {
  getPlatformTenantSlug,
  getPlatformTokenMint,
  getPlatformTokenSymbol,
  isPlatformTenantSlug,
} from '@/lib/platform/config'

export interface PayoutHistoryEntry {
  rank: number
  type: 'dev_fee' | 'winner'
  wallet: string
  wallet_display: string
  amount_eth: string
  amount_unit: string
  amount_asset: PayoutAmountAsset
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
  token_mint: string | null
  token_mint_explorer_url: string | null
  timestamp: string
  payouts: PayoutHistoryEntry[]
  total_eth: string
  total_usd: string
  total_usd_formatted: string
  total_sol: string
  total_token_amount: string | null
  total_token_symbol: string | null
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
    total_distributed_usd: string
    total_distributed_usd_formatted: string
    failed_payouts: number
    sessions: number
  }
  cycles: PayoutHistoryCycle[]
}

type SessionMeta = { sessionSlug: string; symbol: string; mint: string | null }

async function buildTenantLabelMap(): Promise<Map<string, SessionMeta>> {
  const map = new Map<string, SessionMeta>()

  const platformSlug = getPlatformTenantSlug()
  const platformSymbol = getPlatformTokenSymbol()
  const platformMint = getPlatformTokenMint() || null
  map.set('_legacy', { sessionSlug: platformSlug, symbol: platformSymbol, mint: platformMint })

  await connectDB()
  const rows = await Tenant.find().select('slug symbol mint').lean()
  for (const row of rows) {
    map.set(row.slug, {
      sessionSlug: row.slug,
      symbol: row.symbol,
      mint: row.mint?.trim() || null,
    })
  }

  return map
}

function resolveSessionMeta(
  tenantSlug: string,
  labels: Map<string, SessionMeta>
): SessionMeta {
  const hit = labels.get(tenantSlug)
  if (hit) return hit
  if (isPlatformTenantSlug(tenantSlug)) {
    return {
      sessionSlug: getPlatformTenantSlug(),
      symbol: getPlatformTokenSymbol(),
      mint: getPlatformTokenMint() || null,
    }
  }
  return { sessionSlug: tenantSlug, symbol: tenantSlug.toUpperCase(), mint: null }
}

function resolveCycleTokenMeta(
  payout: {
    tokenMint?: string | null
    tokenSymbol?: string | null
    tenantSlug?: string | null
  },
  labels: Map<string, SessionMeta>
): { symbol: string; mint: string | null } {
  const tenantSlug = payout.tenantSlug || '_legacy'
  const session = resolveSessionMeta(tenantSlug, labels)
  const mint = payout.tokenMint?.trim() || session.mint
  const symbol = payout.tokenSymbol?.trim() || session.symbol
  return { symbol, mint }
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
    token_mint: string | null
    timestamp: Date
    payouts: PayoutHistoryEntry[]
    total_usd: number
    total_sol: number
    total_token_amount: number
    success_count: number
    failed_count: number
  }>()

  for (const p of payouts) {
    const tenantSlug = p.tenantSlug || '_legacy'
    const session = resolveSessionMeta(tenantSlug, labels)
    const tokenMeta = resolveCycleTokenMeta(p, labels)
    const cycleKey = `${tenantSlug}:${p.cycle}`

    if (!cycleMap.has(cycleKey)) {
      cycleMap.set(cycleKey, {
        cycle: p.cycle,
        tenant_slug: tenantSlug,
        session_slug: session.sessionSlug,
        token_symbol: tokenMeta.symbol,
        token_mint: tokenMeta.mint,
        timestamp: p.createdAt,
        payouts: [],
        total_usd: 0,
        total_sol: 0,
        total_token_amount: 0,
        success_count: 0,
        failed_count: 0,
      })
    }

    const cycle = cycleMap.get(cycleKey)!
    if (p.createdAt > cycle.timestamp) {
      cycle.timestamp = p.createdAt
    }
    if (!cycle.token_mint && tokenMeta.mint) {
      cycle.token_mint = tokenMeta.mint
    }
    if (tokenMeta.symbol) {
      cycle.token_symbol = tokenMeta.symbol
    }

    const amountTokens = p.amountTokens || 0
    const amountUsd = p.amount || 0
    const amountAsset = resolvePayoutAmountAsset(p.rank, amountTokens, amountUsd)
    const amountUnit = amountAsset === 'sol' ? 'SOL' : tokenMeta.symbol

    cycle.payouts.push({
      rank: p.rank,
      type: p.rank === 0 ? 'dev_fee' : 'winner',
      wallet: p.wallet,
      wallet_display: `${p.wallet.slice(0, 6)}...${p.wallet.slice(-4)}`,
      amount_eth: formatPayoutAmount(amountTokens, amountAsset),
      amount_unit: amountUnit,
      amount_asset: amountAsset,
      amount_usd: formatHistoryUsd(amountUsd),
      drawdown_pct:
        p.rank > 0 && typeof p.drawdownPct === 'number' && p.drawdownPct < 0
          ? Math.abs(p.drawdownPct).toFixed(2)
          : null,
      loss_usd:
        p.rank > 0 && typeof p.lossUsd === 'number' && p.lossUsd > 0
          ? p.lossUsd.toFixed(2)
          : null,
      tx_hash: p.txHash,
      explorer_url: p.txHash ? getTxExplorerUrl(p.txHash) : null,
      status: p.status === 'success' ? 'success' : 'failed',
      error: p.errorMessage,
    })

    if (p.status === 'success') {
      cycle.total_usd += amountUsd
      if (amountAsset === 'sol') {
        cycle.total_sol += amountTokens
      } else {
        cycle.total_token_amount += amountTokens
      }
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
      token_mint: c.token_mint,
      token_mint_explorer_url: getTokenMintExplorerUrl(c.token_mint),
      timestamp: new Date(c.timestamp).toISOString(),
      payouts: c.payouts.sort((a, b) => a.rank - b.rank),
      total_eth: c.total_sol.toFixed(6),
      total_usd: formatHistoryUsd(c.total_usd),
      total_usd_formatted: formatHistoryUsdLabel(c.total_usd),
      total_sol: formatPayoutAmount(c.total_sol, 'sol'),
      total_token_amount:
        c.total_token_amount > 0 ? formatPayoutAmount(c.total_token_amount, 'token') : null,
      total_token_symbol: c.total_token_amount > 0 ? c.token_symbol : null,
      success_count: c.success_count,
      failed_count: c.failed_count,
      status:
        c.failed_count === 0 ? 'success' : c.success_count === 0 ? 'failed' : 'partial',
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit)

  const allPayouts = await Payout.find().lean()
  const successfulPayouts = allPayouts.filter(p => p.status === 'success')
  const paidOut = aggregateSuccessfulPayoutTotals(successfulPayouts)
  const totalDistributedUsd = paidOut.total_usd
  const totalDistributedSol = paidOut.total_sol
  const uniqueCycles = new Set(allPayouts.map(p => `${p.tenantSlug || '_legacy'}:${p.cycle}`))
  const uniqueSessions = new Set(allPayouts.map(p => p.tenantSlug || '_legacy'))

  return {
    network,
    chain: 'solana',
    stats: {
      total_cycles: uniqueCycles.size,
      total_payouts: successfulPayouts.length,
      total_distributed_eth: totalDistributedSol.toFixed(6),
      total_distributed_usd: formatHistoryUsd(totalDistributedUsd),
      total_distributed_usd_formatted: formatHistoryUsdLabel(totalDistributedUsd),
      failed_payouts: allPayouts.length - successfulPayouts.length,
      sessions: uniqueSessions.size,
    },
    cycles,
  }
}
