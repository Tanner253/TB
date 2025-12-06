'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

interface Winner {
  rank: number
  wallet: string
  wallet_display: string
  drawdown_pct: number
  loss_usd: string
  payout_usd: string
  payout_pct: string
}

interface PayoutCycle {
  id: string
  cycle: number
  timestamp: string
  pool_balance_usd: string
  token_price: number
  status: 'completed' | 'no_winners' | 'pool_empty'
  message: string
  total_distributed_usd: string
  winners: Winner[]
}

interface HistoryStats {
  total_cycles: number
  completed_payouts: number
  total_distributed_usd: string
  total_winners: number
  current_cycle: number
  next_payout_at: string | null
}

interface HistoryData {
  token_symbol: string
  stats: HistoryStats
  cycles: PayoutCycle[]
}

function getRankBadge(rank: number) {
  const styles = {
    1: { emoji: '🥇', bg: 'bg-gradient-to-r from-yellow-500 to-amber-400', text: 'text-black' },
    2: { emoji: '🥈', bg: 'bg-gradient-to-r from-gray-400 to-gray-300', text: 'text-black' },
    3: { emoji: '🥉', bg: 'bg-gradient-to-r from-orange-500 to-amber-500', text: 'text-black' },
  }
  
  const style = styles[rank as keyof typeof styles] || { emoji: '🏅', bg: 'bg-white/10', text: 'text-white' }
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl">{style.emoji}</span>
      <span className={`${style.bg} ${style.text} w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold`}>
        {rank}
      </span>
    </div>
  )
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return (
        <motion.span
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-medium"
        >
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
          Completed
        </motion.span>
      )
    case 'no_winners':
      return (
        <span className="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-xs font-medium">
          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
          No Winners
        </span>
      )
    case 'pool_empty':
      return (
        <span className="inline-flex items-center gap-1.5 bg-gray-500/20 text-gray-400 px-3 py-1 rounded-full text-xs font-medium">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
          Pool Empty
        </span>
      )
    default:
      return null
  }
}

function formatTimeAgo(timestamp: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

export default function HistoryPage() {
  const [data, setData] = useState<HistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/leaderboard/history')
        const json = await res.json()
        if (json.success) {
          setData(json.data)
          setError(null)
        } else {
          setError(json.error || 'Failed to fetch history')
        }
      } catch {
        setError('Failed to connect to server')
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchHistory, 30000)
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
          <p className="text-gray-400">Loading history...</p>
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
        <div className="absolute top-20 right-20 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#06060a]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-4">
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
              <Link href="/stats" className="text-gray-400 hover:text-white transition-colors text-sm">
                Stats
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="relative max-w-4xl mx-auto px-4 py-8">
        {/* Page Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">Payout History</h1>
          <p className="text-gray-400">
            {data?.stats.total_cycles || 0} cycles • {data?.stats.total_winners || 0} winners • {data?.stats.total_distributed_usd || '$0.00'} distributed
          </p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-sm text-gray-400">Total Cycles</div>
            <div className="text-2xl font-bold text-white">{data?.stats.total_cycles || 0}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-sm text-gray-400">With Winners</div>
            <div className="text-2xl font-bold text-emerald-400">{data?.stats.completed_payouts || 0}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-sm text-gray-400">Total Winners</div>
            <div className="text-2xl font-bold text-cyan-400">{data?.stats.total_winners || 0}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-sm text-gray-400">Distributed</div>
            <div className="text-2xl font-bold text-purple-400">{data?.stats.total_distributed_usd || '$0.00'}</div>
          </div>
        </motion.div>

        {/* History List */}
        <AnimatePresence>
          {data?.cycles && data.cycles.length > 0 ? (
            data.cycles.map((cycle, cycleIdx) => (
              <motion.div
                key={cycle.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: cycleIdx * 0.1 }}
                className="bg-[#0a0a10] border border-white/10 rounded-2xl mb-6 overflow-hidden"
              >
                {/* Cycle Header */}
                <div className="p-5 bg-white/5 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold flex items-center gap-3">
                      <span className="text-emerald-400">Cycle #{cycle.cycle}</span>
                      {getStatusBadge(cycle.status)}
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                      {new Date(cycle.timestamp).toLocaleString()} • {formatTimeAgo(cycle.timestamp)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Pool</div>
                    <div className="text-lg font-bold text-white">{cycle.pool_balance_usd}</div>
                  </div>
                </div>

                {/* Winners or Message */}
                {cycle.winners.length > 0 ? (
                  <div className="divide-y divide-white/5">
                    {cycle.winners.map((winner, winnerIdx) => (
                      <motion.div
                        key={`${cycle.id}-${winner.rank}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: cycleIdx * 0.1 + winnerIdx * 0.05 }}
                        className="p-5 hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {getRankBadge(winner.rank)}
                            <div>
                              <div className="font-mono text-white font-medium">
                                {winner.wallet_display}
                              </div>
                              <div className="text-sm text-gray-400 mt-1">
                                {winner.rank === 1 ? '🔥 Biggest Loser' : winner.rank === 2 ? '⚔️ Runner Up' : '🛡️ Third Place'}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-emerald-400">{winner.payout_usd}</div>
                            <div className="text-sm text-gray-500 mt-1">{winner.payout_pct}</div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    
                    {/* Total */}
                    <div className="p-5 bg-emerald-500/5 border-t border-emerald-500/20">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Total Distributed</span>
                        <span className="text-xl font-bold text-emerald-400">{cycle.total_distributed_usd}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <div className="text-4xl mb-3">🔍</div>
                    <p className="text-gray-400">{cycle.message}</p>
                  </div>
                )}
              </motion.div>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#0a0a10] border border-white/10 rounded-2xl p-12 text-center"
            >
              <motion.div
                className="text-6xl mb-4"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                📭
              </motion.div>
              <h2 className="text-2xl font-bold mb-3">No Payouts Yet</h2>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                Winners will appear here after the first payout cycle is processed.
                The timer resets every 5 minutes.
              </p>
              <Link href="/leaderboard">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-6 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-xl text-emerald-400 font-medium transition-all"
                >
                  View Leaderboard
                </motion.button>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
