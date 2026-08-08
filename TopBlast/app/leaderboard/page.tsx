'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useRealtimeLeaderboard, useRealtimePrice, useTimeSince, useRealtime } from '@/hooks/useRealtime'
import { useTenantRouting } from '@/hooks/useTenantRouting'
import { AnimatedNumber, Countdown, PriceTicker } from '@/components/ui/AnimatedNumber'
import { LeaderboardCardSkeleton, TableRowSkeleton } from '@/components/ui/Skeleton'
import { AppHeader } from '@/components/platform/AppHeader'
import { SessionNav } from '@/components/platform/SessionNav'
import { getWinnerSharePercents, getPayoutForEligibleRank } from '@/lib/payout/shares'
import { HolderStatus, HoldTimeBadge, HolderIneligibleCallout } from '@/components/HoldTimeBadge'
import { SessionStatusBar } from '@/components/tenant/SessionStatusBar'
import { LeaderboardHolderCard } from '@/components/leaderboard/LeaderboardHolderCard'
import { ExternalToolsEligibilityNote } from '@/components/tenant/ExternalToolsEligibilityNote'
import type { SessionChecklist } from '@/lib/tenant/sessionChecklist'
import { PAYOUT_INTERVAL_RANGE_COMPACT } from '@/lib/platform/payoutIntervals'
import { CopyContractAddress, solscanTokenUrl } from '@/components/ui/CopyContractAddress'
import { PlatformTestBanner } from '@/components/platform/PlatformTestBanner'

const WINNER_SHARES = getWinnerSharePercents()

interface Winner {
  rank: number
  wallet: string
  wallet_display: string
  balance: string
  balance_raw?: number
  is_eligible?: boolean
  ineligible_reason?: string | null
  eligible_rank?: number | null
  hold_seconds_remaining?: number | null
  hold_eligible_at?: string | null
  first_buy_at?: string | null
  drawdown_pct?: number
  loss_usd?: string
  vwap?: string
  vwap_raw?: number
  payout_usd?: string | null
}

function getRankStyle(rank: number) {
  switch (rank) {
    case 1:
      return {
        emoji: '🥇',
        border: 'border-yellow-500/50 shadow-yellow-500/20',
        badge: 'bg-gradient-to-r from-yellow-600 to-amber-500',
        glow: 'shadow-[0_0_30px_rgba(234,179,8,0.3)]',
      }
    case 2:
      return {
        emoji: '🥈',
        border: 'border-gray-400/50 shadow-gray-400/20',
        badge: 'bg-gradient-to-r from-gray-400 to-gray-300',
        glow: 'shadow-[0_0_20px_rgba(156,163,175,0.2)]',
      }
    case 3:
      return {
        emoji: '🥉',
        border: 'border-orange-500/50 shadow-orange-500/20',
        badge: 'bg-gradient-to-r from-orange-600 to-amber-600',
        glow: 'shadow-[0_0_20px_rgba(234,88,12,0.2)]',
      }
    default:
      return {
        emoji: '🏅',
        border: 'border-white/10',
        badge: 'bg-white/20',
        glow: '',
      }
  }
}

function formatNumber(num: number | string): string {
  const n = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : num
  if (isNaN(n)) return '0'
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

// Live connection indicator
function ConnectionIndicator({ state, wsConnected }: { state: string; wsConnected?: boolean }) {
  const isConnected = state === 'connected' || wsConnected

  return (
    <motion.div
      className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-[0.65rem] sm:text-xs font-medium backdrop-blur-sm ${
        isConnected
          ? 'bg-rh-green/10 text-rh-green border border-rh-green/30'
          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
      }`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <motion.div
        className={`w-2 h-2 rounded-full ${isConnected ? 'bg-rh-green' : 'bg-amber-400'}`}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [1, 0.6, 1],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
        }}
      />
      <span className="hidden sm:inline">{isConnected ? 'LIVE' : 'Connecting...'}</span>
      <span className="sm:hidden">{isConnected ? '●' : '…'}</span>
    </motion.div>
  )
}

// Data freshness indicator
function FreshnessIndicator({ lastUpdate }: { lastUpdate: Date | null }) {
  const secondsAgo = useTimeSince(lastUpdate)
  const isStale = secondsAgo > 30

  if (!lastUpdate) return null

  return (
    <motion.div
      className={`text-xs font-mono ${isStale ? 'text-amber-400' : 'text-gray-500'}`}
      animate={isStale ? { opacity: [1, 0.5, 1] } : {}}
      transition={{ duration: 1, repeat: isStale ? Infinity : 0 }}
    >
      {secondsAgo}s ago
    </motion.div>
  )
}

// Inline loading spinner
function InlineSpinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      className="w-5 h-5 border-2 border-gray-600 border-t-rh-green rounded-full inline-block"
    />
  )
}

function drawdownClass(pct: number | undefined, hasVwap: boolean): string {
  if (!hasVwap || pct == null) return 'text-gray-500'
  if (pct < 0) return 'text-red-400'
  if (pct > 0) return 'text-rh-green'
  return 'text-gray-400'
}

function drawdownLabel(pct: number | undefined, hasVwap: boolean): string {
  if (!hasVwap || pct == null) return '—'
  if (pct === 0) return '0%'
  return `${pct > 0 ? '+' : ''}${pct}%`
}

export default function LeaderboardPage() {
  const { slug, basePath } = useTenantRouting()
  const { data, loading, error, countdown, timerStatus, lastUpdate, refresh } = useRealtimeLeaderboard(30000, slug)
  const { price, marketCap, loading: priceLoading, connection, isLive, mint: priceMint } = useRealtimePrice(undefined, slug)
  const { connectionState } = useRealtime({ autoReconnect: true })
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setTimeout(() => setRefreshing(false), 500)
  }, [refresh])

  const tokenMint = data?.token_mint || priceMint || null
  const tokenSymbol = data?.token_symbol || 'TopBlast'
  const tokenExplorerUrl =
    data?.token_mint_explorer_url ||
    (tokenMint ? solscanTokenUrl(tokenMint) : null)

  // Always show the page - use inline loading states for data
  const isLoading = loading && !data
  const isInitializing = data?.status === 'initializing'
  const rankings = ((data?.rankings || []) as Winner[])
  const hasRankedHolders = rankings.length > 0
  const isSyncingHolders = !isInitializing && !hasRankedHolders && (data?.tracked_holders ?? 0) === 0
  const isWaitingForEligible =
    isSyncingHolders ||
    timerStatus === 'waiting' ||
    data?.timer_status === 'waiting'
  const isPayoutDueNow =
    !isWaitingForEligible &&
    (data?.eligible_count ?? 0) > 0 &&
    ((countdown !== null && countdown <= 0) || data?.seconds_remaining === 0)

  const top3Eligible = (
    data?.eligible_winners?.length
      ? data.eligible_winners
      : rankings.filter((h: Winner) => h.is_eligible === true)
  ).slice(0, 3) as Winner[]
  const showLimbo = top3Eligible.length === 0 && hasRankedHolders
  const featuredCards = top3Eligible.length > 0 ? top3Eligible : rankings.slice(0, 3)
  
  // Pool balance in USD for payout estimates (prefer raw number from API)
  const poolValue = data?.pool_balance_usd_raw ?? parseFloat(data?.pool_balance_usd?.replace(/[$,]/g, '') || '0')
  const wsConnected = data?.ws_connected
  const platformTestBanner = data?.platform_test_banner ?? null
  const lastPayoutError = data?.last_payout_error ?? null
  const payoutRetryMode = data?.payout_retry_mode === true
  const payoutRetryMinutes = data?.payout_retry_minutes ?? null

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-rh-green/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-rh-green-dark/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-rh-lime/5 to-transparent rounded-full" />
      </div>

      <AppHeader
        active="leaderboard"
        trailing={
          <>
            <ConnectionIndicator state={connectionState} wsConnected={wsConnected} />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs sm:text-sm font-medium transition-all border border-white/10 disabled:opacity-50"
            >
              <motion.span
                animate={refreshing ? { rotate: 360 } : {}}
                transition={{ duration: 1, repeat: refreshing ? Infinity : 0, ease: 'linear' }}
              >
                ↻
              </motion.span>
              <span className="hidden sm:inline">Refresh</span>
            </motion.button>
          </>
        }
      />

      <SessionNav basePath={basePath} active="leaderboard" symbol={tokenSymbol} />

      {platformTestBanner ? <PlatformTestBanner banner={platformTestBanner} /> : null}

      {lastPayoutError ? (
        <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 pt-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-sm">
            <p className="font-semibold text-amber-200 mb-1">Last payout attempt failed</p>
            <p className="text-amber-100/90 leading-relaxed">{lastPayoutError}</p>
            <p className="text-xs text-amber-200/70 mt-2">
              {payoutRetryMode && payoutRetryMinutes
                ? `Pool SOL is safe — automatic retry in ~${payoutRetryMinutes} min (faster than the normal cycle).`
                : 'Pool SOL is safe — the timer will retry automatically.'}{' '}
              See <Link href={`${basePath}/history`} className="underline hover:text-white">History</Link> for details.
            </p>
          </div>
        </div>
      ) : null}

      <main className="relative max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Price Ticker Bar */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-center gap-3 sm:gap-6 lg:gap-8 mb-6 sm:mb-8 py-3 px-4 sm:px-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 w-full sm:w-fit sm:mx-auto max-w-full"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <span className="text-gray-400 text-xs sm:text-sm shrink-0">Token</span>
              <span className="text-rh-lime font-bold text-sm sm:text-base truncate">${tokenSymbol}</span>
            </div>
            {tokenMint ? (
              <CopyContractAddress
                variant="inline"
                address={tokenMint}
                symbol={tokenSymbol}
                explorerUrl={tokenExplorerUrl}
              />
            ) : (
              <span className="text-xs text-gray-500 font-mono">Loading CA…</span>
            )}
          </div>
          <div className="hidden sm:block w-px h-5 bg-white/20" />
          <div className="grid grid-cols-2 sm:contents gap-3 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="text-gray-400 text-xs sm:text-sm shrink-0">Price</span>
            {price || data?.token_price_raw ? (
              <PriceTicker price={price || data?.token_price_raw} size="md" />
            ) : (
              <span className="text-gray-500 font-mono">Loading...</span>
            )}
            {isLive ? (
              <span
                className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  connection === 'websocket'
                    ? 'bg-rh-green/20 text-rh-lime'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
                title={connection === 'websocket' ? 'DexScreener WebSocket' : 'DexScreener live poll (1s)'}
              >
                {connection === 'websocket' ? 'Live' : '1s'}
              </span>
            ) : null}
          </div>
          <div className="hidden sm:block w-px h-5 bg-white/20" />
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-gray-400 text-xs sm:text-sm">MCap</span>
            <span className="font-bold font-mono">
              {marketCap ? (
                <AnimatedNumber value={marketCap} format="currency" />
              ) : (
                <span className="text-gray-500">--</span>
              )}
            </span>
          </div>
          <div className="hidden sm:block w-px h-5 bg-white/20" />
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-gray-400 text-xs sm:text-sm">Holders</span>
            <span
              className="font-bold font-mono text-white"
              title={
                data?.on_chain_holders != null
                  ? `${data.on_chain_holders} wallets on-chain (excludes LP pool) · min ${data?.min_token_holding?.toLocaleString() ?? '1,000'} tokens to rank`
                  : undefined
              }
            >
              {data?.on_chain_holders ?? data?.total_holders ? (
                formatNumber(data.on_chain_holders ?? data.total_holders)
              ) : (
                <InlineSpinner />
              )}
            </span>
          </div>
          </div>
        </motion.div>

        {/* Main Stats */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {/* Countdown Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative bg-gradient-to-br from-purple-950/30 to-purple-900/10 border border-rh-green/30 rounded-2xl p-6 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-rh-green/10 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-rh-green text-sm font-medium mb-4">
                <motion.div
                  animate={isWaitingForEligible ? { scale: [1, 1.1, 1] } : { rotate: 360 }}
                  transition={isWaitingForEligible
                    ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
                    : { duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4"
                >
                  {isWaitingForEligible ? '⏳' : '⏱️'}
                </motion.div>
                {isSyncingHolders
                  ? 'SYNCING HOLDERS'
                  : isWaitingForEligible
                    ? 'WAITING FOR FIRST ELIGIBLE HOLDER'
                    : isPayoutDueNow
                      ? 'PAYOUT PROCESSING'
                      : 'NEXT PAYOUT IN'}
              </div>
              {isSyncingHolders ? (
                <div className="py-4">
                  <p className="text-2xl md:text-3xl font-bold text-rh-lime font-mono mb-3">Indexing chain…</p>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Loading holders and swap history for this token from Solana.
                  </p>
                </div>
              ) : isWaitingForEligible ? (
                <div className="py-4">
                  <p className="text-2xl md:text-3xl font-bold text-rh-lime font-mono mb-3">Listing limbo</p>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Timer starts when the first holder qualifies.
                  </p>
                </div>
              ) : isPayoutDueNow ? (
                <div className="py-4">
                  <p className="text-4xl md:text-5xl font-bold text-rh-lime font-mono mb-3 animate-pulse">00:00</p>
                  <p className="text-gray-400 text-sm">Buying your token on-chart and airdropping winners…</p>
                </div>
              ) : (
                <Countdown seconds={countdown ?? 0} size="xl" className="text-rh-green" />
              )}
              <p className="text-gray-400 text-sm mt-4">
                {isWaitingForEligible
                  ? 'No payout cycle until someone qualifies'
                  : isPayoutDueNow
                    ? 'On-chart buy + token airdrops — timer resets after completion'
                    : payoutRetryMode
                      ? `Retry scheduled — faster ${payoutRetryMinutes ?? 3} min interval after swap failure`
                      : 'Top 3 losers receive session tokens via on-chart buyback each cycle'}
              </p>
            </div>
          </motion.div>

          {/* Pool Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative bg-gradient-to-br from-purple-950/20 to-purple-900/5 border border-rh-green-dark/20 rounded-2xl p-6 overflow-hidden"
          >
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-rh-green-dark/10 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-rh-lime text-sm font-medium mb-4">
                <span>💰</span>
                REWARD POOL
              </div>
              <div className="text-5xl font-bold text-white mb-2">
                <AnimatedNumber
                  key={`pool-${data?.pool_balance_eth}-${data?.pool_balance_usd_raw}`}
                  value={poolValue}
                  format="currency"
                />
              </div>
              <p className="text-gray-400 text-sm">
                {data?.pool_balance_eth || '0'} SOL in pool
                {data?.payout_wallet_address && (
                  <span className="block text-xs text-gray-600 mt-1 font-mono">
                    Wallet {data.payout_wallet_address.slice(0, 6)}…{data.payout_wallet_address.slice(-4)} · live on-chain
                  </span>
                )}
              </p>
            </div>
          </motion.div>
        </div>

        <SessionStatusBar
          checklist={(data?.session_checklist as SessionChecklist | null) ?? null}
          eligibleCount={data?.eligible_count}
          timerStatus={timerStatus ?? data?.timer_status}
        />

        {/* Winners Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-10"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 sm:gap-3">
                <span className="text-2xl sm:text-3xl">{showLimbo ? '⏳' : '🎯'}</span>
                {showLimbo ? 'Listing limbo — tracked holders' : 'Current Winners'}
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                {showLimbo
                  ? 'No one eligible yet — each card shows why. Timer starts when the first holder passes every rule.'
                  : 'These wallets will receive payouts when the timer hits zero'}
              </p>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              <FreshnessIndicator lastUpdate={lastUpdate} />
              <ConnectionIndicator state={connectionState} wsConnected={wsConnected} />
            </div>
          </div>

          {featuredCards.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-6">
                {featuredCards.map((winner: Winner, idx: number) => {
                  const style = getRankStyle(idx + 1)
                  const isEligible = winner.is_eligible === true
                  const hasVwap = (winner.vwap_raw ?? 0) > 0
                  const payoutAmount = isEligible ? getPayoutForEligibleRank(poolValue, idx) : 0
                  const shareLabel = idx === 0 ? `${WINNER_SHARES.first}%` : idx === 1 ? `${WINNER_SHARES.second}%` : `${WINNER_SHARES.third}%`

                  return (
                    <motion.div
                    key={`position-${winner.wallet}-${idx}`}
                    initial={false}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ y: -4, transition: { duration: 0.2 } }}
                      className={`relative bg-rh-black border ${showLimbo ? 'border-amber-500/30' : style.border} rounded-2xl p-6 ${isEligible ? style.glow : ''} overflow-hidden flex flex-col`}
                    >
                      {/* Rank badge */}
                      {idx === 0 && isEligible && (
                        <div className="absolute top-0 right-0">
                          <div className="bg-gradient-to-r from-yellow-500 to-amber-400 text-black text-xs font-bold px-3 py-1 rounded-bl-lg">
                            BIGGEST LOSER
                          </div>
                        </div>
                      )}
                      {showLimbo && !isEligible ? (
                        <div className="absolute top-0 right-0 max-w-[55%]">
                          <div className="bg-amber-600/90 text-white text-[0.65rem] sm:text-xs font-medium px-3 py-1 rounded-bl-lg truncate">
                            {winner.ineligible_reason || 'Not eligible yet'}
                          </div>
                        </div>
                      ) : null}
                      {!showLimbo && !isEligible && (
                        <div className="absolute top-0 right-0">
                          {(winner.hold_seconds_remaining ?? 0) > 0 || winner.hold_eligible_at ? (
                            <HoldTimeBadge
                              holdEligibleAt={winner.hold_eligible_at}
                              holdSecondsRemaining={winner.hold_seconds_remaining}
                              className="rounded-bl-lg rounded-tr-2xl px-3 py-1"
                            />
                          ) : (
                            <div className="bg-gray-600 text-white text-xs font-medium px-3 py-1 rounded-bl-lg">
                              {winner.ineligible_reason || 'Not eligible'}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-start justify-between mb-4">
                        <motion.span
                          className="text-4xl"
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          {style.emoji}
                        </motion.span>
                        <div className="text-right">
                          <div className="text-sm text-gray-400 font-mono">{winner.wallet_display}</div>
                          {isEligible ? (
                            <div className="text-rh-green font-bold text-lg">
                              <AnimatedNumber value={payoutAmount} format="currency" />
                            </div>
                          ) : winner.drawdown_pct != null && hasVwap ? (
                            <div className={`font-bold text-lg font-mono ${drawdownClass(winner.drawdown_pct, hasVwap)}`}>
                              {drawdownLabel(winner.drawdown_pct, hasVwap)}
                            </div>
                          ) : (
                            <div className="text-gray-500 text-sm">No payout yet</div>
                          )}
                        </div>
                      </div>

                      {/* Rank highlight with dynamic styling */}
                      <div className="flex items-center justify-center py-4 mb-4">
                        <motion.div
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className={`text-6xl ${idx === 0 ? 'drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]' : idx === 1 ? 'drop-shadow-[0_0_15px_rgba(156,163,175,0.4)]' : 'drop-shadow-[0_0_15px_rgba(234,88,12,0.4)]'}`}
                        >
                          {showLimbo ? '📋' : idx === 0 ? '👑' : idx === 1 ? '⚔️' : '🛡️'}
                        </motion.div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between py-2 border-b border-white/5">
                          <span className="text-gray-500">Position</span>
                          <span className="text-white font-bold">{idx === 0 ? 'Biggest Loser' : idx === 1 ? 'Runner Up' : 'Third Place'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-white/5">
                          <span className="text-gray-500">Drawdown</span>
                          <span className={`font-mono ${drawdownClass(winner.drawdown_pct, hasVwap)}`}>
                            {drawdownLabel(winner.drawdown_pct, hasVwap)}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-white/5">
                          <span className="text-gray-500">Loss (USD)</span>
                          <span className="text-gray-300 font-mono">{winner.loss_usd ?? '—'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-white/5">
                          <span className="text-gray-500">Balance</span>
                          <span className="text-white font-mono">{formatNumber(winner.balance)}</span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-gray-500">{isEligible ? 'Share' : 'Status'}</span>
                          {isEligible ? (
                            <span className="text-rh-green font-bold">{shareLabel}</span>
                          ) : (
                            <span className="text-gray-500 text-xs text-right max-w-[60%]">
                              See below
                            </span>
                          )}
                        </div>
                      </div>

                      {!isEligible ? (
                        <HolderIneligibleCallout
                          ineligibleReason={winner.ineligible_reason}
                          holdEligibleAt={winner.hold_eligible_at}
                          holdSecondsRemaining={winner.hold_seconds_remaining}
                          firstBuyAt={winner.first_buy_at}
                          minHoldMinutes={data?.min_hold_minutes ?? 15}
                          className="mt-auto"
                        />
                      ) : null}
                    </motion.div>
                  )
                })}
            </div>
          ) : !hasRankedHolders ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-rh-black border border-white/10 rounded-2xl p-12 text-center"
            >
              {isLoading || isInitializing || isSyncingHolders ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-12 h-12 border-2 border-rh-green/30 border-t-rh-green rounded-full mx-auto mb-4"
                  />
                  <h3 className="text-xl font-bold mb-2">Loading holders</h3>
                  <p className="text-gray-400">
                    Pulling wallets and buy history from Solana…
                  </p>
                </>
              ) : (
                <>
                  <motion.div
                    className="text-6xl mb-4"
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    🔍
                  </motion.div>
                  <h3 className="text-xl font-bold mb-2">No holders indexed yet</h3>
                  <p className="text-gray-400 mb-4 max-w-md mx-auto">
                    Once wallets appear on-chain, they will show here with eligibility status — even before anyone wins.
                  </p>
                  <ExternalToolsEligibilityNote variant="inline" className="max-w-lg mx-auto text-left" />
                </>
              )}
            </motion.div>
          ) : null}
        </motion.div>

        {/* Full Rankings Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-rh-black border border-white/10 rounded-2xl overflow-hidden"
        >
          <div className="p-4 sm:p-6 border-b border-white/10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold">All tracked holders</h2>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">
                {data?.eligible_count || 0} eligible
                {hasRankedHolders && (data?.eligible_count ?? 0) === 0 ? (
                  <> · {rankings.length} shown with status</>
                ) : null}
                {(data?.upcoming_count ?? 0) > 0 && (
                  <> · {data.upcoming_count} underwater</>
                )}
                {' '}• Updated in real-time
              </p>
              <ExternalToolsEligibilityNote variant="inline" className="mt-2 max-w-2xl" />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-gray-400">
              <span>{data?.on_chain_holders ?? data?.total_holders ?? 0} on-chain</span>
              <span className="hidden sm:inline w-px h-4 bg-white/20" />
              <span>{data?.tracked_holders || 0} on leaderboard</span>
              {(data?.holders_with_buy_history ?? 0) > 0 ? (
                <>
                  <span className="hidden sm:inline w-px h-4 bg-white/20" />
                  <span>{data.holders_with_buy_history} with buy history</span>
                </>
              ) : null}
            </div>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden">
            {rankings.slice(0, 10).map((holder: Winner, idx: number) => (
              <LeaderboardHolderCard
                key={`mobile-${holder.wallet}`}
                holder={holder}
                index={idx}
                poolValue={poolValue}
                minHoldMinutes={data?.min_hold_minutes ?? 15}
              />
            ))}
            {rankings.length === 0 && !isLoading && !isInitializing ? (
              <p className="px-4 py-10 text-center text-sm text-gray-500">No holders indexed yet.</p>
            ) : null}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-400 border-b border-white/10 bg-white/5">
                  <th className="px-6 py-4 font-medium">Rank</th>
                  <th className="px-6 py-4 font-medium">Wallet</th>
                  <th className="px-6 py-4 font-medium text-right">Drawdown</th>
                  <th className="px-6 py-4 font-medium text-right">Balance</th>
                  <th className="px-6 py-4 font-medium text-center">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Payout</th>
                </tr>
              </thead>
              <tbody>
                {rankings.slice(0, 10).map((holder: Winner, idx: number) => {
                  const isEligible = holder.is_eligible === true
                  const hasVwap = (holder.vwap_raw ?? 0) > 0
                  const eligibleRank = holder.eligible_rank != null ? holder.eligible_rank - 1 : -1
                  const payoutAmount = eligibleRank >= 0 && eligibleRank < 3
                    ? getPayoutForEligibleRank(poolValue, eligibleRank)
                    : 0
                  const style = isEligible ? getRankStyle(Math.min(idx + 1, 3)) : getRankStyle(idx + 1)

                  return (
                    <motion.tr
                      key={`row-${holder.wallet}`}
                      initial={false}
                      animate={{ opacity: 1, x: 0 }}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${!isEligible ? 'bg-white/[0.01]' : ''}`}
                    >
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{isEligible && idx < 3 ? style.emoji : '🏅'}</span>
                          {isEligible && idx < 3 ? (
                            <span className={`${style.badge} w-6 h-6 rounded-full flex items-center justify-center text-black text-xs font-bold`}>
                              {holder.eligible_rank ?? idx + 1}
                            </span>
                          ) : (
                            <span className="text-gray-500 font-mono text-sm">#{holder.rank ?? idx + 1}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <span className="font-mono text-gray-300">{holder.wallet_display}</span>
                      </td>
                      <td className={`px-6 py-4 text-right font-mono align-top ${drawdownClass(holder.drawdown_pct, hasVwap)}`}>
                        {drawdownLabel(holder.drawdown_pct, hasVwap)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono align-top">
                        {formatNumber(holder.balance)}
                      </td>
                      <td className="px-6 py-4 align-top min-w-[200px]">
                        {isEligible ? (
                          <HolderStatus isEligible />
                        ) : (
                          <HolderIneligibleCallout
                            ineligibleReason={holder.ineligible_reason}
                            holdEligibleAt={holder.hold_eligible_at}
                            holdSecondsRemaining={holder.hold_seconds_remaining}
                            firstBuyAt={holder.first_buy_at}
                            minHoldMinutes={data?.min_hold_minutes ?? 15}
                          />
                        )}
                      </td>
                      <td className="px-6 py-4 text-right align-top">
                        {payoutAmount > 0 && isEligible ? (
                          <span className="text-rh-green font-bold font-mono">
                            ${payoutAmount.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                    </motion.tr>
                  )
                })}
                {rankings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      {isLoading || isInitializing ? (
                        <div className="flex flex-col items-center gap-2">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="w-8 h-8 border-2 border-rh-green/30 border-t-rh-green rounded-full"
                          />
                          <span>Loading holder data...</span>
                        </div>
                      ) : (data?.tracked_holders || 0) > 0 ? (
                        <div className="flex flex-col items-center gap-2 max-w-md mx-auto">
                          <span className="text-3xl">📊</span>
                          <span className="text-white font-medium">Calculating rankings…</span>
                          <span className="text-sm text-gray-500">
                            Buy history loading from chain.
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-500">No holders indexed yet.</span>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-10 text-center space-y-2"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-rh-green/10 border border-rh-green/20 rounded-full text-sm text-rh-green">
            <motion.div
              className="w-2 h-2 bg-rh-green rounded-full"
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            Real-time tracking via Helius
          </div>
          <p className="text-xs text-gray-500">
            {data?.tracked_holders || 0} holders tracked • Top 3 losers paid every{' '}
            {data?.payout_interval_display || PAYOUT_INTERVAL_RANGE_COMPACT}
          </p>
        </motion.div>
      </main>
    </div>
  )
}
