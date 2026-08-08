'use client'

import Link from 'next/link'

export type SessionNavActive = 'leaderboard' | 'history' | 'stats'

interface SessionNavProps {
  basePath: string
  active: SessionNavActive
  symbol?: string
}

const tabs: { id: SessionNavActive; label: string; suffix: string }[] = [
  { id: 'leaderboard', label: 'Leaderboard', suffix: '/leaderboard' },
  { id: 'history', label: 'History', suffix: '/history' },
  { id: 'stats', label: 'Stats', suffix: '/stats' },
]

function tabClass(isActive: boolean) {
  return `px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
    isActive
      ? 'text-sol-mint bg-sol-mint/10 border border-sol-mint/20'
      : 'text-gray-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
  }`
}

/** Tenant session tabs — sits below the global AppHeader on listing pages. */
export function SessionNav({ basePath, active, symbol }: SessionNavProps) {
  const root = basePath || ''

  return (
    <div className="sticky top-14 z-40 border-b border-white/[0.06] bg-black/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-5 py-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {symbol ? (
            <p className="text-[0.65rem] uppercase tracking-wider text-gray-500 truncate">
              ${symbol} session
            </p>
          ) : null}
        </div>
        <nav className="flex items-center gap-1 shrink-0" aria-label="Session navigation">
          {tabs.map(tab => (
            <Link
              key={tab.id}
              href={`${root}${tab.suffix}`}
              className={tabClass(active === tab.id)}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
