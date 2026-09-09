import Link from 'next/link'
import { TopBlastLogo } from '@/components/ui/TopBlastLogo'
import { EXTERNAL_LINKS, WHITEPAPER_URL } from '@/lib/marketing/devValueProp'
import { MISSION_BODY, MISSION_HERO, MISSION_LEAD } from '@/lib/marketing/brand'
import { Blasty } from '@/components/mascot/Blasty'

const FOOTER_LINKS = [
  { href: '/catalog', label: 'Catalog' },
  { href: '/winners', label: 'Hall of Fame 🏆' },
  { href: '/launch', label: 'List token' },
  { href: '/game', label: 'Blast Off 🎮' },
  { href: WHITEPAPER_URL, label: 'Whitepaper', external: true },
  { href: EXTERNAL_LINKS.twitter, label: 'X', external: true },
] as const

export function AppFooter() {
  return (
    <footer className="relative z-10 border-t border-line bg-paper">
      <div className="max-w-3xl mx-auto px-4 sm:px-5 py-12 sm:py-14 text-center">
        <div className="flex justify-center mb-4">
          <Blasty pose="idle" size={96} />
        </div>

        <p className="text-sol-purple text-[0.6875rem] sm:text-xs font-semibold uppercase tracking-[0.22em] mb-5">
          {MISSION_HERO}
        </p>

        <p className="text-lg sm:text-xl font-semibold text-ink leading-snug tracking-tight mb-3">
          {MISSION_LEAD}
        </p>

        <p className="text-sm text-ink-2 leading-relaxed max-w-2xl mx-auto mb-8">
          {MISSION_BODY}
        </p>

        <div className="flex items-center justify-center gap-2 mb-6">
          <TopBlastLogo size="sm" />
          <span className="font-bold tracking-tight text-sm">
            <span className="text-sol-purple">TOP</span>
            <span className="text-ink">BLAST</span>
          </span>
        </div>

        <nav
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-ink-3 mb-6"
          aria-label="Footer"
        >
          {FOOTER_LINKS.map(link =>
            'external' in link && link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-ink transition-colors"
              >
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className="hover:text-ink transition-colors">
                {link.label}
              </Link>
            )
          )}
        </nav>

        <p className="text-xs text-ink-3">© {new Date().getFullYear()} TopBlast · Built on Solana</p>
      </div>
    </footer>
  )
}
