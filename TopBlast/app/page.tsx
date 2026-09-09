'use client'

import dynamic from 'next/dynamic'
import { AppHeader } from '@/components/platform/AppHeader'
import { FeaturedTokens } from '@/components/catalog/FeaturedTokens'
import { HomeHero } from '@/components/platform/HomeHero'
import { HowItWorksSimple } from '@/components/platform/HowItWorksSimple'
import { HomeReveal } from '@/components/platform/HomeSection'

const CandlestickBackground = dynamic(
  () => import('@/components/platform/CandlestickBackground').then(m => m.CandlestickBackground),
  { ssr: false }
)

export default function HomePage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Candlesticks visible; scrim keeps text readable without washing out the chart */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden>
        <CandlestickBackground />
        <div className="absolute inset-0 bg-paper/40" />
        <div className="absolute inset-y-0 left-0 w-24 sm:w-32 bg-gradient-to-r from-paper/80 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-24 sm:w-32 bg-gradient-to-l from-paper/60 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-paper/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-paper to-transparent" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-sol-purple/10 rounded-full blur-[100px] home-orb" />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.07]" />
      </div>

      <div className="relative z-10">
        <AppHeader active="home" />

        <main className="max-w-7xl mx-auto px-4 sm:px-5 py-10 sm:py-14">
          <HomeHero />

          <HomeReveal className="mb-14 md:mb-20">
            <FeaturedTokens limit={3} />
          </HomeReveal>

          <HowItWorksSimple />
        </main>
      </div>
    </div>
  )
}
