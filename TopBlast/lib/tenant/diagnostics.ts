import type { LivePoolBalance } from '@/lib/payout/poolBalance'
import type { PayoutTimerInfo } from '@/lib/payout/executor'
import { config } from '@/lib/config'
import { formatPayoutInterval } from '@/lib/platform/payoutIntervals'

export type DiagnosticSeverity = 'success' | 'info' | 'warning' | 'error'

export interface TenantDiagnostic {
  id: string
  severity: DiagnosticSeverity
  title: string
  message: string
  action?: string
}

export interface TenantDiagnosticsInput {
  pool: LivePoolBalance
  timer: PayoutTimerInfo
  trackedHolders: number
  holdersWithVwap: number
  eligibleCount: number
  upcomingCount: number
  totalLosers: number
  trackerInitialized: boolean
  hasRankings: boolean
  ineligibleReasons?: Record<string, number>
  priceAvailable?: boolean
  priceSource?: string | null
  migrationStage?: 'bonding_curve' | 'migrated' | 'standard' | null
}

export interface TenantDiagnostics {
  overall: 'healthy' | 'attention' | 'blocked' | 'initializing'
  headline: string
  items: TenantDiagnostic[]
}

function formatSol(amount: number): string {
  return amount.toFixed(4)
}

export function buildTenantDiagnostics(input: TenantDiagnosticsInput): TenantDiagnostics {
  const items: TenantDiagnostic[] = []
  const {
    pool,
    timer,
    trackedHolders,
    holdersWithVwap,
    eligibleCount,
    upcomingCount,
    totalLosers,
    trackerInitialized,
    hasRankings,
    ineligibleReasons = {},
    priceAvailable = true,
    priceSource = null,
    migrationStage = null,
  } = input

  const minPoolSol = config.minPoolSol
  const minBalance = config.minTokenHolding.toLocaleString()
  const holdMins = config.minHoldDurationMinutes
  const payoutIntervalLabel = formatPayoutInterval(config.payoutIntervalMinutes)

  // --- Live price feed (DexScreener / Jupiter — not Helius RPC) ---
  if (!priceAvailable) {
    items.push({
      id: 'price_unavailable',
      severity: 'warning',
      title: 'Live price not indexed yet',
      message:
        'DexScreener has not indexed this mint yet. Common for brand-new Pump.fun launches — wait a few minutes.',
      action: 'Price updates automatically once DexScreener lists your token. Helius RPC is not used for price polling.',
    })
  } else if (migrationStage === 'bonding_curve') {
    items.push({
      id: 'pump_bonding_curve',
      severity: 'info',
      title: 'Pump.fun bonding curve (pre-migration)',
      message: `Price is tracked from the Pump.fun pool via DexScreener (${priceSource || 'dexscreener'}).`,
      action:
        'When the token migrates to PumpSwap/Raydium, TopBlast automatically switches to the highest-liquidity pair — no action needed.',
    })
  } else if (migrationStage === 'migrated') {
    items.push({
      id: 'pump_migrated',
      severity: 'success',
      title: 'Token migrated off Pump.fun bonding curve',
      message: 'Price now follows the migrated PumpSwap (or higher-liquidity) pool.',
    })
  }

  // --- Payout wallet / funding ---
  if (!pool.payoutWalletAddress) {
    items.push({
      id: 'payout_key_missing',
      severity: 'error',
      title: 'Payout wallet not configured',
      message: 'TopBlast could not load a payout wallet from PAYOUT_WALLET_PRIVATE_KEY.',
      action: 'Set a valid base58 Solana private key in Vercel env for this deployment.',
    })
  } else if (pool.balanceLookupFailed) {
    items.push({
      id: 'pool_rpc_error',
      severity: 'warning',
      title: 'Could not read payout wallet balance',
      message: `Configured payout wallet is ${pool.payoutWalletAddress}. Helius RPC failed to return SOL balance — usually a missing HELIUS_API_KEY or bad HELIUS_RPC_URL.`,
      action: `Verify HELIUS_API_KEY in Vercel and that SOL is in ${pool.payoutWalletAddress}.`,
    })
  } else if (pool.walletSol <= 0) {
    items.push({
      id: 'pool_empty',
      severity: 'error',
      title: 'Payout wallet has no SOL',
      message: `Winner payouts and cycles cannot run until this wallet holds SOL.`,
      action: `Send SOL to your payout wallet: ${pool.payoutWalletAddress}`,
    })
  } else if (pool.poolSol < minPoolSol) {
    items.push({
      id: 'pool_below_minimum',
      severity: 'warning',
      title: 'Payout pool below minimum',
      message: `Reward pool is ${formatSol(pool.poolSol)} SOL (~${pool.poolUsdFormatted}). Minimum to execute a cycle is ${formatSol(minPoolSol)} SOL.`,
      action: `Add SOL to ${pool.payoutWalletAddress}. TopBlast uses ~99% of the wallet balance each cycle.`,
    })
  } else {
    items.push({
      id: 'pool_funded',
      severity: 'success',
      title: 'Payout wallet funded',
      message: `${formatSol(pool.poolSol)} SOL available for rewards (~${pool.poolUsdFormatted}).`,
      action: `Payout wallet: ${pool.payoutWalletAddress}`,
    })
  }

  // --- Indexing ---
  if (!hasRankings || !trackerInitialized) {
    items.push({
      id: 'indexing',
      severity: 'info',
      title: 'Indexing holders from chain',
      message:
        'After listing, TopBlast pulls holders and buy history via Helius. This usually takes 1–5 minutes.',
      action: 'No action needed — refresh the leaderboard shortly. Ensure HELIUS can see your mint.',
    })
  } else if (trackedHolders === 0) {
    items.push({
      id: 'no_holders',
      severity: 'warning',
      title: 'No token holders detected',
      message: `No wallets holding your SPL mint were found on ${config.solanaNetwork || 'Solana'}.`,
      action:
        'Share your token so people buy and hold. Rankings appear once on-chain holders exist.',
    })
  } else {
    items.push({
      id: 'holders_indexed',
      severity: 'info',
      title: `${trackedHolders} holder(s) indexed`,
      message: `${holdersWithVwap} with buy history (VWAP) calculated.`,
    })
  }

  if (trackedHolders > 0 && holdersWithVwap === 0) {
    items.push({
      id: 'vwap_pending',
      severity: 'info',
      title: 'Buy history still loading',
      message: 'Holders are visible but VWAP (average buy price) is not ready yet.',
      action: 'Wait a few minutes. Holders need recorded buys to rank for loss-mining.',
    })
  }

  // --- Eligibility ---
  if (eligibleCount === 0 && trackedHolders > 0 && holdersWithVwap > 0) {
    if (totalLosers === 0) {
      items.push({
        id: 'all_in_profit',
        severity: 'info',
        title: 'No holders currently in loss',
        message: 'Loss-mining only pays wallets underwater vs their average buy price.',
        action: 'Rankings update as price moves. Holders in drawdown will appear when eligible.',
      })
    } else if (upcomingCount > 0) {
      items.push({
        id: 'upcoming_eligible',
        severity: 'info',
        title: `${upcomingCount} holder(s) in loss but not eligible yet`,
        message: 'They may need more hold time, higher balance, or a larger loss vs the pool threshold.',
        action: `Requirements: hold ≥${holdMins} min, balance ≥${minBalance} tokens, loss ≥${config.minLossThresholdPct}% of pool.`,
      })
    }

    const reasonLines = Object.entries(ineligibleReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([reason, count]) => `${count}× ${reason}`)

    if (reasonLines.length > 0) {
      items.push({
        id: 'ineligible_breakdown',
        severity: 'info',
        title: 'Why nobody is eligible yet',
        message: reasonLines.join(' · '),
      })
    }
  }

  if (eligibleCount > 0) {
    items.push({
      id: 'eligible_ready',
      severity: 'success',
      title: `${eligibleCount} eligible loser(s)`,
      message: 'These wallets qualify for the next payout cycle.',
    })
  }

  // --- Timer ---
  if (timer.timer_status === 'waiting') {
    items.push({
      id: 'timer_waiting',
      severity: eligibleCount > 0 ? 'warning' : 'info',
      title: 'Payout timer waiting',
      message:
        eligibleCount > 0
          ? `At least one holder is eligible — the ${payoutIntervalLabel} timer starts when the first holder qualifies.`
          : `The ${payoutIntervalLabel} payout timer starts automatically when the first holder becomes eligible.`,
      action:
        eligibleCount === 0
          ? 'Fund your pool and wait for eligible holders. Cycles run automatically — no manual start.'
          : undefined,
    })
  } else if (timer.seconds_remaining != null) {
    const mins = Math.ceil(timer.seconds_remaining / 60)
    items.push({
      id: 'timer_active',
      severity: eligibleCount > 0 ? 'success' : 'warning',
      title: 'Payout timer running',
      message:
        eligibleCount > 0
          ? `Next cycle in ~${mins} minute(s) if pool stays funded.`
          : `No eligible winners — timer should pause until someone qualifies.`,
      action:
        eligibleCount === 0
          ? `Review eligibility requirements below (hold time, balance, loss vs pool, no sells, cooldown).`
          : undefined,
    })
  }

  // --- Overall headline ---
  let overall: TenantDiagnostics['overall'] = 'healthy'
  let headline = 'Session is running'

  if (items.some(i => i.severity === 'error')) {
    overall = 'blocked'
    headline = 'Action required — payouts cannot run yet'
  } else if (!hasRankings || !trackerInitialized) {
    overall = 'initializing'
    headline = 'Setting up your session…'
  } else if (items.some(i => i.severity === 'warning')) {
    overall = 'attention'
    headline = 'Almost ready — check items below'
  } else if (eligibleCount === 0) {
    overall = 'attention'
    headline = 'Live — waiting for eligible losers'
  }

  return { overall, headline, items }
}

export { LAUNCH_KEY_HELP } from './launchHelp'
