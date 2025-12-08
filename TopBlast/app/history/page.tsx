'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'

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

// Types matching the API response
interface PayoutEntry {
  rank: number
  type: 'dev_fee' | 'winner'
  wallet: string
  wallet_display: string
  amount_sol: string
  amount_usd: string
  drawdown_pct: string | null
  loss_usd: string | null
  tx_hash: string | null
  solscan_url: string | null
  status: 'success' | 'failed'
  error: string | null
}

interface PayoutCycle {
  cycle: number
  timestamp: string
  payouts: PayoutEntry[]
  total_sol: string
  total_usd: string
  success_count: number
  failed_count: number
  status: 'success' | 'failed' | 'partial'
}

interface HistoryStats {
  total_cycles: number
  total_payouts: number
  total_distributed_sol: string
  failed_payouts: number
}

interface HistoryData {
  network: string
  token_symbol: string
  stats: HistoryStats
  cycles: PayoutCycle[]
}

function getRankBadge(rank: number, type: string) {
  if (type === 'dev_fee') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-2xl">🔧</span>
        <span className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded text-xs font-medium">
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
          className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-medium"
        >
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
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
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-emerald-500/25">
                <Image src="/logo.jpg" alt="TopBlast" width={40} height={40} className="w-full h-full object-cover" />
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

      <main className="relative max-w-4xl mx-auto px-4 py-8">
        {/* Page Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">Payout History</h1>
          <p className="text-gray-400">
            {data?.stats.total_cycles || 0} cycles • {data?.stats.total_payouts || 0} successful payouts • {data?.stats.total_distributed_sol || '0'} SOL distributed
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
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-sm text-gray-400">Total Cycles</div>
            <div className="text-2xl font-bold text-white">{data?.stats.total_cycles || 0}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-sm text-gray-400">Successful</div>
            <div className="text-2xl font-bold text-emerald-400">{data?.stats.total_payouts || 0}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-sm text-gray-400">Failed</div>
            <div className="text-2xl font-bold text-red-400">{data?.stats.failed_payouts || 0}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-sm text-gray-400">Distributed</div>
            <div className="text-2xl font-bold text-purple-400">{data?.stats.total_distributed_sol || '0'} SOL</div>
          </div>
        </motion.div>

        {/* History List */}
        <AnimatePresence>
          {data?.cycles && data.cycles.length > 0 ? (
            data.cycles.map((cycle, cycleIdx) => (
              <motion.div
                key={cycle.cycle}
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
                    <div className="text-sm text-gray-400">Total Paid</div>
                    <div className="text-lg font-bold text-white">{cycle.total_sol} SOL</div>
                    <div className="text-xs text-gray-500">${cycle.total_usd}</div>
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
                                {payout.solscan_url && (
                                  <a 
                                    href={payout.solscan_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-emerald-400 hover:text-emerald-300 transition-colors"
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
                                  <span>Developer Fee (5%)</span>
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
                            <div className={`text-xl font-bold ${payout.status === 'success' ? 'text-emerald-400' : 'text-red-400 line-through'}`}>
                              {payout.amount_sol} SOL
                            </div>
                            <div className="text-sm text-gray-500 mt-1">${payout.amount_usd}</div>
                          </div>
                        </div>
                        
                        {/* TX Hash */}
                        {payout.tx_hash && (
                          <div className="mt-3 pt-3 border-t border-white/5">
                            <span className="text-xs text-gray-500">TX: </span>
                            <a 
                              href={payout.solscan_url || '#'} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs font-mono text-emerald-400/70 hover:text-emerald-400 transition-colors"
                            >
                              {payout.tx_hash.slice(0, 20)}...{payout.tx_hash.slice(-8)}
                            </a>
                          </div>
                        )}
                      </motion.div>
                    ))}
                    
                    {/* Summary */}
                    <div className="p-5 bg-emerald-500/5 border-t border-emerald-500/20">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">
                          {cycle.success_count} successful, {cycle.failed_count} failed
                        </span>
                        <span className="text-xl font-bold text-emerald-400">{cycle.total_sol} SOL</span>
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
                All transactions are recorded on-chain with Solscan links.
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
