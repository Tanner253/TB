'use client'

import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { SolanaBadge } from './components/SolanaBadge'
import { DocNavbar, DocSubnav } from './components/docs/DocNavbar'
import { DocContent } from './components/docs/DocContent'
import { APP_URL, PAYOUT, PAYOUT_INTERVAL_HERO_RANGE } from './components/docs/config'

const CandlestickBackground = dynamic(() => import('./components/CandlestickBackground'), {
  ssr: false,
})

const RocketIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
)

const ExternalLinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
)

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto px-4 text-center">
        <motion.h1
          className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter mb-6 leading-[1.1] sm:leading-tight glitch px-1"
          data-text="WHEN YOU DRAWDOWN WE BLAST YOU UP"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          WHEN YOU <span className="text-red-500 neon-red italic">DRAWDOWN</span>
          <br />
          WE <span className="hero-text-gradient neon-green">BLAST</span> YOU UP
        </motion.h1>

        <motion.div
          className="mb-4 flex justify-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35 }}
        >
          <SolanaBadge />
        </motion.div>

        <motion.p
          className="text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-6 bg-black/30 backdrop-blur-sm py-2 px-4 rounded-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Reward <strong className="text-rh-green">bullish holders</strong> who bought the top and stayed in.
          <br />
          Turn creator-fee SOL into loss-mining payouts — choose your cycle ({PAYOUT_INTERVAL_HERO_RANGE}), automatically.
        </motion.p>

        <motion.div
          className="flex flex-col md:flex-row gap-4 justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <a href={`${APP_URL}/launch`} target="_blank" rel="noopener noreferrer">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-sol-gradient hover:opacity-90 text-black px-6 sm:px-8 py-3.5 sm:py-4 rounded-lg font-bold text-base sm:text-lg transition-all flex items-center justify-center gap-2 shadow-sol-glow w-full sm:w-auto"
            >
              <RocketIcon /> Launch Your Token
            </motion.button>
          </a>
          <a href={APP_URL} target="_blank" rel="noopener noreferrer">
            <motion.button
              whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
              whileTap={{ scale: 0.95 }}
              className="glass-panel text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-lg font-bold text-base sm:text-lg transition-all border border-white/20 flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              Browse Live Listings <ExternalLinkIcon />
            </motion.button>
          </a>
        </motion.div>

        <motion.div
          className="mt-12 sm:mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <div className="glass-panel rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-rh-green font-mono">{PAYOUT.first}%</div>
            <div className="text-xs text-gray-400 mt-1">1st Place Payout</div>
          </div>
          <div className="glass-panel rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-rh-lime font-mono">{PAYOUT_INTERVAL_HERO_RANGE}</div>
            <div className="text-xs text-gray-400 mt-1">Payout Frequency</div>
            <div className="text-[0.65rem] text-gray-500 mt-0.5">Set at launch</div>
          </div>
          <div className="glass-panel rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-rh-lime font-mono">{PAYOUT.community}%</div>
            <div className="text-xs text-gray-400 mt-1">To Community</div>
          </div>
          <div className="glass-panel rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-yellow-400 font-mono">0</div>
            <div className="text-xs text-gray-400 mt-1">Interaction Needed</div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function RektTicker() {
  const liveFeed = [
    { wallet: '7xK...Fa1', loss: '-72.5%', payout: 'Winner 🏆' },
    { wallet: 'Sol...ale', loss: '-45.2%', payout: '2nd Place' },
    { wallet: 'DeFi...Pro', loss: '-38.7%', payout: '3rd Place' },
    { wallet: 'Diam...Hand', loss: '-29.1%', payout: 'Eligible ✓' },
    { wallet: 'Moon...Boy', loss: '-15.3%', payout: 'Eligible ✓' },
  ]

  return (
    <div className="w-full bg-purple-900/20 border-y border-rh-green/30 overflow-hidden py-3 relative z-20 backdrop-blur-sm">
      <div className="flex animate-slide whitespace-nowrap gap-12 px-4">
        {[...liveFeed, ...liveFeed, ...liveFeed, ...liveFeed].map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-sm font-mono">
            <span className="text-gray-400">{item.wallet}</span>
            <span className="text-red-500 font-bold">{item.loss}</span>
            <span className="text-rh-green bg-purple-900/30 px-2 py-0.5 rounded text-xs">{item.payout}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <div className="antialiased selection:bg-rh-green selection:text-black">
      <CandlestickBackground />
      <div className="relative z-10">
        <DocNavbar />
        <Hero />
        <RektTicker />
        <DocSubnav />
        <DocContent />
      </div>
    </div>
  )
}
