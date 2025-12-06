'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useRealtimePrice } from '@/hooks/useRealtime'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'

export default function Home() {
  const { price, marketCap } = useRealtimePrice(15000)

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ rotate: -10 }}
              animate={{ rotate: 0 }}
              className="w-10 h-10 bg-gradient-to-br from-emerald-400 via-cyan-400 to-purple-500 rounded-xl flex items-center justify-center text-black font-bold text-xl shadow-lg shadow-emerald-500/25"
            >
              T
            </motion.div>
            <span className="text-xl font-bold">TOPBLAST</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/leaderboard" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
              Leaderboard
            </Link>
            <Link href="/stats" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
              Stats
            </Link>
            <Link href="/history" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
              History
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium mb-8"
          >
            <motion.div
              className="w-2 h-2 bg-emerald-400 rounded-full"
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            Live on Solana
          </motion.div>

          {/* Logo */}
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            className="w-24 h-24 bg-gradient-to-br from-emerald-400 via-cyan-400 to-purple-500 rounded-2xl flex items-center justify-center text-black font-bold text-5xl mx-auto mb-8 shadow-2xl shadow-emerald-500/30"
          >
            T
          </motion.div>

          {/* Title */}
          <h1 className="text-6xl md:text-7xl font-bold mb-6">
            <span className="gradient-text-accent">TOPBLAST</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 mb-4 font-light">
            The Loss-Mining Protocol
          </p>

          <p className="text-gray-400 max-w-2xl mx-auto mb-12 text-lg leading-relaxed">
            Get paid for being a <span className="text-red-400 font-semibold">top loser</span>. 
            Every hour, the top 3 wallets with the biggest drawdowns win from the reward pool.
          </p>

          {/* Live Stats */}
          {(price || marketCap) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex items-center justify-center gap-8 mb-12 py-4 px-8 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 mx-auto w-fit"
            >
              {price && (
                <div className="text-center">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Price</div>
                  <div className="text-xl font-bold font-mono text-white">
                    ${price < 0.0001 ? price.toPrecision(2) : price.toFixed(6)}
                  </div>
                </div>
              )}
              {marketCap && (
                <>
                  <div className="w-px h-10 bg-white/10" />
                  <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Market Cap</div>
                    <div className="text-xl font-bold font-mono text-white">
                      <AnimatedNumber value={marketCap} format="currency" />
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
          >
            <Link href="/leaderboard">
              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="relative px-8 py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 text-black rounded-xl font-bold text-lg shadow-lg shadow-emerald-500/25 overflow-hidden group"
              >
                <span className="relative z-10">View Leaderboard</span>
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.button>
            </Link>

            <Link href="/history">
              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 rounded-xl font-bold text-lg transition-all"
              >
                Payout History
              </motion.button>
            </Link>
          </motion.div>

          {/* Payout Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-3 gap-6 max-w-lg mx-auto mb-16"
          >
            {[
              { place: '1st', pct: 80, color: 'from-yellow-500 to-amber-400', emoji: '🥇' },
              { place: '2nd', pct: 15, color: 'from-gray-400 to-gray-300', emoji: '🥈' },
              { place: '3rd', pct: 5, color: 'from-orange-500 to-amber-500', emoji: '🥉' },
            ].map((item, idx) => (
              <motion.div
                key={item.place}
                whileHover={{ y: -4 }}
                className="text-center p-4 bg-white/5 rounded-xl border border-white/5"
              >
                <div className="text-3xl mb-2">{item.emoji}</div>
                <div className={`text-3xl font-bold bg-gradient-to-r ${item.color} bg-clip-text text-transparent`}>
                  {item.pct}%
                </div>
                <div className="text-xs text-gray-500 mt-1">{item.place} Place</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Eligibility Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="glass-panel rounded-2xl p-8 max-w-2xl mx-auto"
          >
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 justify-center">
              <span>📋</span> Eligibility Requirements
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Min Balance', value: '100K', sub: 'tokens' },
                { label: 'Hold Duration', value: '1 hr', sub: 'minimum' },
                { label: 'Min Loss', value: '10%', sub: 'of pool' },
                { label: 'Min Pool', value: '$50', sub: 'for payout' },
              ].map((item) => (
                <div key={item.label} className="bg-white/5 rounded-xl p-4 text-center">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">{item.label}</div>
                  <div className="text-2xl font-bold text-emerald-400 font-mono">{item.value}</div>
                  <div className="text-xs text-gray-500">{item.sub}</div>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 pt-4">
              <p className="text-sm text-gray-400">
                <span className="text-red-400 font-semibold">Disqualifiers:</span>{' '}
                Sold tokens • Transferred out (1hr cooldown) • Won last cycle
              </p>
            </div>
          </motion.div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-6">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-500">
          <p>Powered by Helius RPC • Real-time on-chain data</p>
        </div>
      </footer>
    </div>
  )
}
