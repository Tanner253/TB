'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useRealtimePrice } from '@/hooks/useRealtime'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { TopBlastLogo } from '@/components/ui/TopBlastLogo'
import { WhoGetsPaidRules } from '@/components/WhoGetsPaidRules'
import { getWinnerSharePercents, getDevFeePercent, getCommunityPercent } from '@/lib/payout/shares'

const SHARES = getWinnerSharePercents()
const DEV_FEE = getDevFeePercent()
const COMMUNITY = getCommunityPercent()

const LINKS = {
  twitter: 'https://x.com/topblasteth',
  whitepaper: 'https://topblastx100.vercel.app',
}

const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
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

export default function Home() {
  const { price, marketCap } = useRealtimePrice(15000)

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-black">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-rh-green/15 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-rh-green/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rh-lime/5 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-40" />
      </div>

      <header className="relative z-10 border-b border-rh-green/10 bg-black/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TopBlastLogo size="md" className="shadow-rh-glow-sm" />
            <span className="text-xl font-bold tracking-tight">
              <span className="text-rh-green">TOP</span>
              <span className="text-white">BLAST</span>
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/leaderboard" className="text-gray-400 hover:text-rh-green transition-colors text-sm font-medium">Leaderboard</Link>
            <Link href="/stats" className="text-gray-400 hover:text-rh-green transition-colors text-sm font-medium">Stats</Link>
            <Link href="/history" className="text-gray-400 hover:text-rh-green transition-colors text-sm font-medium">History</Link>
            <a href={LINKS.whitepaper} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-rh-green transition-colors" title="Whitepaper"><DocsIcon /></a>
            <a href={LINKS.twitter} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors" title="Follow on X"><XIcon /></a>
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-16">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center max-w-4xl w-full">
          <h1 className="text-5xl md:text-7xl font-bold mb-4 tracking-tight">
            <span className="text-rh-green">TOP</span>
            <span className="text-white">BLAST</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 mb-2 font-light">The Loss-Mining Protocol</p>
          <p className="text-gray-400 max-w-2xl mx-auto mb-10 text-lg leading-relaxed">
            Get paid in <span className="text-rh-green font-semibold">native ETH</span> for being a{' '}
            <span className="text-red-400 font-semibold">top eligible loser</span> — ranked by drawdown %, not wallet size.
          </p>

          {(price || marketCap) && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="flex items-center justify-center gap-8 mb-10 py-4 px-8 glass-panel rounded-2xl mx-auto w-fit border-rh-green/20">
              {price && (
                <div className="text-center">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Price</div>
                  <div className="text-xl font-bold font-mono text-rh-lime">${price < 0.0001 ? price.toPrecision(2) : price.toFixed(6)}</div>
                </div>
              )}
              {marketCap && (
                <>
                  <div className="w-px h-10 bg-rh-green/20" />
                  <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Market Cap</div>
                    <div className="text-xl font-bold font-mono text-white"><AnimatedNumber value={marketCap} format="currency" /></div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/leaderboard">
              <motion.button whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }}
                className="px-8 py-4 bg-rh-green hover:bg-rh-green-bright text-black rounded-xl font-bold text-lg shadow-rh-glow transition-colors">
                View Leaderboard
              </motion.button>
            </Link>
            <Link href="/history">
              <motion.button whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }}
                className="px-8 py-4 bg-white/5 border border-rh-green/25 hover:bg-rh-green/10 hover:border-rh-green/40 rounded-xl font-bold text-lg transition-all text-rh-lime">
                ETH Payout History
              </motion.button>
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-4">
            {[
              { place: '1st', pct: SHARES.first, emoji: '🥇' },
              { place: '2nd', pct: SHARES.second, emoji: '🥈' },
              { place: '3rd', pct: SHARES.third, emoji: '🥉' },
            ].map((item) => (
              <motion.div key={item.place} whileHover={{ y: -4 }} className="text-center p-4 glass-panel rounded-xl border-rh-green/15">
                <div className="text-3xl mb-2">{item.emoji}</div>
                <div className="text-3xl font-bold text-rh-green">{item.pct}%</div>
                <div className="text-xs text-gray-500 mt-1">{item.place} · of winner pool</div>
              </motion.div>
            ))}
          </motion.div>
          <p className="text-xs text-gray-500 mb-8 text-center max-w-lg mx-auto">
            {COMMUNITY}% of pool to top 3 <span className="text-rh-lime">eligible</span> losers (split {SHARES.first}/{SHARES.second}/{SHARES.third} of winner pool) · {DEV_FEE}% dev fee · native ETH on Robinhood Chain
          </p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="glass-panel rounded-2xl p-8 max-w-3xl mx-auto border-rh-green/20 text-left">
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2 justify-center text-rh-lime">
              <span>🎯</span> Who Gets Paid
            </h2>
            <p className="text-center text-gray-400 text-sm mb-6 max-w-xl mx-auto">
              Read this before expecting a payout — eligibility is strict and automatic.
            </p>
            <WhoGetsPaidRules variant="homepage" />
            <div className="mt-6 pt-6 border-t border-rh-green/10 flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/leaderboard" className="text-center text-sm text-rh-green hover:text-rh-lime transition-colors font-medium">
                See live rankings & eligibility →
              </Link>
              <Link href="/stats" className="text-center text-sm text-gray-500 hover:text-gray-300 transition-colors">
                Current thresholds on Stats →
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </main>

      <footer className="relative z-10 border-t border-rh-green/10 py-6 bg-black/80">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">Robinhood Chain · Native ETH payouts · Blockscout verified</p>
          <div className="flex items-center gap-4">
            <a href={LINKS.whitepaper} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-rh-green transition-colors flex items-center gap-2 text-sm"><DocsIcon /> Whitepaper</a>
            <a href={LINKS.twitter} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors flex items-center gap-2 text-sm"><XIcon /> @topblasteth</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
