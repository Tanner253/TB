'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useRealtimeLeaderboard, useRealtimePrice, useTimeSince, useRealtime } from '@/hooks/useRealtime'
import { useTokenMedia } from '@/hooks/useTokenMedia'
import { DEFAULT_LEADERBOARD_POLL_MS } from '@/lib/platform/clientPollIntervals'
import { useTenantRouting } from '@/hooks/useTenantRouting'
import { AnimatedNumber, Countdown, PriceTicker } from '@/components/ui/AnimatedNumber'
import { LeaderboardCardSkeleton, TableRowSkeleton } from '@/components/ui/Skeleton'
import { AppHeader } from '@/components/platform/AppHeader'
import { DEFAULT_WINNER_COUNT } from '@/lib/payout/winnerCount'
import { getWinnerShareDisplayPercents, getPayoutForEligibleRank } from '@/lib/payout/shares'
import { HolderStatus, HoldTimeBadge, HolderIneligibleCallout } from '@/components/HoldTimeBadge'
import { SessionStatusBar } from '@/components/tenant/SessionStatusBar'
import { LeaderboardHolderCard } from '@/components/leaderboard/LeaderboardHolderCard'
import { ExternalToolsEligibilityNote } from '@/components/tenant/ExternalToolsEligibilityNote'
import type { SessionChecklist } from '@/lib/tenant/sessionChecklist'
import { PAYOUT_INTERVAL_RANGE_COMPACT } from '@/lib/platform/payoutIntervals'
import { CopyContractAddress, solscanTokenUrl } from '@/components/ui/CopyContractAddress'
import { getAddressExplorerUrl } from '@/lib/solana/explorer'
import { deriveSessionDisplayState } from '@/lib/session/displayState'
import { TokenAvatar } from '@/components/ui/TokenAvatar'
import { SessionBannerLayer } from '@/components/leaderboard/SessionBannerLayer'

const CandlestickBackground = dynamic(
  () => import('@/components/platform/CandlestickBackground').then(m => m.CandlestickBackground),
  { ssr: false }
)

const PEDESTAL_SLOTS = 3

function getWinnerPayoutInfo(
  poolValue: number,
  eligibleRank: number | null | undefined,
  winnerCount: number,
  sharePercents: number[]
) {
  if (eligibleRank == null || eligibleRank < 1 || eligibleRank > winnerCount) return null
  const idx = eligibleRank - 1
  return {
    amount: getPayoutForEligibleRank(poolValue, idx, winnerCount),
    sharePercent: sharePercents[idx] ?? getWinnerShareDisplayPercents(winnerCount)[idx] ?? 0,
  }
}

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

function hasVerifiedBuyHistory(
  vwapRaw: number | undefined | null,
  ineligibleReason: string | null | undefined
): boolean {
  if ((vwapRaw ?? 0) <= 0) return false
  if (ineligibleReason === 'No buy history' || ineligibleReason === 'Buy history pending') {
    return false
  }
  return true
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
  const { data, loading, error, countdown, timerStatus, lastUpdate, refresh, refreshCooldownSec } =
    useRealtimeLeaderboard(DEFAULT_LEADERBOARD_POLL_MS, slug)
  const { price, marketCap, loading: priceLoading, connection, isLive, mint: priceMint } = useRealtimePrice(undefined, slug)
  const { connectionState } = useRealtime({ autoReconnect: true })
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh({ force: true })
    setTimeout(() => setRefreshing(false), 500)
  }, [refresh])

  const tokenMint = data?.token_mint || priceMint || null
  const tokenSymbol = data?.token_symbol || 'TopBlast'
  const { media: tokenMedia } = useTokenMedia(tokenMint)
  const tokenIconUrl = tokenMedia?.iconUrl ?? null
  const tokenBannerUrl = tokenMedia?.bannerUrl ?? null
  const [showBannerOverlay, setShowBannerOverlay] = useState(true)
  const tokenExplorerUrl =
    data?.token_mint_explorer_url ||
    (tokenMint ? solscanTokenUrl(tokenMint) : null)

  // Always show the page - use inline loading states for data
  const isLoading = loading && !data
  const rankings = ((data?.rankings || []) as Winner[])
  const hasRankedHolders = rankings.length > 0

  const winnerCount = data?.winner_count ?? DEFAULT_WINNER_COUNT
  const winnerSharePercents =
    (data?.winner_share_percents as number[] | undefined) ??
    getWinnerShareDisplayPercents(winnerCount)

  const topEligible = (
    data?.eligible_winners?.length
      ? data.eligible_winners
      : rankings.filter((h: Winner) => h.is_eligible === true)
  ).slice(0, winnerCount) as Winner[]

  const eligibleCount = data?.eligible_count ?? topEligible.length
  const trueHolderCount =
    data?.reported_holder_count ?? data?.on_chain_holders ?? data?.total_holders ?? null
  const leaderboardTrackedCount = data?.tracked_holders ?? rankings.length
  const isInitializing = data?.status === 'initializing'
  const effectiveTimerStatus = timerStatus ?? data?.timer_status ?? 'waiting'
  const sessionDisplay = deriveSessionDisplayState({
    timerStatus: effectiveTimerStatus,
    secondsRemaining: countdown ?? data?.seconds_remaining ?? null,
    eligibleCount,
    rankedHolderCount: rankings.length,
    trackedHolders: data?.tracked_holders ?? 0,
    isInitializing,
    poolFundedForPayout: data?.payout_enabled !== false,
  })
  const isSyncingHolders = sessionDisplay.phase === 'syncing'
  const isWaitingForTopup = sessionDisplay.phase === 'waiting_for_topup'
  const isPoolLimbo = isWaitingForTopup
  const isListingLimbo = sessionDisplay.phase === 'limbo'
  const isTimerStarting = sessionDisplay.phase === 'timer_starting'
  const isTimerActive = sessionDisplay.phase === 'countdown'
  const isPayoutDueNow = sessionDisplay.phase === 'payout_due'
  const showLimbo = sessionDisplay.phase === 'limbo'
  const sessionChecklist = (data?.session_checklist as SessionChecklist | null) ?? null
  const poolValue = data?.pool_balance_usd_raw ?? parseFloat(data?.pool_balance_usd?.replace(/[$,]/g, '') || '0')
  const minimumPoolUsd =
    typeof data?.minimum_pool_usd_raw === 'number'
      ? data.minimum_pool_usd_raw
      : parseFloat(String(data?.minimum_pool_usd ?? '5').replace(/[$,]/g, '')) || 5
  const showSessionStatusBar = !!sessionChecklist
  const featuredCards = (topEligible.length > 0 ? topEligible : rankings.slice(0, PEDESTAL_SLOTS)).slice(
    0,
    PEDESTAL_SLOTS
  )
  
  const wsConnected = data?.ws_connected
  const lastPayoutError = data?.last_payout_error ?? null
  const payoutRetryMode = data?.payout_retry_mode === true
  const payoutRetryMinutes = data?.payout_retry_minutes ?? null

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Background: candlesticks → scrim → UI (Dex banner lives on the ticker bar) */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden>
        <CandlestickBackground />
        <div className="absolute inset-0 bg-[#030303]/30" />
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
              whileHover={{ scale: refreshCooldownSec > 0 ? 1 : 1.02 }}
              whileTap={{ scale: refreshCooldownSec > 0 ? 1 : 0.98 }}
              onClick={handleRefresh}
              disabled={refreshing || refreshCooldownSec > 0}
              title={
                refreshCooldownSec > 0
                  ? `On-chain refresh available in ${refreshCooldownSec}s`
                  : 'Refresh holder balances from chain'
              }
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs sm:text-sm font-medium transition-all border border-white/10 disabled:opacity-50"
            >
              <motion.span
                animate={refreshing ? { rotate: 360 } : {}}
                transition={{ duration: 1, repeat: refreshing ? Infinity : 0, ease: 'linear' }}
              >
                ↻
              </motion.span>
              <span className="hidden sm:inline">
                {refreshCooldownSec > 0 ? `${refreshCooldownSec}s` : 'Refresh'}
              </span>
            </motion.button>
          </>
        }
      />

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

      <main className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Price ticker — 3:1 on desktop; taller on mobile so chips stay readable */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className={`relative overflow-hidden mb-6 sm:mb-8 w-full max-w-[600px] sm:max-w-[720px] lg:max-w-[900px] mx-auto aspect-[5/4] min-h-[14rem] sm:aspect-[3/1] sm:min-h-0 rounded-2xl border border-white/10 ${
            tokenBannerUrl ? 'bg-black' : 'bg-white/5 backdrop-blur-sm'
          }`}
        >
          <SessionBannerLayer bannerUrl={tokenBannerUrl} dimmed={showBannerOverlay} />

          <button
            type="button"
            onClick={() => setShowBannerOverlay(v => !v)}
            className="absolute top-2 right-2 z-20 inline-flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-lg border border-white/25 bg-black/85 text-white shadow-[0_2px_10px_rgba(0,0,0,0.65)] backdrop-blur-sm hover:bg-black hover:text-white transition-colors"
            title={showBannerOverlay ? 'Hide info overlay' : 'Show info overlay'}
            aria-label={showBannerOverlay ? 'Hide info overlay' : 'Show info overlay'}
            aria-pressed={showBannerOverlay}
          >
              {showBannerOverlay ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                  <path d="M4 4l16 16" />
                </svg>
              )}
            </button>

          <div
            className={`ticker-on-banner relative z-10 flex h-full w-full flex-col items-center justify-between gap-2.5 sm:gap-3 p-2.5 pt-3 pb-2.5 sm:p-4 md:p-5 transition-opacity duration-300 ${
              showBannerOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-hidden={!showBannerOverlay}
          >
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: showBannerOverlay ? 1 : 0, y: showBannerOverlay ? 0 : -8 }}
              transition={{ delay: 0.08, duration: 0.35 }}
              className="ticker-stat-chip flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 sm:gap-x-3 sm:gap-y-2 rounded-xl px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 w-[calc(100%-2.75rem)] sm:w-fit max-w-full mr-auto sm:mr-0"
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <TokenAvatar symbol={tokenSymbol} iconUrl={tokenIconUrl} size="md" highlighted className="sm:hidden" />
                <TokenAvatar symbol={tokenSymbol} iconUrl={tokenIconUrl} size="lg" highlighted className="hidden sm:inline-flex" />
                <span className="hidden sm:inline text-white/80 text-sm shrink-0">Token</span>
                <span className="text-rh-lime font-bold text-sm sm:text-base truncate">${tokenSymbol}</span>
              </div>
              {tokenMint ? (
                <CopyContractAddress
                  variant="inline"
                  address={tokenMint}
                  symbol={tokenSymbol}
                  explorerUrl={tokenExplorerUrl}
                  className="ticker-ca-inline"
                />
              ) : (
                <span className="text-xs text-white/50 font-mono">Loading CA…</span>
              )}
            </motion.div>

            <div className="grid grid-cols-3 gap-1.5 sm:gap-3 w-full max-w-xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: showBannerOverlay ? 1 : 0, y: showBannerOverlay ? 0 : 12 }}
                transition={{ delay: 0.14, duration: 0.35 }}
                className="ticker-stat-chip rounded-xl px-1.5 py-2 sm:px-3.5 sm:py-2.5 min-w-0 text-center"
              >
                <div className="flex items-center justify-center gap-1 sm:gap-1.5 mb-0.5">
                  <span className="text-white/85 text-[10px] sm:text-xs uppercase tracking-wide">Price</span>
                  {isLive ? (
                    <span
                      className={`ticker-live-badge text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        connection === 'websocket'
                          ? 'bg-rh-green/25 text-rh-lime'
                          : 'bg-amber-500/35 text-amber-100'
                      }`}
                      title={connection === 'websocket' ? 'DexScreener WebSocket' : 'DexScreener live poll (1s)'}
                    >
                      {connection === 'websocket' ? 'Live' : '1s'}
                    </span>
                  ) : null}
                </div>
                {price || data?.token_price_raw ? (
                  <div className="flex justify-center">
                    <span className="sm:hidden">
                      <PriceTicker price={price || data?.token_price_raw} size="sm" />
                    </span>
                    <span className="hidden sm:inline">
                      <PriceTicker price={price || data?.token_price_raw} size="md" />
                    </span>
                  </div>
                ) : (
                  <span className="text-white/50 font-mono text-xs sm:text-sm">Loading...</span>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: showBannerOverlay ? 1 : 0, y: showBannerOverlay ? 0 : 12 }}
                transition={{ delay: 0.2, duration: 0.35 }}
                className="ticker-stat-chip rounded-xl px-1.5 py-2 sm:px-3.5 sm:py-2.5 min-w-0 text-center"
              >
                <span className="block text-white/85 text-[10px] sm:text-xs uppercase tracking-wide mb-0.5">
                  MCap
                </span>
                <span className="font-bold font-mono text-white text-xs sm:text-lg tabular-nums">
                  {marketCap ? (
                    <AnimatedNumber value={marketCap} format="currency" />
                  ) : (
                    <span className="text-white/50">--</span>
                  )}
                </span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: showBannerOverlay ? 1 : 0, y: showBannerOverlay ? 0 : 12 }}
                transition={{ delay: 0.26, duration: 0.35 }}
                className="ticker-stat-chip rounded-xl px-1.5 py-2 sm:px-3.5 sm:py-2.5 min-w-0 text-center"
              >
                <span className="block text-white/85 text-[10px] sm:text-xs uppercase tracking-wide mb-0.5">
                  Holders
                </span>
                <span
                  className="font-bold font-mono text-white text-xs sm:text-lg tabular-nums"
                  title={
                    trueHolderCount != null
                      ? `${trueHolderCount.toLocaleString()} total holders on this token · top ${leaderboardTrackedCount} ranked for rewards`
                      : undefined
                  }
                >
                  {trueHolderCount != null ? formatNumber(trueHolderCount) : <InlineSpinner />}
                </span>
              </motion.div>
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
                  animate={isTimerActive && !isPayoutDueNow ? { rotate: 360 } : { scale: [1, 1.1, 1] }}
                  transition={isTimerActive && !isPayoutDueNow
                    ? { duration: 2, repeat: Infinity, ease: 'linear' }
                    : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-4 h-4"
                >
                  {isTimerActive && !isPayoutDueNow ? '⏱️' : '⏳'}
                </motion.div>
                {isSyncingHolders
                  ? 'SYNCING HOLDERS'
                  : isPoolLimbo
                    ? 'WAITING FOR TOPUP'
                    : isListingLimbo
                      ? 'WAITING FOR FIRST ELIGIBLE HOLDER'
                      : isTimerStarting
                        ? 'PAYOUT TIMER STARTING'
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
              ) : isPoolLimbo ? (
                <div className="py-4">
                  <p className="text-2xl md:text-3xl font-bold text-amber-300 font-mono mb-3">
                    ${poolValue.toFixed(2)} / ${minimumPoolUsd.toFixed(0)} min
                  </p>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Payout wallet needs at least ${minimumPoolUsd.toFixed(0)} USD in SOL before cycles can start.
                    If SOL is drained below that, the session stays in limbo — send SOL to the wallet below.
                  </p>
                </div>
              ) : isListingLimbo ? (
                <div className="py-4">
                  <p className="text-2xl md:text-3xl font-bold text-rh-lime font-mono mb-3">Listing limbo</p>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Holders are tracked but none pass every rule yet. The payout timer starts when the first wallet qualifies.
                  </p>
                </div>
              ) : isTimerStarting ? (
                <div className="py-4">
                  <p className="text-2xl md:text-3xl font-bold text-rh-lime font-mono mb-3">
                    {eligibleCount} eligible {eligibleCount === 1 ? 'holder' : 'holders'}
                  </p>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Winners are set — starting the payout timer on the next sync.
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
                {isPoolLimbo
                  ? `No payout cycle until the wallet holds at least $${minimumPoolUsd.toFixed(0)} USD in SOL`
                  : isListingLimbo
                    ? 'No payout cycle until someone qualifies'
                    : isTimerStarting
                    ? `Top ${winnerCount} eligible losers will receive pool SOL each cycle once the timer is live`
                    : isPayoutDueNow
                      ? 'On-chart buy + token airdrops — timer resets after completion'
                      : payoutRetryMode
                        ? `Retry scheduled — faster ${payoutRetryMinutes ?? 3} min interval after swap failure`
                        : `Top ${winnerCount} losers receive session tokens via on-chart buyback each cycle`}
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
              </p>
              {data?.payout_wallet_address ? (
                <div className="mt-1.5">
                  <CopyContractAddress
                    variant="footer"
                    address={data.payout_wallet_address}
                    explorerUrl={getAddressExplorerUrl(data.payout_wallet_address)}
                  />
                  <p className="text-[0.65rem] text-gray-600 mt-1">
                    Send SOL to this public address to fund the pool — no account needed.
                  </p>
                </div>
              ) : null}
            </div>
          </motion.div>
        </div>

        {showSessionStatusBar ? (
          <SessionStatusBar
            checklist={sessionChecklist}
            eligibleCount={eligibleCount}
            timerStatus={effectiveTimerStatus}
            winnerCount={winnerCount}
          />
        ) : null}

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
                {showLimbo
                  ? isPoolLimbo
                    ? 'Pool limbo — waiting for top-up'
                    : 'Listing limbo — tracked holders'
                  : 'Current Winners'}
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                {isPoolLimbo
                  ? `Payout wallet is below $${minimumPoolUsd.toFixed(0)} USD in SOL — cycles stay paused until it is refilled.`
                  : showLimbo
                    ? 'No one eligible yet — each card shows why. Timer starts when the first holder passes every rule.'
                  : winnerCount > PEDESTAL_SLOTS
                    ? `Top ${PEDESTAL_SLOTS} highlighted · ${winnerCount} winners paid each cycle — see table for all payout shares`
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
                  const hasVwap = hasVerifiedBuyHistory(winner.vwap_raw, winner.ineligible_reason)
                  const eligibleRank = winner.eligible_rank ?? (isEligible ? idx + 1 : null)
                  const payoutInfo = isEligible
                    ? getWinnerPayoutInfo(poolValue, eligibleRank, winnerCount, winnerSharePercents)
                    : null
                  const shareLabel = payoutInfo ? `${payoutInfo.sharePercent}%` : '—'

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
                          {isEligible && payoutInfo ? (
                            <div className="text-rh-green font-bold text-lg">
                              <AnimatedNumber value={payoutInfo.amount} format="currency" />
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
                {winnerCount > PEDESTAL_SLOTS ? (
                  <> · top {winnerCount} paid per cycle</>
                ) : null}
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
              <span>{trueHolderCount != null ? `${formatNumber(trueHolderCount)} holders` : '— holders'}</span>
              <span className="hidden sm:inline w-px h-4 bg-white/20" />
              <span>{leaderboardTrackedCount} ranked for rewards</span>
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
                winnerCount={winnerCount}
                winnerSharePercents={winnerSharePercents}
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
                  const hasVwap = hasVerifiedBuyHistory(holder.vwap_raw, holder.ineligible_reason)
                  const eligibleRank = holder.eligible_rank
                  const isWinnerSlot =
                    isEligible && eligibleRank != null && eligibleRank >= 1 && eligibleRank <= winnerCount
                  const isPedestal = isWinnerSlot && eligibleRank <= PEDESTAL_SLOTS
                  const payoutInfo = getWinnerPayoutInfo(
                    poolValue,
                    eligibleRank,
                    winnerCount,
                    winnerSharePercents
                  )
                  const style = isPedestal ? getRankStyle(eligibleRank) : getRankStyle(idx + 1)

                  return (
                    <motion.tr
                      key={`row-${holder.wallet}`}
                      initial={false}
                      animate={{ opacity: 1, x: 0 }}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${!isEligible ? 'bg-white/[0.01]' : isWinnerSlot ? 'bg-rh-green/[0.03]' : ''}`}
                    >
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{isPedestal ? style.emoji : '🏅'}</span>
                          {isWinnerSlot ? (
                            <span
                              className={`${isPedestal ? style.badge : 'bg-rh-green/20 text-rh-lime border border-rh-green/30'} w-6 h-6 rounded-full flex items-center justify-center ${isPedestal ? 'text-black text-xs font-bold' : 'text-xs font-bold font-mono'}`}
                            >
                              {eligibleRank}
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
                        {payoutInfo && isEligible ? (
                          <div>
                            <span className="text-rh-green font-bold font-mono">
                              ${payoutInfo.amount.toFixed(2)}
                            </span>
                            <span className="block text-xs text-gray-500 mt-0.5">
                              {payoutInfo.sharePercent}% share
                            </span>
                          </div>
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
            {trueHolderCount != null ? `${formatNumber(trueHolderCount)} holders on token · ` : null}
            {leaderboardTrackedCount} ranked for rewards • Top {winnerCount} losers paid every{' '}
            {data?.payout_interval_display || PAYOUT_INTERVAL_RANGE_COMPACT}
          </p>
        </motion.div>
      </main>
    </div>
  )
}
