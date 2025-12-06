'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRealtimePrice, useTimeSince } from '@/hooks/useRealtime'
import { AnimatedNumber, PriceTicker } from '@/components/ui/AnimatedNumber'

interface StatsData {
  token: {
    symbol: string
    mint: string
    price: string
    price_raw: number | null
    price_change_24h: number | null
    market_cap: string
    market_cap_raw: number | null
  }
  holders: {
    total: number
    tracked: number
    with_vwap: number
    eligible: number
    in_profit: number
    in_loss: number
  }
  protocol: {
    total_cycles: number
    total_distributed_usd: string
    average_pool_size_usd: string
    current_pool_usd: string
    payout_split: {
      first: string
      second: string
      third: string
    }
  }
  leaderboard: {
    deepest_drawdown: {
      wallet_display: string
      drawdown_pct: number
    } | null
    most_wins: {
      wallet_display: string
      win_count: number
    } | null
  }
  thresholds: {
    min_balance: string
    min_hold_hours: number
    min_loss_pct: number
  }
  service: {
    initialized: boolean
    init_in_progress: boolean
    last_refresh: string | null
  }
}

interface PoolData {
  balance_usd: string
  balance_tokens: string
  total_distributed_usd: string
  total_cycles: number
  average_payout_usd: string
  payout_enabled: boolean
  minimum_pool_usd: string
  payout_split: {
    first: string
    second: string
    third: string
  }
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [pool, setPool] = useState<PoolData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  
  const { price, marketCap } = useRealtimePrice(10000)
  const secondsAgo = useTimeSince(lastUpdate)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, poolRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/pool'),
        ])

        const statsJson = await statsRes.json()
        const poolJson = await poolRes.json()

        if (statsJson.success) setStats(statsJson.data)
        if (poolJson.success) setPool(poolJson.data)
        setLastUpdate(new Date())
        setError(null)
      } catch {
        setError('Failed to connect to server')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06060a] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full mx-auto mb-4"
          />
          <p className="text-gray-400">Loading statistics...</p>
        </motion.div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#06060a] flex items-center justify-center">
        <div className="text-xl text-red-400">{error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#06060a] text-white">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#06060a]/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 via-cyan-400 to-purple-500 rounded-xl flex items-center justify-center text-black font-bold text-xl">
                T
              </div>
              <span className="text-xl font-bold">TOPBLAST</span>
            </Link>
            <nav className="flex items-center gap-6">
              <Link href="/leaderboard" className="text-gray-400 hover:text-white transition-colors text-sm">
                Leaderboard
              </Link>
              <Link href="/history" className="text-gray-400 hover:text-white transition-colors text-sm">
                History
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="relative max-w-5xl mx-auto px-4 py-8">
        {/* Page Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">Protocol Statistics</h1>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>Real-time data from Helius</span>
            {lastUpdate && (
              <>
                <span className="w-1 h-1 bg-gray-600 rounded-full" />
                <span>Updated {secondsAgo}s ago</span>
              </>
            )}
            {stats?.service?.initialized && (
              <>
                <span className="w-1 h-1 bg-emerald-500 rounded-full" />
                <span className="text-emerald-400">Service Ready</span>
              </>
            )}
          </div>
        </motion.div>

        {/* Token Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6"
        >
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span>💎</span> Token
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Symbol</div>
              <div className="text-2xl font-bold text-cyan-400">${stats?.token.symbol}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Price</div>
              <PriceTicker price={price || stats?.token.price_raw} size="lg" />
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">24h Change</div>
              <div className="text-2xl font-bold text-gray-500">
                {stats?.token.price_change_24h !== null
                  ? `${(stats?.token.price_change_24h ?? 0) >= 0 ? '+' : ''}${stats?.token.price_change_24h?.toFixed(2)}%`
                  : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Market Cap</div>
              <div className="text-2xl font-bold">
                {marketCap ? (
                  <AnimatedNumber value={marketCap} format="currency" />
                ) : (
                  <span className="text-gray-500">{stats?.token.market_cap || 'N/A'}</span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Pool Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6"
        >
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span>💰</span> Reward Pool
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Current Balance</div>
              <div className="text-3xl font-bold text-emerald-400">{pool?.balance_usd || stats?.protocol.current_pool_usd || '$0'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Total Distributed</div>
              <div className="text-2xl font-bold">{pool?.total_distributed_usd || '$0'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Avg Payout</div>
              <div className="text-2xl font-bold">{pool?.average_payout_usd || '$0'}</div>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <motion.div
              className={`w-3 h-3 rounded-full ${pool?.payout_enabled ? 'bg-emerald-400' : 'bg-red-400'}`}
              animate={pool?.payout_enabled ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-sm text-gray-400">
              {pool?.payout_enabled ? 'Payouts Active' : `Below minimum (${pool?.minimum_pool_usd})`}
            </span>
          </div>
        </motion.div>

        {/* Holders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6"
        >
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span>👥</span> Holders
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Total</div>
              <div className="text-3xl font-bold font-mono">{stats?.holders.total?.toLocaleString() || 0}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Tracked</div>
              <div className="text-3xl font-bold font-mono text-cyan-400">{stats?.holders.tracked?.toLocaleString() || 0}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">With VWAP</div>
              <div className="text-3xl font-bold font-mono text-purple-400">{stats?.holders.with_vwap?.toLocaleString() || 0}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Eligible</div>
              <div className="text-3xl font-bold text-emerald-400 font-mono">{stats?.holders.eligible || 0}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">In Profit</div>
              <div className="text-3xl font-bold text-emerald-400 font-mono">{stats?.holders.in_profit || 0}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">In Loss</div>
              <div className="text-3xl font-bold text-red-400 font-mono">{stats?.holders.in_loss || 0}</div>
            </div>
          </div>
        </motion.div>

        {/* Records */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6"
        >
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span>🏆</span> Current Records
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white/5 rounded-xl p-5">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">Deepest Drawdown</div>
              {stats?.leaderboard.deepest_drawdown ? (
                <>
                  <div className="text-3xl font-bold text-red-400 mb-1">
                    {stats.leaderboard.deepest_drawdown.drawdown_pct.toFixed(2)}%
                  </div>
                  <div className="text-sm text-gray-500 font-mono">
                    {stats.leaderboard.deepest_drawdown.wallet_display}
                  </div>
                </>
              ) : (
                <div className="text-gray-500">No eligible holders yet</div>
              )}
            </div>
            <div className="bg-white/5 rounded-xl p-5">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">Most Wins</div>
              {stats?.leaderboard.most_wins ? (
                <>
                  <div className="text-3xl font-bold mb-1">
                    {stats.leaderboard.most_wins.win_count} wins
                  </div>
                  <div className="text-sm text-gray-500 font-mono">
                    {stats.leaderboard.most_wins.wallet_display}
                  </div>
                </>
              ) : (
                <div className="text-gray-500">No wins yet</div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Eligibility */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-6"
        >
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span>📋</span> Eligibility Thresholds
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Min Balance', value: stats?.thresholds?.min_balance || '100,000', sub: 'tokens' },
              { label: 'Hold Duration', value: `${stats?.thresholds?.min_hold_hours || 1} hour`, sub: 'minimum' },
              { label: 'Min Loss', value: `${stats?.thresholds?.min_loss_pct || 10}%`, sub: 'of pool value' },
              { label: 'Min Pool', value: pool?.minimum_pool_usd || '$50', sub: 'for payouts' },
            ].map((item) => (
              <div key={item.label} className="bg-white/5 rounded-xl p-4 text-center">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">{item.label}</div>
                <div className="text-xl font-bold text-emerald-400 font-mono">{item.value}</div>
                <div className="text-xs text-gray-500">{item.sub}</div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 pt-4">
            <h3 className="text-sm font-bold mb-3">Payout Distribution</h3>
            <div className="flex gap-2 h-10 rounded-lg overflow-hidden">
              <motion.div
                className="bg-gradient-to-r from-yellow-500 to-amber-400 flex items-center justify-center text-black font-bold text-sm"
                style={{ width: '80%' }}
                whileHover={{ scale: 1.02 }}
              >
                🥇 80%
              </motion.div>
              <motion.div
                className="bg-gradient-to-r from-gray-400 to-gray-300 flex items-center justify-center text-black font-bold text-xs"
                style={{ width: '15%' }}
                whileHover={{ scale: 1.02 }}
              >
                🥈 15%
              </motion.div>
              <motion.div
                className="bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center text-black font-bold text-xs"
                style={{ width: '5%' }}
                whileHover={{ scale: 1.02 }}
              >
                🥉
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Service Status Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center text-sm text-gray-500 space-y-2"
        >
          <p>Total Cycles Completed: {stats?.protocol.total_cycles || 0}</p>
          {stats?.service?.last_refresh && (
            <p className="text-xs">
              Last data refresh: {new Date(stats.service.last_refresh).toLocaleString()}
            </p>
          )}
        </motion.div>
      </main>
    </div>
  )
}
