'use client'

import Link from 'next/link'
import { TopBlastLogo } from '@/components/ui/TopBlastLogo'
import { SolanaBadge } from '@/components/ui/SolanaBadge'
import { WHITEPAPER_URL } from '@/lib/marketing/devValueProp'

export function AppHeader({ active }: { active?: 'catalog' | 'launch' }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/85 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <TopBlastLogo size="sm" />
          <span className="font-bold tracking-tight text-[0.95rem]">
            <span className="text-sol-mint">TOP</span>
            <span className="text-white">BLAST</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded-md transition-colors ${
              active === 'catalog' ? 'text-sol-mint bg-sol-mint/10' : 'text-gray-400 hover:text-white'
            }`}
          >
            Catalog
          </Link>
          <Link
            href="/launch"
            className={`px-3 py-1.5 rounded-md transition-colors ${
              active === 'launch' ? 'text-sol-mint bg-sol-mint/10' : 'text-gray-400 hover:text-white'
            }`}
          >
            Launch
          </Link>
          <a
            href={WHITEPAPER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-md text-gray-400 hover:text-white transition-colors"
          >
            Docs
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <SolanaBadge compact />
          </div>
          <Link
            href="/launch"
            className="px-3.5 py-1.5 bg-sol-gradient text-black rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Launch token
          </Link>
        </div>
      </div>
    </header>
  )
}
