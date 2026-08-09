'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TopBlastLogo } from '@/components/ui/TopBlastLogo'
import { EXTERNAL_LINKS, WHITEPAPER_URL } from '@/lib/marketing/devValueProp'
import { useTenantRouting } from '@/hooks/useTenantRouting'

export type AppHeaderActive =
  | 'home'
  | 'catalog'
  | 'launch'
  | 'leaderboard'
  | 'history'
  | 'stats'

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
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

function navLinkClass(active: boolean, block = false) {
  return `${block ? 'block w-full text-left py-3 text-base' : 'px-3 py-1.5'} rounded-md transition-colors whitespace-nowrap ${
    active ? 'text-sol-mint bg-sol-mint/10' : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
  }`
}

type NavItem = { href: string; label: string; active: boolean; external?: boolean }

interface AppHeaderProps {
  active?: AppHeaderActive
  trailing?: React.ReactNode
}

export function AppHeader({ active, trailing }: AppHeaderProps) {
  const { basePath } = useTenantRouting()
  const [menuOpen, setMenuOpen] = useState(false)
  const sessionRoot = basePath || ''

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

  const platformLinks: NavItem[] = [
    { href: '/', label: 'Home', active: active === 'home' },
    { href: '/catalog', label: 'Catalog', active: active === 'catalog' },
    {
      href: `${sessionRoot}/leaderboard`,
      label: basePath ? 'Leaderboard' : 'Platform Token',
      active: active === 'leaderboard',
    },
    { href: `${sessionRoot}/history`, label: 'History', active: active === 'history' },
    { href: `${sessionRoot}/stats`, label: 'Stats', active: active === 'stats' },
  ]

  const extraLinks: NavItem[] = [
    { href: WHITEPAPER_URL, label: 'Docs', active: false, external: true },
    { href: EXTERNAL_LINKS.twitter, label: 'X / Twitter', active: false, external: true },
  ]

  const navLinks = [...platformLinks, ...extraLinks]

  function renderNavLink(item: NavItem, block = false) {
    const className = navLinkClass(item.active, block)
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
          {item.label}
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
        {item.label}
      </Link>
    )
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/90 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-5 h-14 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 shrink-0 min-w-0" title="TopBlast home">
            <TopBlastLogo size="sm" />
            <span className="font-bold tracking-tight text-[0.9rem] sm:text-[0.95rem] truncate">
              <span className="text-sol-mint">TOP</span>
              <span className="text-white">BLAST</span>
            </span>
            <span className="shrink-0 rounded border border-sol-mint/25 bg-sol-mint/5 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-sol-mint/90">
              Beta
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 text-sm">
            {platformLinks.map(item => renderNavLink(item))}
            <a
              href={WHITEPAPER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={navLinkClass(false)}
            >
              Docs
            </a>
            <a
              href={EXTERNAL_LINKS.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1.5 rounded-md text-gray-400 hover:text-white transition-colors"
              title="Follow on X"
              aria-label="X"
            >
              <XIcon />
            </a>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {trailing}
            <Link
              href="/launch"
              className={`inline-flex px-3.5 py-1.5 bg-sol-gradient text-black rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity whitespace-nowrap ${
                active === 'launch' ? 'ring-2 ring-sol-mint/50' : ''
              }`}
            >
              List
            </Link>
            <button
              type="button"
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-gray-300 hover:bg-white/[0.06] hover:text-white transition-colors"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(v => !v)}
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 border-0 cursor-pointer"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute top-0 right-0 h-full w-[min(100%,20rem)] bg-[#0a0a0a] border-l border-white/[0.08] shadow-2xl flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between px-4 h-14 border-b border-white/[0.06]">
              <span className="text-sm font-semibold text-white">Menu</span>
              <button
                type="button"
                className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06]"
                onClick={() => setMenuOpen(false)}
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
              {navLinks.map(item => renderNavLink(item, true))}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  )
}
