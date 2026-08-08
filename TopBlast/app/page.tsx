'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AppHeader } from '@/components/platform/AppHeader'
import { FeaturedTokens } from '@/components/catalog/FeaturedTokens'
import { ForCreatorsSection } from '@/components/platform/ForCreatorsSection'
import { DynamicPotExplainer } from '@/components/platform/DynamicPotExplainer'
import { HomeHero } from '@/components/platform/HomeHero'
import { TopBlastFlowDiagram } from '@/components/platform/TopBlastFlowDiagram'
import { HomeReveal } from '@/components/platform/HomeSection'

const CandlestickBackground = dynamic(
  () => import('@/components/platform/CandlestickBackground').then(m => m.CandlestickBackground),
  { ssr: false }
)

export default function HomePage() {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      {/* Candlesticks visible; scrim keeps text readable without washing out the chart */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden>
        <CandlestickBackground />
        <div className="absolute inset-0 bg-[#030303]/25" />
        <div className="absolute inset-y-0 left-0 w-24 sm:w-32 bg-gradient-to-r from-[#030303]/70 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-24 sm:w-32 bg-gradient-to-l from-[#030303]/50 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[#030303]/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#030303]/90 to-transparent" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-sol-purple/10 rounded-full blur-[100px] home-orb" />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.07]" />
      </div>

      <div className="relative z-10">
        <AppHeader active="home" />

        <main className="max-w-7xl mx-auto px-4 sm:px-5 py-8 sm:py-12">
          <HomeHero />

          <HomeReveal className="mb-14 md:mb-16">
            <FeaturedTokens limit={3} />
          </HomeReveal>

          <TopBlastFlowDiagram />

          <section className="border-t border-white/[0.06] pt-6">
            <button
              type="button"
              onClick={() => setShowDetails(v => !v)}
              className="flex items-center justify-between w-full text-left py-3 group cursor-pointer"
            >
              <div>
                <span className="text-sm font-medium text-gray-400 group-hover:text-gray-200 transition-colors">
                  Protocol details
                </span>
                <p className="text-xs text-gray-600 mt-0.5">
                  Eligibility rules, dynamic pot, creator benefits
                </p>
              </div>
              <motion.span
                animate={{ rotate: showDetails ? 45 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-gray-600 text-lg w-6 text-center inline-block"
              >
                +
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {showDetails ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 space-y-10 pb-8">
                    <ForCreatorsSection showLaunchCta={false} />
                    <DynamicPotExplainer />
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>
        </main>
      </div>
    </div>
  )
}
