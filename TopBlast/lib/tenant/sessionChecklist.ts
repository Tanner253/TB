import { config } from '@/lib/config'
import { isPoolFundedForPayout, minPoolForPayoutLabel } from '@/lib/payout/poolMinimum'
import { formatPayoutInterval } from '@/lib/platform/payoutIntervals'
import type { TenantDiagnosticsInput } from '@/lib/tenant/diagnostics'

export type ChecklistItemStatus = 'met' | 'pending' | 'blocked' | 'info'

export interface SessionChecklistItem {
  id: string
  label: string
  detail?: string
  status: ChecklistItemStatus
  group: 'session' | 'winner'
}

export interface SessionChecklistBlocker {
  reason: string
  count: number
}

export interface SessionChecklist {
  headline: string
  summary: string
  overall: 'ready' | 'waiting' | 'blocked' | 'loading'
  items: SessionChecklistItem[]
  blockers: SessionChecklistBlocker[]
}

const REASON_RULE_IDS: Record<string, string[]> = {
  'Hold duration not met': ['hold'],
  'Insufficient balance': ['balance'],
  'In profit': ['loss'],
  'At break-even': ['loss'],
  'Loss below threshold': ['min_loss'],
  'Sold tokens': ['no_sell'],
  'Transferred out': ['no_sell'],
  'Winner cooldown': ['cooldown'],
  'Protocol wallet excluded': ['protocol'],
  'Liquidity pool excluded': ['protocol'],
  'No buy history': ['vwap'],
  'Cost basis unavailable': ['vwap'],
  'Received via transfer': ['vwap'],
  'Price loading': ['price'],
}

function blockedRuleIds(ineligibleReasons: Record<string, number>): Set<string> {
  const ids = new Set<string>()
  for (const [reason, count] of Object.entries(ineligibleReasons)) {
    if (count <= 0) continue
    for (const id of REASON_RULE_IDS[reason] ?? []) {
      ids.add(id)
    }
  }
  return ids
}

export function buildSessionChecklist(
  input: TenantDiagnosticsInput & {
    minLossUsdFormatted?: string
  }
): SessionChecklist {
  const {
    pool,
    timer,
    trackedHolders,
    holdersWithVwap,
    eligibleCount,
    upcomingCount,
    totalLosers,
    hasRankings,
    ineligibleReasons = {},
    priceAvailable = true,
  } = input

  const minPoolLabel = minPoolForPayoutLabel()
  const poolFunded = isPoolFundedForPayout(pool)
  const minBalance = config.minTokenHolding.toLocaleString()
  const holdLabel = `${config.minHoldDurationMinutes} min`
  const payoutLabel = formatPayoutInterval(config.payoutIntervalMinutes)
  const minLossPct = config.minLossThresholdPct
  const minLossUsd = input.minLossUsdFormatted ?? '—'

  // DB-backed sessions on serverless may have rankings while in-memory tracker is cold
  const indexed = hasRankings && trackedHolders > 0
  const indexingInProgress = !indexed && (!hasRankings || holdersWithVwap === 0)
  const vwapReady = holdersWithVwap > 0
  const hasEligible = eligibleCount > 0
  const timerActive = timer.timer_status === 'active' && hasEligible && poolFunded
  const blockedRules = blockedRuleIds(ineligibleReasons)

  const blockers = Object.entries(ineligibleReasons)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => ({ reason, count }))

  const sessionItems: SessionChecklistItem[] = [
    {
      id: 'pool',
      group: 'session',
      label: 'Payout pool funded',
      detail: poolFunded
        ? `${pool.poolSol.toFixed(4)} SOL (~${pool.poolUsdFormatted}) distributable`
        : pool.walletSol > 0
          ? `${pool.poolUsdFormatted} in payout wallet — need at least ${minPoolLabel} USD in SOL`
          : `Send at least ${minPoolLabel} USD worth of SOL to the payout wallet`,
      status: !pool.available || !pool.payoutWalletAddress
        ? 'blocked'
        : pool.walletSol <= 0 || !poolFunded
          ? 'blocked'
          : 'met',
    },
    {
      id: 'price',
      group: 'session',
      label: 'Live token price',
      detail: priceAvailable ? 'DexScreener price feed active' : 'Waiting for DexScreener to index this mint',
      status: priceAvailable ? 'met' : 'pending',
    },
    {
      id: 'index',
      group: 'session',
      label: 'Holders indexed',
      detail: indexed
        ? `${trackedHolders} wallet(s) tracked on-chain`
        : hasRankings && holdersWithVwap > 0
          ? 'Refreshing holder list from Solana'
          : 'Pulling holders from Solana via Helius',
      status: indexed ? 'met' : indexingInProgress ? 'pending' : 'pending',
    },
    {
      id: 'vwap',
      group: 'session',
      label: 'Buy history (VWAP)',
      detail: vwapReady
        ? `${holdersWithVwap} wallet(s) with average buy price`
        : trackedHolders > 0
          ? 'Loading swap history for drawdown math'
          : 'Needs on-chain holders first',
      status: vwapReady ? 'met' : trackedHolders > 0 ? 'pending' : 'pending',
    },
    {
      id: 'eligible',
      group: 'session',
      label: 'Eligible losers',
      detail: hasEligible
        ? `${eligibleCount} wallet(s) pass every winner rule`
        : upcomingCount > 0
          ? `${upcomingCount} in loss but still waiting on hold time or thresholds`
          : totalLosers > 0
            ? `${totalLosers} underwater — none fully eligible yet`
            : 'Needs holders in drawdown who pass all rules',
      status: hasEligible ? 'met' : indexed && vwapReady ? 'pending' : 'pending',
    },
    {
      id: 'timer',
      group: 'session',
      label: 'Payout timer',
      detail: timerActive
        ? `Next cycle in ~${Math.ceil((timer.seconds_remaining ?? 0) / 60)} min`
        : hasEligible && !poolFunded
          ? `Pool needs ${minPoolLabel} before cycles can run`
          : hasEligible
            ? 'Starting on next sync — first eligible holder appeared'
            : `Starts automatically when the first holder qualifies (${payoutLabel} cycles)`,
      status: timerActive ? 'met' : hasEligible && !poolFunded ? 'blocked' : hasEligible ? 'pending' : 'pending',
    },
  ]

  function ruleStatus(ruleId: string): ChecklistItemStatus {
    if (hasEligible) return 'met'
    if (!indexed || !vwapReady) return 'pending'
    if (blockedRules.has(ruleId)) return 'blocked'
    if (ruleId === 'loss' && totalLosers === 0 && trackedHolders > 0) return 'blocked'
    return 'pending'
  }

  const winnerItems: SessionChecklistItem[] = [
    {
      id: 'balance',
      group: 'winner',
      label: `Hold ≥ ${minBalance} tokens`,
      detail: 'Minimum balance set when this token was listed',
      status: ruleStatus('balance'),
    },
    {
      id: 'hold',
      group: 'winner',
      label: `${holdLabel} minimum hold`,
      detail: 'From first on-chain buy timestamp',
      status: ruleStatus('hold'),
    },
    {
      id: 'loss',
      group: 'winner',
      label: 'Underwater vs average buy',
      detail: 'Current price must be below VWAP (in a loss)',
      status: ruleStatus('loss'),
    },
    {
      id: 'min_loss',
      group: 'winner',
      label: `Loss ≥ ${minLossPct}% of pool (~${minLossUsd})`,
      detail: 'USD loss must clear the live pool threshold',
      status: ruleStatus('min_loss'),
    },
    {
      id: 'no_sell',
      group: 'winner',
      label: 'No sells or transfer-outs',
      detail: 'Selling or transferring out disqualifies the wallet',
      status: ruleStatus('no_sell'),
    },
    {
      id: 'cooldown',
      group: 'winner',
      label: 'Not on winner cooldown',
      detail: 'Previous cycle winners sit out one round',
      status: ruleStatus('cooldown'),
    },
    {
      id: 'protocol',
      group: 'winner',
      label: 'Not a pool or protocol wallet',
      detail: 'LP, payout pool, and dev fee wallets are excluded',
      status: 'met',
    },
  ]

  let overall: SessionChecklist['overall'] = 'waiting'
  if (sessionItems.some(i => i.status === 'blocked')) {
    overall = 'blocked'
  } else if (!indexed || !priceAvailable || (trackedHolders > 0 && !vwapReady)) {
    overall = 'loading'
  } else if (hasEligible && timerActive) {
    overall = 'ready'
  }

  let headline = 'Waiting for eligible holders'
  let summary = 'Tap to see session setup and winner requirements'

  if (overall === 'blocked') {
    headline = poolFunded ? 'Payout pool needs attention' : `Pool below ${minPoolLabel} minimum`
    summary = poolFunded ? 'Fund the wallet or fix configuration' : 'Add SOL to the payout wallet before cycles can run'
  } else if (overall === 'loading') {
    headline = 'Setting up session'
    summary = 'Indexing chain data — usually 1–5 minutes'
  } else if (hasEligible && timerActive) {
    headline = `${eligibleCount} eligible · payout timer running`
    summary = `Top ${config.winnerCount} eligible losers win on cycle end`
  } else if (hasEligible) {
    headline = `${eligibleCount} eligible · timer starting`
    summary = 'First qualifying holders detected'
  } else if (blockers.length > 0) {
    headline = `Waiting — ${blockers[0].count}× ${blockers[0].reason.toLowerCase()}`
    summary = `${trackedHolders} tracked · ${eligibleCount} eligible`
  } else if (trackedHolders > 0) {
    headline = 'Live — no eligible winners yet'
    summary = `${trackedHolders} tracked · need drawdown + rules`
  }

  return {
    headline,
    summary,
    overall,
    items: [...sessionItems, ...winnerItems],
    blockers,
  }
}
