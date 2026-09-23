import type { LivePoolBalance } from '@/lib/payout/poolBalance'
import type { PayoutTimerInfo } from '@/lib/payout/executor'
import { config } from '@/lib/config'
import { isPoolFundedForPayout, minPoolForPayoutLabel, payoutWalletUsd } from '@/lib/payout/poolMinimum'
import { formatPayoutInterval } from '@/lib/platform/payoutIntervals'
import { nativeUnitForMint } from '@/lib/platform/chainShape'

export type DiagnosticSeverity = 'success' | 'info' | 'warning' | 'error'

export interface TenantDiagnostic {
  id: string
  severity: DiagnosticSeverity
  title: string
  message: string
  action?: string
}

export interface TenantDiagnosticsInput {
  /** Holders the chain scan reported, before ranking filters. */
  reportedHolderCount?: number
  /** The listing's token address. Decides which chain's vocabulary the
      messages use — a Pons listing settles in ETH and is indexed from chain
      logs, not from Helius. */
  tokenMint?: string | null
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
    tokenMint = null,
    reportedHolderCount = 0,
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

  // Every native-asset figure below is labelled from the listing's own chain.
  const unit = nativeUnitForMint(tokenMint)
  const isLegacy = unit === 'SOL'
  const minBalance = config.minTokenHolding.toLocaleString()
  const holdMins = config.minHoldDurationMinutes
  const payoutIntervalLabel = formatPayoutInterval(config.payoutIntervalMinutes)

  // --- Live price feed ---
  if (!priceAvailable) {
    items.push({
      id: 'price_unavailable',
      severity: 'warning',
      title: 'Live price not indexed yet',
      message: isLegacy
        ? 'DexScreener has not indexed this mint yet — wait a few minutes.'
        : 'No price feed for this token yet. Normal for a fresh Pons launch still on its bonding curve.',
      action: 'Price updates automatically once the token is indexed. Nothing to do.',
    })
  } else if (migrationStage === 'bonding_curve') {
    items.push({
      id: 'pump_bonding_curve',
      severity: 'info',
      title: isLegacy ? 'Bonding curve (pre-migration)' : 'Pons bonding curve (pre-graduation)',
      message: `Price is tracked from the bonding-curve pool (${priceSource || 'dexscreener'}).`,
      action: isLegacy
        ? 'When the token migrates, TopBlast switches to the highest-liquidity pair automatically — no action needed.'
        : 'When the launch graduates to Uniswap v4, TopBlast switches to the v4 pool automatically — no action needed.',
    })
  } else if (migrationStage === 'migrated') {
    items.push({
      id: 'pump_migrated',
      severity: 'success',
      title: isLegacy ? 'Token migrated off the bonding curve' : 'Launch graduated to Uniswap v4',
      message: isLegacy
        ? 'Price now follows the migrated (or higher-liquidity) pool.'
        : 'Price now follows the Uniswap v4 pool. Buybacks route through the Universal Router.',
    })
  }

  // --- Payout wallet / funding ---
  if (!pool.payoutWalletAddress) {
    items.push({
      id: 'payout_key_missing',
      severity: 'error',
      title: 'Payout wallet not configured',
      message: 'TopBlast could not load a payout wallet from PAYOUT_WALLET_PRIVATE_KEY.',
      action: isLegacy
        ? 'Set a valid base58 private key in Vercel env for this deployment.'
        : 'Set PAYOUT_WALLET_PRIVATE_KEY in Vercel to a 32-byte hex EVM key.',
    })
  } else if (pool.balanceLookupFailed) {
    items.push({
      id: 'pool_rpc_error',
      severity: 'warning',
      title: 'Could not read payout wallet balance',
      message: isLegacy
        ? `Configured payout wallet is ${pool.payoutWalletAddress}. The RPC failed to return a balance.`
        : `Configured payout wallet is ${pool.payoutWalletAddress}. The Robinhood Chain RPC failed to return a balance — usually a rate limit or a bad ROBINHOOD_RPC_URL.`,
      action: `Retry shortly, and confirm ${unit} is in ${pool.payoutWalletAddress}.`,
    })
  } else if (pool.walletSol <= 0) {
    items.push({
      id: 'pool_empty',
      severity: 'error',
      title: `Payout wallet has no ${unit}`,
      message: `Winner payouts and cycles cannot run until this wallet holds ${unit}.`,
      action: `Send ${unit} to your payout wallet: ${pool.payoutWalletAddress}`,
    })
  } else if (!isPoolFundedForPayout(pool)) {
    items.push({
      id: 'pool_below_minimum',
      severity: 'warning',
      title: 'Payout pool below minimum',
      message: `Payout wallet holds ${formatSol(pool.walletSol)} ${unit} (~${pool.poolUsdFormatted} at live ${unit} price). Minimum to start or run a cycle is ${minPoolForPayoutLabel()} USD in ${unit}.`,
      action: `Send ${unit} to ${pool.payoutWalletAddress}. If the wallet is drained below ${minPoolForPayoutLabel()}, the session stays in limbo and cycles will not run.`,
    })
  } else {
    items.push({
      id: 'pool_funded',
      severity: 'success',
      title: 'Payout wallet funded',
      message: `${formatSol(pool.poolSol)} ${unit} available for rewards (~${pool.poolUsdFormatted}).`,
      action: `Payout wallet: ${pool.payoutWalletAddress}`,
    })
  }

  // --- Indexing ---
  // A scan that completed and found nobody rankable is NOT "still indexing".
  // The common case is a fresh listing whose only holder is the creator's own
  // payout wallet, which is excluded from winning — saying "indexing" there
  // spins forever and hides the real reason.
  if (reportedHolderCount > 0 && trackedHolders === 0) {
    items.push({
      id: 'no_rankable_holders',
      severity: 'info',
      title: `${reportedHolderCount} holder(s) on-chain, none rankable yet`,
      message:
        'Every wallet found so far is either excluded from rewards (the payout ' +
        'and dev wallets never compete) or below the minimum balance.',
      action: `Rankings appear once an outside wallet holds at least ${minBalance} tokens.`,
    })
  } else if (!hasRankings || !trackerInitialized) {
    items.push({
      id: 'indexing',
      severity: 'info',
      title: 'Indexing holders from chain',
      message: isLegacy
        ? 'After listing, TopBlast pulls holders and buy history. This usually takes 1–5 minutes.'
        : 'TopBlast is reading holders and buy history from Robinhood Chain logs. This usually takes 1–5 minutes.',
      action: 'No action needed — refresh the leaderboard shortly.',
    })
  } else if (trackedHolders === 0) {
    items.push({
      id: 'no_holders',
      severity: 'warning',
      title: 'No token holders detected',
      message: isLegacy
        ? 'No wallets holding this token were found on-chain.'
        : 'No wallets holding this token were found on Robinhood Chain.',
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
      action: 'Wait a few minutes. Holders need recorded buys to rank for conviction rewards.',
    })
  }

  // --- Eligibility ---
  if (eligibleCount === 0 && trackedHolders > 0 && holdersWithVwap > 0) {
    if (totalLosers === 0) {
      items.push({
        id: 'all_in_profit',
        severity: 'info',
        title: 'No holders currently in loss',
        message: 'Rewards only go to wallets underwater vs their average buy price — conviction holders who stayed in.',
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
