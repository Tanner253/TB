'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { TopBlastLogo } from '@/components/ui/TopBlastLogo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { SoundToggle } from '@/components/ui/SoundToggle'
import { MusicToggle } from '@/components/ui/MusicToggle'
import { openRektModal } from '@/components/rekt/RektModal'
import { EXTERNAL_LINKS, WHITEPAPER_URL } from '@/lib/marketing/devValueProp'
import { useTenantRouting } from '@/hooks/useTenantRouting'
import { playPop } from '@/hooks/useSoundEffects'

export type AppHeaderActive =
  | 'home'
  | 'catalog'
  | 'launch'
  | 'leaderboard'
  | 'history'
  | 'stats'
  | 'game'
  | 'winners'
  | 'rekt'

function XIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <motion.svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      animate={{ rotate: open ? 180 : 0 }}
      transition={{ duration: 0.2 }}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </motion.svg>
  )
}

type NavItem = {
  href: string
  label: string
  icon: string
  active: boolean
  external?: boolean
}

interface AppHeaderProps {
  active?: AppHeaderActive
  trailing?: React.ReactNode
}

export function AppHeader({ active, trailing }: AppHeaderProps) {
  const { basePath } = useTenantRouting()
  const [menuOpen, setMenuOpen] = useState(false)
  const [sessionOpen, setSessionOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const sessionRef = useRef<HTMLDivElement>(null)
  const sessionRoot = basePath || ''

  // Header lifts off the page once you scroll — subtle depth, no layout shift.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  useEffect(() => {
    if (!sessionOpen) return
    const onAway = (e: PointerEvent) => {
      if (sessionRef.current && !sessionRef.current.contains(e.target as Node)) {
        setSessionOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSessionOpen(false)
    }
    window.addEventListener('pointerdown', onAway)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onAway)
      window.removeEventListener('keydown', onKey)
    }
  }, [sessionOpen])

  /** Core destinations — always the same four, wherever you are. */
  const coreLinks: NavItem[] = [
    { href: '/', label: 'Home', icon: '🏠', active: active === 'home' },
    { href: '/catalog', label: 'Catalog', icon: '🪙', active: active === 'catalog' },
    { href: '/winners', label: 'Winners', icon: '🏆', active: active === 'winners' },
    { href: '/game', label: 'Game', icon: '🎮', active: active === 'game' },
  ]

  /** Scoped to whichever session you're viewing (platform token by default). */
  const sessionLinks: NavItem[] = [
    {
      href: `${sessionRoot}/leaderboard`,
      label: basePath ? 'Leaderboard' : 'Platform Token',
      icon: '📊',
      active: active === 'leaderboard',
    },
    { href: `${sessionRoot}/history`, label: 'History', icon: '🧾', active: active === 'history' },
    { href: `${sessionRoot}/stats`, label: 'Stats', icon: '📈', active: active === 'stats' },
  ]

  const sessionActive = sessionLinks.some(l => l.active)

  const extraLinks: NavItem[] = [
    { href: WHITEPAPER_URL, label: 'Whitepaper', icon: '📄', active: false, external: true },
    { href: EXTERNAL_LINKS.twitter, label: 'X / Twitter', icon: '𝕏', active: false, external: true },
  ]

  /** Desktop segmented-control item with a shared sliding pill. */
  function renderCoreLink(item: NavItem) {
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`relative rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
          item.active ? 'text-sol-purple font-semibold' : 'text-ink-2 hover:text-ink'
        }`}
      >
        {item.active ? (
          <motion.span
            layoutId="nav-active-pill"
            className="absolute inset-0 rounded-lg bg-sol-purple/12 ring-1 ring-sol-purple/30"
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            aria-hidden
          />
        ) : null}
        <span className="relative flex items-center gap-1.5">
          <span aria-hidden>{item.icon}</span>
          {item.label}
        </span>
      </Link>
    )
  }

  /** Mobile drawer row. */
  function renderMobileLink(item: NavItem) {
    const className = `flex items-center gap-3 w-full rounded-lg px-3 py-3 text-base transition-colors ${
      item.active
        ? 'text-sol-purple bg-sol-purple/10 font-semibold'
        : 'text-ink-2 hover:text-ink hover:bg-ink/[0.04]'
    }`
    const inner = (
      <>
        <span className="text-lg" aria-hidden>
          {item.icon}
        </span>
        {item.label}
      </>
    )
    if (item.external) {
      return (
        <a
          key={item.href + item.label}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
          onClick={() => setMenuOpen(false)}
        >
          {inner}
        </a>
      )
    }
    return (
      <Link
        key={item.href + item.label}
        href={item.href}
        className={className}
        onClick={() => setMenuOpen(false)}
      >
        {inner}
      </Link>
    )
  }

  return (
    <>
      <header
        className={`sticky top-0 z-50 pt-[env(safe-area-inset-top)] transition-all duration-300 ${
          scrolled
            ? 'border-b border-line bg-paper/90 backdrop-blur-xl shadow-[0_4px_20px_rgb(var(--tb-ink)/0.07)]'
            : 'border-b border-transparent bg-paper/70 backdrop-blur-md'
        }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-5 h-14 flex items-center justify-between gap-2">
          {/* brand */}
          <Link
            href="/"
            className="group flex items-center gap-2 shrink-0 min-w-0"
            title="TopBlast home"
          >
            <motion.span
              whileHover={{ rotate: [0, -8, 8, 0], scale: 1.08 }}
              transition={{ duration: 0.5 }}
              className="inline-flex"
            >
              <TopBlastLogo size="sm" />
            </motion.span>
            <span className="font-bold tracking-tight text-[0.9rem] sm:text-[0.95rem] truncate">
              <span className="text-sol-purple">TOP</span>
              <span className="text-ink">BLAST</span>
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 shrink-0 rounded-full border border-sol-mint/30 bg-sol-mint/[0.08] px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-sol-mint">
              <span className="live-dot" aria-hidden />
              Live
            </span>
          </Link>

          {/* desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            <div className="flex items-center gap-0.5 rounded-xl border border-line bg-card/60 p-1 backdrop-blur">
              {coreLinks.map(renderCoreLink)}
            </div>

            {/* session-scoped group */}
            <div ref={sessionRef} className="relative">
              <button
                type="button"
                onClick={() => setSessionOpen(v => !v)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                  sessionActive || sessionOpen
                    ? 'border-sol-purple/30 bg-sol-purple/10 text-sol-purple font-semibold'
                    : 'border-line bg-card/60 text-ink-2 hover:text-ink'
                }`}
                aria-expanded={sessionOpen}
                aria-haspopup="menu"
              >
                <span aria-hidden>📊</span>
                {basePath ? 'Session' : 'Platform'}
                <ChevronIcon open={sessionOpen} />
              </button>

              <AnimatePresence>
                {sessionOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-12 z-[70] w-52 rounded-xl border border-line bg-card p-1.5 shadow-card"
                    role="menu"
                  >
                    {sessionLinks.map(item => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSessionOpen(false)}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                          item.active
                            ? 'bg-sol-purple/10 text-sol-purple font-semibold'
                            : 'text-ink-2 hover:text-ink hover:bg-ink/[0.05]'
                        }`}
                        role="menuitem"
                      >
                        <span aria-hidden>{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {/* rekt card — the free tool, given its own emphasis */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                playPop()
                openRektModal()
              }}
              className="flex items-center gap-1.5 rounded-xl border border-dashed border-sol-purple/40 bg-sol-purple/[0.06] px-3 py-2 text-sm font-semibold text-sol-purple hover:bg-sol-purple/12 transition-colors whitespace-nowrap"
              title="Scan any wallet — free Rekt Report Card"
            >
              📉 Rekt Card
            </motion.button>

            <a
              href={WHITEPAPER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-2.5 py-2 text-sm text-ink-2 hover:text-ink transition-colors whitespace-nowrap"
            >
              Docs
            </a>
            <a
              href={EXTERNAL_LINKS.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-2 hover:text-ink hover:bg-ink/[0.06] transition-colors"
              title="Follow on X"
              aria-label="X"
            >
              <XIcon />
            </a>
          </nav>

          {/* right cluster */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {trailing}
            <div className="hidden sm:flex items-center gap-0.5 rounded-xl border border-line bg-card/60 p-0.5">
              <MusicToggle />
              <SoundToggle />
              <ThemeToggle />
            </div>
            <ThemeToggle className="sm:hidden" />
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              <Link
                href="/launch"
                className={`inline-flex px-3.5 py-1.5 bg-sol-gradient text-white dark:text-black rounded-lg font-semibold text-sm shadow-rh-glow-sm hover:opacity-90 transition-opacity whitespace-nowrap ${
                  active === 'launch' ? 'ring-2 ring-sol-purple/50' : ''
                }`}
              >
                List
              </Link>
            </motion.div>
            <button
              type="button"
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-ink-2 hover:bg-ink/[0.06] hover:text-ink transition-colors"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(v => !v)}
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </header>

      {/* mobile drawer */}
      <AnimatePresence>
        {menuOpen ? (
          <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true">
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-ink/40 border-0 cursor-pointer"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="absolute top-0 right-0 h-full w-[min(100%,20rem)] bg-card border-l border-line shadow-2xl flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
            >
              <div className="flex items-center justify-between px-4 h-14 border-b border-line">
                <span className="text-sm font-semibold text-ink">Menu</span>
                <div className="flex items-center gap-1">
                  <MusicToggle />
                  <SoundToggle />
                  <button
                    type="button"
                    className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-ink-2 hover:text-ink hover:bg-ink/[0.06]"
                    onClick={() => setMenuOpen(false)}
                    aria-label="Close"
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>

              <nav className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-0.5">
                {coreLinks.map(renderMobileLink)}

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    playPop()
                    openRektModal()
                  }}
                  className="flex items-center gap-3 w-full rounded-lg px-3 py-3 text-base font-semibold text-sol-purple bg-sol-purple/[0.06] border border-dashed border-sol-purple/40 my-1"
                >
                  <span className="text-lg" aria-hidden>
                    📉
                  </span>
                  Rekt Card
                </button>

                <p className="px-3 pt-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-ink-3">
                  {basePath ? 'This session' : 'Platform token'}
                </p>
                {sessionLinks.map(renderMobileLink)}

                <p className="px-3 pt-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-ink-3">
                  More
                </p>
                {extraLinks.map(renderMobileLink)}
              </nav>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
