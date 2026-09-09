'use client'

/**
 * Blasty as your guide — a small companion fixed to the corner of every page.
 * He cracks jokes, quotes live platform numbers, and drops page-specific tips.
 * Tap him for the next line (with a squeak); the ✕ minimizes him to a bubble.
 *
 * Lines rotate on a timer; live numbers come from the public catalog endpoint.
 * Mounted once in the root layout so he swims along across navigations.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BlastyWhale } from './BlastyWhale'
import { playWhaleCall } from '@/hooks/useSoundEffects'
import { useTenantCatalog } from '@/hooks/useTenantCatalog'

const MIN_KEY = 'tb-companion'
const ROTATE_MS = 32_000
const BUBBLE_MS = 12_000

const GAME_PLUG = 'Bored while the timer runs? I know a way to kill time…'

const JOKES = [
  'I bought the top so you don’t have to. (You did anyway, didn’t you.)',
  'Down 90% and never been happier. That’s the business model.',
  'Buy high, get paid to cry.',
  'My financial advisor is a candlestick chart.',
  'HODL? Buddy, I don’t even have hands.',
  'Red candles feed the pot. I said what I said.',
  'I’m not underwater. I live here.',
  'Whales cry too — you just can’t tell in the ocean.',
  'Diamond fins since birth.',
  'The dip called. I answered. Now I get airdrops.',
  'Every 15 minutes someone’s worst day gets a little better.',
  'Losing money has never been this organized.',
] as const

const TIPS: Record<string, string[]> = {
  '/': [
    'New here? The pot buys the token, the biggest losers get the tokens. That’s it.',
    'Tap “See who’s winning” to browse every live session.',
    'The nerdy details — VWAP, pool splits, cooldowns — live in the whitepaper.',
  ],
  '/catalog': [
    'Every card here is a live session. Tap one to see who’s winning that pot.',
    '“Gen volume” = how much SOL the protocol has bought into that token. Bigger = louder chart.',
    'Sort by pot size to find where the real money’s waiting.',
  ],
  '/launch': [
    'Listing takes about two minutes. Fund the payout wallet and I handle the rest.',
    'Your payout key is encrypted before it ever touches the database.',
    'Pick your cycle length wisely — you can’t change it after launch.',
  ],
  leaderboard: [
    'Ranked by how far below your average buy you are. Deepest wounds win.',
    'Hold at least 15 minutes, don’t sell, stay underwater — that’s the whole trick.',
    'Winners sit out one round. Even losing has a meta.',
    'The timer only runs when someone’s eligible and the pot is funded.',
  ],
  history: [
    'Every payout here really happened — tap a TX to verify it on-chain.',
    'This page is my favorite. It’s just receipts.',
  ],
  stats: [
    'All of this updates live from Solana. No screenshots, no trust-me-bro.',
  ],
  '/game': [],
}

function pageTips(pathname: string): string[] {
  if (TIPS[pathname]) return TIPS[pathname]
  if (pathname.includes('leaderboard')) return TIPS.leaderboard
  if (pathname.includes('history')) return TIPS.history
  if (pathname.includes('stats')) return TIPS.stats
  return TIPS['/']
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

export function WhaleCompanion() {
  const pathname = usePathname() ?? '/'
  const reduceMotion = useReducedMotion()
  const { tenants } = useTenantCatalog()
  const [minimized, setMinimized] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const [line, setLine] = useState<string | null>(null)
  const [showBubble, setShowBubble] = useState(false)
  const [showCta, setShowCta] = useState(false)
  const recentRef = useRef<string[]>([])
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    try {
      setMinimized(localStorage.getItem(MIN_KEY) === 'min')
    } catch {
      setMinimized(false)
    }
    setHydrated(true)
  }, [])

  const statLines = useMemo(() => {
    const lines: string[] = []
    const paid = tenants.reduce((s, t) => s + (t.total_distributed_usd ?? 0), 0)
    const live = tenants.filter(t => t.status === 'active').length
    const eligible = tenants.reduce((s, t) => s + (t.payout_eligible_count ?? 0), 0)
    const biggest = tenants.reduce(
      (best, t) => ((t.pot_usd ?? 0) > (best?.pot_usd ?? 0) ? t : best),
      null as (typeof tenants)[number] | null
    )
    if (paid > 0) lines.push(`${formatUsd(paid)} paid to underwater holders so far. Real ones.`)
    if (live > 0) lines.push(`${live} session${live === 1 ? '' : 's'} live right now. The pots don’t sleep.`)
    if (eligible > 0) lines.push(`${eligible} wallet${eligible === 1 ? ' is' : 's are'} eligible for a payout right now. Could’ve been you.`)
    if (biggest?.pot_usd && biggest.pot_usd > 1) {
      lines.push(`Biggest pot right now: ${formatUsd(biggest.pot_usd)} on $${biggest.symbol}. Just saying.`)
    }
    return lines
  }, [tenants])

  const onLeaderboard = pathname.includes('leaderboard')

  const showLine = useCallback(
    (text: string, cta = false) => {
      setLine(text)
      setShowCta(cta)
      setShowBubble(true)
      if (hideTimer.current) clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => setShowBubble(false), cta ? BUBBLE_MS * 1.5 : BUBBLE_MS)
    },
    []
  )

  const nextLine = useCallback(() => {
    // The game plug shows as a clickable CTA bubble — more often on leaderboards
    const gameOdds = onLeaderboard ? 0.3 : 0.12
    if (Math.random() < gameOdds) {
      showLine(GAME_PLUG, true)
      return
    }
    const pool = [
      ...JOKES,
      ...JOKES, // jokes weighted highest — he's a comedian first
      ...statLines,
      ...statLines,
      ...pageTips(pathname),
      ...pageTips(pathname),
    ].filter(l => !recentRef.current.includes(l))
    const choice = pool[Math.floor(Math.random() * pool.length)] ?? JOKES[0]
    recentRef.current = [...recentRef.current.slice(-5), choice]
    showLine(choice)
  }, [pathname, statLines, onLeaderboard, showLine])

  // First bubble shortly after load (the game CTA on leaderboards), then rotate
  useEffect(() => {
    if (minimized || pathname === '/game') return
    const first = setTimeout(() => {
      if (onLeaderboard) showLine(GAME_PLUG, true)
      else nextLine()
    }, 4500)
    const loop = setInterval(nextLine, ROTATE_MS)
    return () => {
      clearTimeout(first)
      clearInterval(loop)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [nextLine, minimized, pathname, onLeaderboard, showLine])

  const setMin = (min: boolean) => {
    setMinimized(min)
    setShowBubble(false)
    try {
      localStorage.setItem(MIN_KEY, min ? 'min' : 'open')
    } catch {
      /* non-persistent */
    }
  }

  if (!hydrated || pathname === '/game') return null

  return (
    <div className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-40 flex flex-col items-end gap-1.5 pointer-events-none">
      <AnimatePresence>
        {!minimized && showBubble && line ? (
          <motion.div
            key={line}
            initial={{ opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-auto relative max-w-[240px] sm:max-w-[280px] rounded-2xl rounded-br-md border border-line bg-card px-3.5 py-2.5 shadow-card"
          >
            <button
              type="button"
              onClick={() => setShowBubble(false)}
              className="absolute -top-2 -left-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-line bg-card text-[10px] text-ink-3 hover:text-ink shadow-sm"
              aria-label="Dismiss message"
            >
              ✕
            </button>
            <p className="text-[0.8rem] leading-snug text-ink">{line}</p>
            {showCta ? (
              <Link
                href="/game"
                onClick={() => setShowBubble(false)}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-sol-purple px-3 py-2 text-xs font-bold text-white hover:bg-sol-purple-dark transition-colors"
              >
                🎮 Play Blast Off
              </Link>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {minimized ? (
          <motion.button
            key="mini"
            type="button"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            whileHover={reduceMotion ? undefined : { scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setMin(false)}
            className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card shadow-card"
            title="Bring Blasty back"
            aria-label="Show Blasty the whale"
          >
            <BlastyWhale size={30} still noShadow />
          </motion.button>
        ) : (
          <motion.div
            key="whale"
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 60 }}
            transition={{ type: 'spring', bounce: 0.4, duration: 0.6 }}
            className="pointer-events-auto relative"
          >
            <button
              type="button"
              onClick={() => setMin(true)}
              className="absolute -top-1 -right-1 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full border border-line bg-card text-[10px] text-ink-3 hover:text-ink shadow-sm"
              title="Minimize Blasty"
              aria-label="Minimize Blasty"
            >
              ✕
            </button>
            <motion.button
              type="button"
              whileTap={reduceMotion ? undefined : { scale: 0.92, rotate: -4 }}
              onClick={() => {
                playWhaleCall()
                nextLine()
              }}
              className="block cursor-pointer"
              aria-label="Blasty the whale — tap for a line"
              title="Tap me"
            >
              <BlastyWhale size={84} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
