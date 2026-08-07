'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useRealtimePrice } from '@/hooks/useRealtime'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { TopBlastLogo } from '@/components/ui/TopBlastLogo'
import { CopyContractAddress } from '@/components/ui/CopyContractAddress'
import { SolanaBadge } from '@/components/ui/SolanaBadge'
import { WhoGetsPaidRules } from '@/components/WhoGetsPaidRules'
import { DynamicPotExplainer } from '@/components/platform/DynamicPotExplainer'
import { TenantStatusPanel } from '@/components/tenant/TenantStatusPanel'
import type { TenantDiagnostics } from '@/lib/tenant/diagnostics'
import { getWinnerSharePercents, getDevFeePercent, getCommunityPercent } from '@/lib/payout/shares'

const SOLSCAN_TOKEN = 'https://solscan.io/token'
const SHARES = getWinnerSharePercents()
const DEV_FEE = getDevFeePercent()
const COMMUNITY = getCommunityPercent()

export default function TenantHomePage() {
  const params = useParams()
  const slug = params.slug as string
  const basePath = `/${slug}`

  const { price, marketCap } = useRealtimePrice(15000, slug)
  const [tokenMint, setTokenMint] = useState('')
  const [tokenSymbol, setTokenSymbol] = useState('')
  const [diagnostics, setDiagnostics] = useState<TenantDiagnostics | null>(null)

  useEffect(() => {
    fetch(`/api/t/${slug}/stats`)
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data?.token?.mint) {
          setTokenMint(json.data.token.mint)
        }
        if (json.success && json.data?.token?.symbol) {
          setTokenSymbol(json.data.token.symbol)
        }
      })
      .catch(() => {})

    fetch(`/api/t/${slug}/status`)
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data?.diagnostics) {
          setDiagnostics(json.data.diagnostics)
        }
      })
      .catch(() => {})
  }, [slug])

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-black">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-sol-purple/20 rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-40" />
      </div>

      <header className="relative z-10 border-b border-rh-green/10 bg-black/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <TopBlastLogo size="md" />
            <span className="text-xl font-bold">
              <span className="text-rh-green">{tokenSymbol || slug.toUpperCase()}</span>
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href={`${basePath}/leaderboard`} className="text-gray-400 hover:text-rh-green">Leaderboard</Link>
            <Link href={`${basePath}/stats`} className="text-gray-400 hover:text-rh-green">Stats</Link>
            <Link href={`${basePath}/history`} className="text-gray-400 hover:text-rh-green">History</Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-16">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-4xl w-full">
          <h1 className="text-5xl md:text-6xl font-bold mb-4">{tokenSymbol || slug}</h1>
          <p className="text-xl text-gray-300 mb-4">Loss-mining on Solana · powered by TopBlast</p>
          <div className="mb-6 flex justify-center"><SolanaBadge /></div>

          {tokenMint ? (
            <CopyContractAddress
              address={tokenMint}
              symbol={tokenSymbol}
              explorerUrl={`${SOLSCAN_TOKEN}/${tokenMint}`}
            />
          ) : null}

          {(price || marketCap) && (
            <div className="flex items-center justify-center gap-8 my-8 py-4 px-8 glass-panel rounded-2xl mx-auto w-fit">
              {price && (
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Price</div>
                  <div className="text-xl font-mono text-rh-lime">${price < 0.0001 ? price.toPrecision(2) : price.toFixed(6)}</div>
                </div>
              )}
              {marketCap && (
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Market Cap</div>
                  <div className="text-xl font-mono"><AnimatedNumber value={marketCap} format="currency" /></div>
                </div>
              )}
            </div>
          )}

          <div className="mb-8 w-full max-w-3xl mx-auto text-left">
            <TenantStatusPanel diagnostics={diagnostics} slug={slug} />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
            <Link href={`${basePath}/leaderboard`} className="px-8 py-4 bg-sol-gradient text-black rounded-xl font-bold">
              View Leaderboard
            </Link>
            <Link href={`${basePath}/history`} className="px-8 py-4 border border-rh-green/25 rounded-xl font-bold text-rh-lime">
              Payout History
            </Link>
          </div>

          <div className="glass-panel rounded-2xl p-8 border-rh-green/20 text-left max-w-3xl mx-auto mb-6">
            <WhoGetsPaidRules variant="homepage" slug={slug} />
            <p className="text-xs text-gray-500 mt-6 text-center">
              {COMMUNITY}% to top 3 eligible losers · {DEV_FEE}% dev fee · split {SHARES.first}/{SHARES.second}/{SHARES.third}
            </p>
          </div>

          <div className="max-w-3xl mx-auto w-full">
            <DynamicPotExplainer compact />
          </div>
        </motion.div>
      </main>
    </div>
  )
}
