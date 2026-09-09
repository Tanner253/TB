import type { Metadata, Viewport } from 'next'
import './globals.css'
import { PAYOUT_INTERVAL_RANGE_COMPACT } from '@/lib/platform/payoutIntervals'
import { SITE_DESCRIPTION, SITE_TITLE } from '@/lib/marketing/brand'
import { AppFooter } from '@/components/platform/AppFooter'
import { PayoutCelebration } from '@/components/mascot/PayoutCelebration'
import { MusicProvider } from '@/components/ui/MusicProvider'
import { WhaleCompanion } from '@/components/mascot/WhaleCompanion'

const PAYOUT_META = `Payout cycles every ${PAYOUT_INTERVAL_RANGE_COMPACT}`

/** Applies the saved theme before first paint (no flash). Dark is the default. */
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('tb-theme');if(t!=='light'){document.documentElement.classList.add('dark')}}catch(e){document.documentElement.classList.add('dark')}})()`

export const metadata: Metadata = {
  metadataBase: new URL('https://topblasted.fun'),
  title: SITE_TITLE,
  description: `${SITE_DESCRIPTION} ${PAYOUT_META}.`,
  keywords: [
    'solana',
    'spl',
    'defi',
    'cashback alternative',
    'holder rewards',
    'crypto',
    'topblast',
    'helius',
  ],
  authors: [{ name: 'TopBlast' }],
  openGraph: {
    title: SITE_TITLE,
    description: `${SITE_DESCRIPTION} Solana · ${PAYOUT_META}.`,
    type: 'website',
    siteName: 'TopBlast',
    url: 'https://topblasted.fun',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: `${SITE_DESCRIPTION} Solana · ${PAYOUT_META}.`,
    site: '@oSKNYo_dev',
    creator: '@oSKNYo_dev',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#7c3aed',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased bg-paper text-ink">
        {children}
        <AppFooter />
        <PayoutCelebration />
        <WhaleCompanion />
        <MusicProvider />
      </body>
    </html>
  )
}
