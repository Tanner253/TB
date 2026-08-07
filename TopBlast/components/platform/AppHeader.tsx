'use client'

import Link from 'next/link'
import { TopBlastLogo } from '@/components/ui/TopBlastLogo'
import { SolanaBadge } from '@/components/ui/SolanaBadge'
import { EXTERNAL_LINKS, WHITEPAPER_URL } from '@/lib/marketing/devValueProp'

export type AppHeaderActive =
  | 'home'
  | 'catalog'
  | 'launch'
  | 'leaderboard'
  | 'history'
  | 'stats'

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function navLinkClass(active: boolean) {
  return `px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
    active ? 'text-sol-mint bg-sol-mint/10' : 'text-gray-400 hover:text-white'
  }`
}

interface AppHeaderProps {
  active?: AppHeaderActive
  /** e.g. `/topblast` when viewing a catalog listing session */
  sessionBasePath?: string
  /** Extra controls (refresh, live badge) shown before social icons */
  trailing?: React.ReactNode
}

export function AppHeader({ active, sessionBasePath, trailing }: AppHeaderProps) {
  const inSession = sessionBasePath !== undefined
  const sessionRoot = sessionBasePath || ''

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-5 h-14 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 shrink-0" title="TopBlast home">
          <TopBlastLogo size="sm" />
          <span className="font-bold tracking-tight text-[0.95rem] hidden sm:inline">
            <span className="text-sol-mint">TOP</span>
            <span className="text-white">BLAST</span>
          </span>
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1 text-sm overflow-x-auto max-w-[min(100%,52rem)] scrollbar-none">
          <Link href="/" className={navLinkClass(active === 'home')}>
            Home
          </Link>
          <Link href="/catalog" className={navLinkClass(active === 'catalog')}>
            Catalog
          </Link>
          {!inSession ? (
            <Link href="/launch" className={`${navLinkClass(active === 'launch')} hidden sm:inline-flex`}>
              Launch
            </Link>
          ) : (
            <>
              <Link
                href={`${sessionRoot}/leaderboard`}
                className={navLinkClass(active === 'leaderboard')}
              >
                Leaderboard
              </Link>
              <Link
                href={`${sessionRoot}/history`}
                className={`${navLinkClass(active === 'history')} hidden sm:inline-flex`}
              >
                History
              </Link>
              <Link
                href={`${sessionRoot}/stats`}
                className={`${navLinkClass(active === 'stats')} hidden sm:inline-flex`}
              >
                Stats
              </Link>
            </>
          )}
          <a
            href={WHITEPAPER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${navLinkClass(false)} hidden lg:inline-flex`}
          >
            Docs
          </a>
          <a
            href={EXTERNAL_LINKS.github}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1.5 rounded-md text-gray-400 hover:text-white transition-colors hidden md:inline-flex"
            title="GitHub"
            aria-label="GitHub"
          >
            <GitHubIcon />
          </a>
          <a
            href={EXTERNAL_LINKS.twitter}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1.5 rounded-md text-gray-400 hover:text-white transition-colors hidden md:inline-flex"
            title="Follow on X"
            aria-label="X"
          >
            <XIcon />
          </a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {trailing}
          <div className="hidden sm:block">
            <SolanaBadge compact />
          </div>
          {!inSession ? (
            <Link
              href="/launch"
              className="px-3 sm:px-3.5 py-1.5 bg-sol-gradient text-black rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Launch
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  )
}
