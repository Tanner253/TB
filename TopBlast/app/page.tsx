'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { AppHeader } from '@/components/platform/AppHeader'
import { FeaturedTokens } from '@/components/catalog/FeaturedTokens'
import { ForCreatorsSection } from '@/components/platform/ForCreatorsSection'
import { DynamicPotExplainer } from '@/components/platform/DynamicPotExplainer'
import { FlywheelTokenomics } from '@/components/platform/FlywheelTokenomics'
import { ChartVolumeExplainer } from '@/components/platform/ChartVolumeExplainer'
import { DEV_HERO } from '@/lib/marketing/devValueProp'

export default function HomePage() {
  const [showLearn, setShowLearn] = useState(false)

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-sol-purple/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      </div>

      <AppHeader active="home" />

      <main className="relative z-10 max-w-6xl mx-auto px-3 sm:px-5 py-8 sm:py-10">
        <div className="mb-10">
          <p className="text-sol-mint text-xs font-semibold uppercase tracking-[0.14em] mb-2">Solana SaaS</p>
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-950/30 px-3 py-1 text-xs text-purple-200 mb-3">
            On-chart buybacks + token airdrops every payout cycle
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{DEV_HERO.headline}</h1>
          <p className="text-gray-400 max-w-2xl text-sm md:text-base leading-relaxed">{DEV_HERO.subhead}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/catalog"
              className="inline-flex px-5 py-2.5 bg-sol-gradient text-black rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Browse catalog
            </Link>
            <Link
              href="/launch"
              className="inline-flex px-5 py-2.5 rounded-lg font-semibold text-sm border border-white/15 text-white hover:border-sol-mint/40 hover:text-sol-mint transition-colors"
            >
              Launch your token
            </Link>
          </div>
        </div>

        <section className="mb-12">
          <FeaturedTokens limit={3} />
        </section>

        <section className="mb-12">
          <ChartVolumeExplainer />
        </section>

        <section className="mb-12">
          <FlywheelTokenomics />
        </section>

        <section className="border-t border-white/[0.06] pt-8">
          <button
            type="button"
            onClick={() => setShowLearn(v => !v)}
            className="flex items-center justify-between w-full text-left py-2 group"
          >
            <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
              How TopBlast works
            </span>
            <span className="text-gray-500 text-lg">{showLearn ? '−' : '+'}</span>
          </button>

          {showLearn ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 space-y-8 pb-8"
            >
              <ForCreatorsSection showLaunchCta={false} />
              <DynamicPotExplainer />
            </motion.div>
          ) : null}
        </section>
      </main>
    </div>
  )
}
