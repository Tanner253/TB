'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useRealtimeLeaderboard, useRealtimePrice, useTimeSince, useRealtime } from '@/hooks/useRealtime'
import { AnimatedNumber, Countdown, PriceTicker } from '@/components/ui/AnimatedNumber'
import { LeaderboardCardSkeleton, TableRowSkeleton } from '@/components/ui/Skeleton'

// External Links
const LINKS = {
  twitter: 'https://x.com/TOPBLASTX',
  github: 'https://github.com/Tanner253/TB',
  whitepaper: 'https://topblastx100.vercel.app',
}

// Social Icons
const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
)

const GitHubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
)

const DocsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
  </svg>
)

interface Winner {
  rank: number
  wallet: string
  wallet_display: string
  balance: string
  balance_raw?: number
  is_eligible?: boolean
  ineligible_reason?: string | null
  // Keep these for API compatibility even if not displayed
  drawdown_pct?: number
  loss_usd?: string
  vwap?: string
  payout_usd?: string
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
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
      }`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <motion.div
        className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}
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
      className="w-5 h-5 border-2 border-gray-600 border-t-emerald-500 rounded-full inline-block"
    />
  )
}

export default function LeaderboardPage() {
  const { data, loading, error, countdown, lastUpdate, refresh } = useRealtimeLeaderboard(5000)
  const { price, marketCap, loading: priceLoading } = useRealtimePrice(5000)
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
  const top3 = data?.rankings?.slice(0, 3) || []
  // Pool is now in SOL - parse the USD value for display
  const poolValue = parseFloat(data?.pool_balance_usd?.replace(/[$,]/g, '') || '0')
  const wsConnected = data?.ws_connected

  return (
    <div className="min-h-screen bg-[#06060a] text-white overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-cyan-500/5 to-transparent rounded-full" />
      </div>

      <Header
        connectionState={connectionState}
        wsConnected={wsConnected}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        lastUpdate={lastUpdate}
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
            <span className="text-cyan-400 font-bold">${data?.token_symbol || 'TOKEN'}</span>
          </div>
          <div className="w-px h-5 bg-white/20" />
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm">Price:</span>
            {price || data?.token_price_raw ? (
              <PriceTicker price={price || data?.token_price_raw} size="md" />
            ) : (
              <span className="text-gray-500 font-mono">Loading...</span>
            )}
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
            className="relative bg-gradient-to-br from-emerald-900/30 to-emerald-800/10 border border-emerald-500/30 rounded-2xl p-6 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4"
                >
                  ⏱️
                </motion.div>
                NEXT PAYOUT IN
              </div>
              <Countdown seconds={countdown} size="xl" className="text-emerald-400" />
              <p className="text-gray-400 text-sm mt-4">
                Top 3 losers will be paid automatically
              </p>
            </div>
          </motion.div>

          {/* Pool Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative bg-gradient-to-br from-purple-900/20 to-purple-800/5 border border-purple-500/20 rounded-2xl p-6 overflow-hidden"
          >
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-purple-400 text-sm font-medium mb-4">
                <span>💰</span>
                REWARD POOL
              </div>
              <div className="text-5xl font-bold text-white mb-2">
                <AnimatedNumber value={poolValue} format="currency" showChange />
              </div>
              <p className="text-gray-400 text-sm">
                {data?.pool_balance_sol || data?.pool_balance_tokens} SOL
              </p>
            </div>
          </motion.div>
        </div>

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
                <span className="text-3xl">🎯</span>
                Current Winners
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                These wallets will receive payouts when the timer hits zero
              </p>
            </div>
            <div className="flex items-center gap-4">
              <FreshnessIndicator lastUpdate={lastUpdate} />
              <ConnectionIndicator state={connectionState} wsConnected={wsConnected} />
            </div>
          </div>

          {top3.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-6">
                {top3.map((winner: Winner, idx: number) => {
                  const style = getRankStyle(idx + 1)
                  const isEligible = winner.is_eligible !== false
                // Actual payout after 5% dev fee: 80% of 95% = 76%, 15% of 95% = 14.25%, 5% of 95% = 4.75%
                // UI shows clean percentages (80/15/5) for better UX
                  const payoutPct = isEligible ? (idx === 0 ? 0.76 : idx === 1 ? 0.1425 : 0.0475) : 0
                  const payoutAmount = poolValue * payoutPct

                  return (
                    <motion.div
                    key={`position-${idx}`}
                    initial={false}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ y: -4, transition: { duration: 0.2 } }}
                      className={`relative bg-[#0a0a10] border ${style.border} rounded-2xl p-6 ${style.glow} overflow-hidden ${!isEligible ? 'opacity-70' : ''}`}
                    >
                      {/* Rank badge */}
                      {idx === 0 && isEligible && (
                        <div className="absolute top-0 right-0">
                          <div className="bg-gradient-to-r from-yellow-500 to-amber-400 text-black text-xs font-bold px-3 py-1 rounded-bl-lg">
                            BIGGEST LOSER
                          </div>
                        </div>
                      )}
                      {!isEligible && (
                        <div className="absolute top-0 right-0">
                          <div className="bg-gray-600 text-white text-xs font-medium px-3 py-1 rounded-bl-lg">
                            {winner.ineligible_reason || 'Not eligible'}
                          </div>
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
                          <div className={`${style.badge} w-8 h-8 rounded-full flex items-center justify-center text-black font-bold text-lg shadow-lg`}>
                            {idx + 1}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-400 font-mono">{winner.wallet_display}</div>
                          {isEligible ? (
                            <div className="text-emerald-400 font-bold text-lg">
                              <AnimatedNumber value={payoutAmount} format="currency" />
                            </div>
                          ) : (
                            <div className="text-gray-500 text-sm">No payout</div>
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
                          {idx === 0 ? '👑' : idx === 1 ? '⚔️' : '🛡️'}
                        </motion.div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between py-2 border-b border-white/5">
                          <span className="text-gray-500">Position</span>
                          <span className="text-white font-bold">{idx === 0 ? 'Biggest Loser' : idx === 1 ? 'Runner Up' : 'Third Place'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-white/5">
                          <span className="text-gray-500">Balance</span>
                          <span className="text-white font-mono">{formatNumber(winner.balance)}</span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-gray-500">Share</span>
                          <span className="text-emerald-400 font-bold">{idx === 0 ? '80%' : idx === 1 ? '15%' : '5%'}</span>
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
              className="bg-[#0a0a10] border border-white/10 rounded-2xl p-12 text-center"
            >
              {isLoading || isInitializing ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-12 h-12 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full mx-auto mb-4"
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
          className="bg-[#0a0a10] border border-white/10 rounded-2xl overflow-hidden"
        >
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Top Losers Leaderboard</h2>
              <p className="text-sm text-gray-400 mt-1">
                {data?.eligible_count || 0} eligible for payout • Rankings updated in real-time
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
                  <th className="px-6 py-4 font-medium text-right">Balance</th>
                  <th className="px-6 py-4 font-medium text-center">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Payout</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rankings || []).slice(0, 10).map((holder: Winner, idx: number) => {
                  const isEligible = holder.is_eligible !== false
                  // Actual payout after 5% dev fee (UI shows clean 80/15/5 percentages)
                  const payoutPct = isEligible && idx === 0 ? 0.76 : isEligible && idx === 1 ? 0.1425 : isEligible && idx === 2 ? 0.0475 : 0
                  const payoutAmount = poolValue * payoutPct
                  const style = getRankStyle(idx + 1)

                  return (
                    <motion.tr
                      key={`row-${idx}`}
                      initial={false}
                      animate={{ opacity: 1, x: 0 }}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${!isEligible ? 'opacity-60' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{style.emoji}</span>
                          {idx < 3 && isEligible && (
                            <span className={`${style.badge} w-6 h-6 rounded-full flex items-center justify-center text-black text-xs font-bold`}>
                              {idx + 1}
                            </span>
                          )}
                          {idx >= 3 && (
                            <span className="text-gray-500 font-mono text-sm">#{idx + 1}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-gray-300">{holder.wallet_display}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono">
                        {formatNumber(holder.balance)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isEligible ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                            ✓ Eligible
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded-full" title={holder.ineligible_reason || 'Not eligible'}>
                            {holder.ineligible_reason || 'Not eligible'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {payoutPct > 0 && isEligible ? (
                          <span className="text-emerald-400 font-bold font-mono">
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
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      {isLoading || isInitializing ? (
                        <div className="flex flex-col items-center gap-2">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full"
                          />
                          <span>Loading holder data...</span>
                        </div>
                      ) : data?.total_holders && data.total_holders > 0 ? (
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-3xl">📈</span>
                          <span className="text-white font-medium">Everyone is in profit!</span>
                          <span className="text-sm">No holders currently in loss. The leaderboard will populate when the price drops.</span>
                        </div>
                      ) : (
                        <span>No eligible holders found yet</span>
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
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-sm text-emerald-400">
            <motion.div
              className="w-2 h-2 bg-emerald-400 rounded-full"
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            Real-time tracking via Helius
          </div>
          <p className="text-xs text-gray-500">
            {data?.tracked_holders || 0} holders tracked • Top 3 losers paid automatically every hour
          </p>
        </motion.div>
      </main>
    </div>
  )
}

// Header component
function Header({
  connectionState,
  wsConnected,
  onRefresh,
  refreshing,
  lastUpdate,
}: {
  connectionState: string
  wsConnected?: boolean
  onRefresh?: () => void
  refreshing?: boolean
  lastUpdate?: Date | null
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#06060a]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3 group">
              <motion.div
                whileHover={{ scale: 1.05, rotate: 5 }}
                className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-emerald-500/25"
              >
                <Image src="/logo.jpg" alt="TopBlast" width={40} height={40} className="w-full h-full object-cover" />
              </motion.div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                TOPBLAST
              </span>
            </Link>
            <ConnectionIndicator state={connectionState} wsConnected={wsConnected} />
          </div>

          <nav className="flex items-center gap-6">
            {onRefresh && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-all border border-white/10 disabled:opacity-50"
              >
                <motion.span
                  animate={refreshing ? { rotate: 360 } : {}}
                  transition={{ duration: 1, repeat: refreshing ? Infinity : 0, ease: 'linear' }}
                >
                  🔄
                </motion.span>
                Refresh
              </motion.button>
            )}
            <Link
              href="/history"
              className="text-gray-400 hover:text-white text-sm font-medium transition-colors"
            >
              History
            </Link>
            <Link
              href="/stats"
              className="text-gray-400 hover:text-white text-sm font-medium transition-colors"
            >
              Stats
            </Link>
            <a href={LINKS.whitepaper} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-emerald-400 transition-colors" title="Whitepaper">
              <DocsIcon />
            </a>
            <a href={LINKS.twitter} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors" title="Follow on X">
              <XIcon />
            </a>
            <a href={LINKS.github} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors" title="GitHub">
              <GitHubIcon />
            </a>
          </nav>
        </div>
      </div>
    </header>
  )
}
