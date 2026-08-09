import Link from 'next/link'
import { TopBlastLogo } from '@/components/ui/TopBlastLogo'
import { EXTERNAL_LINKS, WHITEPAPER_URL } from '@/lib/marketing/devValueProp'
import { MISSION_BODY, MISSION_HERO, MISSION_LEAD } from '@/lib/marketing/brand'

const FOOTER_LINKS = [
  { href: '/catalog', label: 'Catalog' },
  { href: '/launch', label: 'List token' },
  { href: WHITEPAPER_URL, label: 'Docs', external: true },
  { href: EXTERNAL_LINKS.twitter, label: 'X', external: true },
] as const

export function AppFooter() {
  return (
    <footer className="relative z-10 border-t border-white/[0.06] bg-[#030303]">
      <div className="max-w-3xl mx-auto px-4 sm:px-5 py-12 sm:py-14 text-center">
        <p className="text-sol-mint text-[0.6875rem] sm:text-xs font-semibold uppercase tracking-[0.22em] mb-5">
          {MISSION_HERO}
        </p>

        <p className="text-lg sm:text-xl font-semibold text-white leading-snug tracking-tight mb-3">
          {MISSION_LEAD}
        </p>

        <p className="text-sm text-gray-400 leading-relaxed max-w-2xl mx-auto mb-8">
          {MISSION_BODY}
        </p>

        <div className="flex items-center justify-center gap-2 mb-6">
          <TopBlastLogo size="sm" />
          <span className="font-bold tracking-tight text-sm">
            <span className="text-sol-mint">TOP</span>
            <span className="text-white">BLAST</span>
          </span>
        </div>

        <nav
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-gray-500 mb-6"
          aria-label="Footer"
        >
          {FOOTER_LINKS.map(link =>
            'external' in link && link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className="hover:text-white transition-colors">
                {link.label}
              </Link>
            )
          )}
        </nav>

        <p className="text-xs text-gray-600">© {new Date().getFullYear()} TopBlast · Built on Solana</p>
      </div>
    </footer>
  )
}
