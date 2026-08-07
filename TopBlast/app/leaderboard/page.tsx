'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useRealtimeLeaderboard, useRealtimePrice, useTimeSince, useRealtime } from '@/hooks/useRealtime'
import { useTenantRouting } from '@/hooks/useTenantRouting'
import { AnimatedNumber, Countdown, PriceTicker } from '@/components/ui/AnimatedNumber'
import { LeaderboardCardSkeleton, TableRowSkeleton } from '@/components/ui/Skeleton'
import { AppHeader } from '@/components/platform/AppHeader'
import { getWinnerSharePercents, getPayoutForEligibleRank } from '@/lib/payout/shares'
import { HolderStatus, HoldTimeBadge } from '@/components/HoldTimeBadge'
import { SessionStatusBar } from '@/components/tenant/SessionStatusBar'
import type { SessionChecklist } from '@/lib/tenant/sessionChecklist'
import { PAYOUT_INTERVAL_RANGE_COMPACT } from '@/lib/platform/payoutIntervals'

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
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm ${
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
      <span>{isConnected ? 'LIVE' : 'Connecting...'}</span>
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

export default function LeaderboardPage() {
  const { slug, basePath } = useTenantRouting()
  const { data, loading, error, countdown, timerStatus, lastUpdate, refresh } = useRealtimeLeaderboard(5000, slug)
  const { price, marketCap, loading: priceLoading, connection, isLive } = useRealtimePrice(undefined, slug)
  const { connectionState } = useRealtime({ autoReconnect: true })
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setTimeout(() => setRefreshing(false), 500)
  }, [refresh])

  // Always show the page - use inline loading states for data
  const isLoading = loading && !data
  const isInitializing = data?.status === 'initializing'
  const isSyncingHolders = !isInitializing && (data?.tracked_holders ?? 0) === 0
  const isWaitingForEligible =
    isSyncingHolders ||
    timerStatus === 'waiting' ||
    data?.timer_status === 'waiting'
  const isPayoutDueNow =
    !isWaitingForEligible &&
    (data?.eligible_count ?? 0) > 0 &&
    ((countdown !== null && countdown <= 0) || data?.seconds_remaining === 0)
  
  // Eligible winners for payout cards; full rankings includes up-and-coming ineligible holders
  const top3 = (data?.eligible_winners?.length ? data.eligible_winners : (data?.rankings || []).filter((h: Winner) => h.is_eligible === true)).slice(0, 3) as Winner[]
  const upcomingLosers = ((data?.rankings || []) as Winner[])
    .filter((h) => h.is_eligible !== true && (h.drawdown_pct ?? 0) < 0)
    .slice(0, 3)
  const showUpcoming = top3.length === 0 && upcomingLosers.length > 0
  const featuredCards = showUpcoming ? upcomingLosers : top3
  
  // Pool balance in USD for payout estimates (prefer raw number from API)
  const poolValue = data?.pool_balance_usd_raw ?? parseFloat(data?.pool_balance_usd?.replace(/[$,]/g, '') || '0')
  const wsConnected = data?.ws_connected

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
        sessionBasePath={basePath}
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

      <main className="relative max-w-7xl mx-auto px-4 py-8">
        {/* Price Ticker Bar */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-8 mb-8 py-3 px-6 bg-white/5 backdrop-blur-sm rounded-full border border-white/10 mx-auto w-fit"
        >
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm">Token:</span>
            <span className="text-rh-lime font-bold">${data?.token_symbol || 'TopBlast'}</span>
          </div>
          <div className="w-px h-5 bg-white/20" />
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm">Price:</span>
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
          <div className="w-px h-5 bg-white/20" />
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm">MCap:</span>
            <span className="font-bold font-mono">
              {marketCap ? (
                <AnimatedNumber value={marketCap} format="currency" />
              ) : (
                <span className="text-gray-500">--</span>
              )}
            </span>
          </div>
          <div className="w-px h-5 bg-white/20" />
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm">Holders:</span>
            <span className="font-bold font-mono text-white">
              {data?.total_holders ? formatNumber(data.total_holders) : <InlineSpinner />}
            </span>
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
                  <p className="text-2xl md:text-3xl font-bold text-rh-lime font-mono mb-3">Launch limbo</p>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Timer starts when the first holder qualifies.
                  </p>
                </div>
              ) : isPayoutDueNow ? (
                <div className="py-4">
                  <p className="text-4xl md:text-5xl font-bold text-rh-lime font-mono mb-3 animate-pulse">00:00</p>
                  <p className="text-gray-400 text-sm">Sending SOL to top losers…</p>
                </div>
              ) : (
                <Countdown seconds={countdown ?? 0} size="xl" className="text-rh-green" />
              )}
              <p className="text-gray-400 text-sm mt-4">
                {isWaitingForEligible
                  ? 'No payout cycle until someone qualifies'
                  : isPayoutDueNow
                    ? 'Payout runs automatically — timer resets after completion'
                    : 'Top 3 losers receive native SOL automatically'}
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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <span className="text-3xl">{showUpcoming ? '⏳' : '🎯'}</span>
                {showUpcoming ? 'Up & Coming' : 'Current Winners'}
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                {showUpcoming
                  ? 'Leading the loss board — waiting on eligibility (15 min hold + rules below)'
                  : 'These wallets will receive payouts when the timer hits zero'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <FreshnessIndicator lastUpdate={lastUpdate} />
              <ConnectionIndicator state={connectionState} wsConnected={wsConnected} />
            </div>
          </div>

          {featuredCards.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-6">
                {featuredCards.map((winner: Winner, idx: number) => {
                  const style = getRankStyle(idx + 1)
                  const isEligible = winner.is_eligible === true
                // Payout from pool after dev fee
                  const payoutAmount = isEligible ? getPayoutForEligibleRank(poolValue, idx) : 0
                  const shareLabel = idx === 0 ? `${WINNER_SHARES.first}%` : idx === 1 ? `${WINNER_SHARES.second}%` : `${WINNER_SHARES.third}%`

                  return (
                    <motion.div
                    key={`position-${winner.wallet}-${idx}`}
                    initial={false}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ y: -4, transition: { duration: 0.2 } }}
                      className={`relative bg-rh-black border ${showUpcoming ? 'border-amber-500/30' : style.border} rounded-2xl p-6 ${isEligible ? style.glow : ''} overflow-hidden ${!isEligible ? 'opacity-90' : ''}`}
                    >
                      {/* Rank badge */}
                      {idx === 0 && isEligible && (
                        <div className="absolute top-0 right-0">
                          <div className="bg-gradient-to-r from-yellow-500 to-amber-400 text-black text-xs font-bold px-3 py-1 rounded-bl-lg">
                            BIGGEST LOSER
                          </div>
                        </div>
                      )}
                      {showUpcoming && (
                        <div className="absolute top-0 right-0">
                          {(winner.hold_seconds_remaining ?? 0) > 0 || winner.hold_eligible_at ? (
                            <HoldTimeBadge
                              holdEligibleAt={winner.hold_eligible_at}
                              holdSecondsRemaining={winner.hold_seconds_remaining}
                              className="rounded-bl-lg rounded-tr-2xl px-3 py-1"
                            />
                          ) : (
                            <div className="bg-amber-600/80 text-white text-xs font-medium px-3 py-1 rounded-bl-lg">
                              {winner.ineligible_reason || 'Pending eligibility'}
                            </div>
                          )}
                        </div>
                      )}
                      {!showUpcoming && !isEligible && (
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
                        <div className="flex items-center gap-3">
                          <motion.span
                            className="text-4xl"
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            {style.emoji}
                          </motion.span>
                          <div className={`${showUpcoming ? 'bg-amber-500/80' : style.badge} w-8 h-8 rounded-full flex items-center justify-center text-black font-bold text-lg shadow-lg`}>
                            {idx + 1}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-400 font-mono">{winner.wallet_display}</div>
                          {isEligible ? (
                            <div className="text-rh-green font-bold text-lg">
                              <AnimatedNumber value={payoutAmount} format="currency" />
                            </div>
                          ) : winner.drawdown_pct != null ? (
                            <div className="text-red-400 font-bold text-lg font-mono">{winner.drawdown_pct}%</div>
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
                          {showUpcoming ? '⏳' : idx === 0 ? '👑' : idx === 1 ? '⚔️' : '🛡️'}
                        </motion.div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between py-2 border-b border-white/5">
                          <span className="text-gray-500">Position</span>
                          <span className="text-white font-bold">{idx === 0 ? 'Biggest Loser' : idx === 1 ? 'Runner Up' : 'Third Place'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-white/5">
                          <span className="text-gray-500">Drawdown</span>
                          <span className="text-red-400 font-mono">{winner.drawdown_pct ?? 0}%</span>
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
                            <HolderStatus
                              isEligible={false}
                              ineligibleReason={winner.ineligible_reason}
                              holdEligibleAt={winner.hold_eligible_at}
                              holdSecondsRemaining={winner.hold_seconds_remaining}
                              firstBuyAt={winner.first_buy_at}
                              minHoldMinutes={data?.min_hold_minutes ?? 15}
                            />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-rh-black border border-white/10 rounded-2xl p-12 text-center"
            >
              {isLoading || isInitializing ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-12 h-12 border-2 border-rh-green/30 border-t-rh-green rounded-full mx-auto mb-4"
                  />
                  <h3 className="text-xl font-bold mb-2">Loading Winners</h3>
                  <p className="text-gray-400">
                    Calculating VWAPs from blockchain data...
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
                  <h3 className="text-xl font-bold mb-2">No Eligible Winners Yet</h3>
                  <p className="text-gray-400 mb-6">
                    Waiting for holders with verified losses above the threshold
                  </p>
                  <div className="text-sm text-gray-500 space-y-1">
                    <div>{data?.tracked_holders || 0} holders tracked</div>
                    <div>Min loss: {data?.min_loss_threshold_usd || '$50'}</div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Full Rankings Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-rh-black border border-white/10 rounded-2xl overflow-hidden"
        >
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Top Losers Leaderboard</h2>
              <p className="text-sm text-gray-400 mt-1">
                {data?.eligible_count || 0} eligible
                {(data?.upcoming_count ?? 0) > 0 && (
                  <> · {data.upcoming_count} up &amp; coming</>
                )}
                {' '}• Rankings updated in real-time
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>{data?.total_holders || 0} total holders</span>
              <span className="w-px h-4 bg-white/20" />
              <span>{data?.tracked_holders || 0} tracked</span>
            </div>
          </div>

          <div className="overflow-x-auto">
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
                {(data?.rankings || []).slice(0, 10).map((holder: Winner, idx: number) => {
                  const isEligible = holder.is_eligible === true
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
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${!isEligible ? 'opacity-80' : ''}`}
                    >
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4">
                        <span className="font-mono text-gray-300">{holder.wallet_display}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-red-400">
                        {holder.drawdown_pct != null ? `${holder.drawdown_pct}%` : '—'}
                      </td>
                      <td className="px-6 py-4 text-right font-mono">
                        {formatNumber(holder.balance)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <HolderStatus
                          isEligible={isEligible}
                          ineligibleReason={holder.ineligible_reason}
                          holdEligibleAt={holder.hold_eligible_at}
                          holdSecondsRemaining={holder.hold_seconds_remaining}
                          firstBuyAt={holder.first_buy_at}
                          minHoldMinutes={data?.min_hold_minutes ?? 15}
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
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
                {(!data?.rankings || data.rankings.length === 0) && (
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
