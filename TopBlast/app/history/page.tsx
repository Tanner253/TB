'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useTenantRouting } from '@/hooks/useTenantRouting'
import Image from 'next/image'
import { getDevFeePercent } from '@/lib/payout/shares'
import { AppHeader } from '@/components/platform/AppHeader'
import { CopyContractAddress } from '@/components/ui/CopyContractAddress'
import { DEFAULT_HISTORY_POLL_MS } from '@/lib/platform/clientPollIntervals'

const DEV_FEE = getDevFeePercent()

// Types matching the API response
interface PayoutEntry {
  rank: number
  type: 'dev_fee' | 'winner'
  wallet: string
  wallet_display: string
  amount_eth: string
  amount_unit: string
  amount_usd: string
  drawdown_pct: string | null
  loss_usd: string | null
  tx_hash: string | null
  explorer_url: string | null
  status: 'success' | 'failed'
  error: string | null
}

interface PayoutCycle {
  id: string
  cycle: number
  tenant_slug: string
  session_slug: string
  token_symbol: string
  token_mint: string | null
  token_mint_explorer_url: string | null
  timestamp: string
  payouts: PayoutEntry[]
  total_usd: string
  total_usd_formatted: string
  total_sol: string
  total_token_amount: string | null
  total_token_symbol: string | null
  success_count: number
  failed_count: number
  status: 'success' | 'failed' | 'partial'
}

interface HistoryStats {
  total_cycles: number
  total_payouts: number
  total_distributed_eth: string
  total_distributed_usd: string
  total_distributed_usd_formatted: string
  failed_payouts: number
  sessions: number
}

interface HistoryData {
  network: string
  token_symbol: string
  stats: HistoryStats
  cycles: PayoutCycle[]
}

function formatCycleTotal(cycle: PayoutCycle): string {
  const parts: string[] = []
  if (cycle.total_token_amount && cycle.total_token_symbol) {
    parts.push(`${cycle.total_token_amount} ${cycle.total_token_symbol}`)
  }
  if (Number.parseFloat(cycle.total_sol.replace(/,/g, '')) > 0) {
    parts.push(`${cycle.total_sol} SOL`)
  }
  return parts.length > 0 ? parts.join(' + ') : cycle.total_usd_formatted
}

function formatCycleTotalShort(cycle: PayoutCycle): string {
  if (cycle.total_token_amount && cycle.total_token_symbol) {
    return `${cycle.total_token_amount} ${cycle.total_token_symbol}`
  }
  if (Number.parseFloat(cycle.total_sol.replace(/,/g, '')) > 0) {
    return `${cycle.total_sol} SOL`
  }
  return cycle.total_usd_formatted
}

function getRankBadge(rank: number, type: string) {
  if (type === 'dev_fee') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-2xl">🔧</span>
        <span className="bg-rh-green-dark/30 text-rh-lime px-2 py-0.5 rounded text-xs font-medium">
          DEV
        </span>
      </div>
    )
  }
  
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
    case 'success':
      return (
        <motion.span
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className="inline-flex items-center gap-1.5 bg-rh-green/20 text-rh-green px-3 py-1 rounded-full text-xs font-medium"
        >
          <span className="w-1.5 h-1.5 bg-rh-green rounded-full" />
          Success
        </motion.span>
      )
    case 'partial':
      return (
        <span className="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-xs font-medium">
          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
          Partial
        </span>
      )
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1.5 bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-medium">
          <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
          Failed
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
  const { basePath } = useTenantRouting()
  const [data, setData] = useState<HistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/history')
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
    const interval = setInterval(fetchHistory, DEFAULT_HISTORY_POLL_MS)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-2 border-rh-green/30 border-t-rh-green rounded-full mx-auto mb-4"
          />
          <p className="text-gray-400">Loading history...</p>
        </motion.div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-xl text-red-400">{error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-20 right-20 w-80 h-80 bg-rh-green/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-rh-green-dark/5 rounded-full blur-3xl" />
      </div>

      <AppHeader active="history" />

      <main className="relative max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Page Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">Payout History</h1>
          <p className="text-gray-400">
            All sessions · {data?.stats.sessions ?? 0} token{data?.stats.sessions === 1 ? '' : 's'} ·{' '}
            {data?.stats.total_cycles || 0} cycles · {data?.stats.total_payouts || 0} successful ·{' '}
            {data?.stats.total_distributed_usd_formatted || '$0'} distributed
            {data?.network === 'devnet' && (
              <span className="ml-2 text-amber-400">(Devnet)</span>
            )}
          </p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8"
        >
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-sm text-gray-400">Sessions</div>
            <div className="text-2xl font-bold text-white">{data?.stats.sessions || 0}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-sm text-gray-400">Total Cycles</div>
            <div className="text-2xl font-bold text-white">{data?.stats.total_cycles || 0}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-sm text-gray-400">Successful</div>
            <div className="text-2xl font-bold text-rh-green">{data?.stats.total_payouts || 0}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-sm text-gray-400">Failed</div>
            <div className="text-2xl font-bold text-red-400">{data?.stats.failed_payouts || 0}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-sm text-gray-400">Distributed</div>
            <div className="text-2xl font-bold text-rh-lime">{data?.stats.total_distributed_usd_formatted || '$0'}</div>
          </div>
        </motion.div>

        {/* History List */}
        <AnimatePresence>
          {data?.cycles && data.cycles.length > 0 ? (
            data.cycles.map((cycle, cycleIdx) => (
              <motion.div
                key={cycle.id || `${cycle.session_slug}-${cycle.cycle}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: cycleIdx * 0.1 }}
                className="bg-rh-black border border-white/10 rounded-2xl mb-6 overflow-hidden"
              >
                {/* Cycle Header */}
                <div className="p-5 bg-white/5 border-b border-white/10 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-lg font-bold flex items-center gap-3 flex-wrap">
                      <span className="text-rh-green">Cycle #{cycle.cycle}</span>
                      <Link
                        href={`/${cycle.session_slug}/leaderboard`}
                        className="text-sm font-medium text-rh-lime/90 hover:text-rh-lime transition-colors"
                      >
                        ${cycle.token_symbol}
                      </Link>
                      {getStatusBadge(cycle.status)}
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                      {new Date(cycle.timestamp).toLocaleString()} • {formatTimeAgo(cycle.timestamp)}
                    </p>
                    {cycle.token_mint && (
                      <div className="mt-2">
                        <CopyContractAddress
                          address={cycle.token_mint}
                          symbol={cycle.token_symbol}
                          explorerUrl={cycle.token_mint_explorer_url}
                          variant="inline"
                        />
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Total Paid</div>
                    <div className="text-lg font-bold text-white">{cycle.total_usd_formatted}</div>
                    <div className="text-xs text-gray-500">{formatCycleTotal(cycle)}</div>
                  </div>
                </div>

                {/* Payouts */}
                {cycle.payouts && cycle.payouts.length > 0 ? (
                  <div className="divide-y divide-white/5">
                    {cycle.payouts.map((payout, idx) => (
                      <motion.div
                        key={`${cycle.cycle}-${payout.rank}-${idx}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: cycleIdx * 0.1 + idx * 0.05 }}
                        className={`p-5 hover:bg-white/5 transition-colors ${payout.status === 'failed' ? 'bg-red-500/5' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {getRankBadge(payout.rank, payout.type)}
                            <div>
                              <div className="font-mono text-white font-medium flex items-center gap-2">
                                {payout.wallet_display}
                                {payout.explorer_url && (
                                  <a 
                                    href={payout.explorer_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-rh-green hover:text-rh-lime transition-colors"
                                    title="View on Solscan"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </a>
                                )}
                              </div>
                              <div className="text-sm text-gray-400 mt-1 flex items-center gap-2">
                                {payout.type === 'dev_fee' ? (
                                  <span>Developer Fee ({DEV_FEE}%)</span>
                                ) : (
                                  <>
                                    <span>{payout.rank === 1 ? '🔥 Biggest Loser' : payout.rank === 2 ? '⚔️ Runner Up' : '🛡️ Third Place'}</span>
                                    {payout.drawdown_pct && (
                                      <span className="text-red-400">-{payout.drawdown_pct}%</span>
                                    )}
                                  </>
                                )}
                                {payout.status === 'failed' && (
                                  <span className="text-red-400 text-xs">• Failed: {payout.error}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-xl font-bold tabular-nums ${payout.status === 'success' ? 'text-rh-green' : 'text-red-400 line-through'}`}>
                              {payout.amount_eth} {payout.amount_unit}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">${payout.amount_usd}</div>
                          </div>
                        </div>
                        
                        {/* TX Hash */}
                        {payout.tx_hash && (
                          <div className="mt-3 pt-3 border-t border-white/5">
                            <span className="text-xs text-gray-500">TX: </span>
                            <a 
                              href={payout.explorer_url || '#'} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs font-mono text-rh-green/70 hover:text-rh-green transition-colors"
                            >
                              {payout.tx_hash.slice(0, 20)}...{payout.tx_hash.slice(-8)}
                            </a>
                          </div>
                        )}
                      </motion.div>
                    ))}
                    
                    {/* Summary */}
                    <div className="p-5 bg-rh-green/5 border-t border-rh-green/20">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">
                          {cycle.success_count} successful, {cycle.failed_count} failed
                        </span>
                        <span className="text-xl font-bold text-rh-green tabular-nums">
                          {formatCycleTotalShort(cycle)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <div className="text-4xl mb-3">🔍</div>
                    <p className="text-gray-400">No payouts this cycle</p>
                  </div>
                )}
              </motion.div>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-rh-black border border-white/10 rounded-2xl p-12 text-center"
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
                Winners from every session will appear here after payout cycles complete.
                All transactions are recorded on-chain with Solscan links.
              </p>
              <Link href={basePath ? `${basePath}/leaderboard` : '/leaderboard'}>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-6 py-3 bg-rh-green/20 hover:bg-rh-green/30 border border-rh-green/30 rounded-xl text-rh-green font-medium transition-all"
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
