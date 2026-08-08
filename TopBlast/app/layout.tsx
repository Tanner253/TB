import type { Metadata, Viewport } from 'next'
import './globals.css'
import { PAYOUT_INTERVAL_RANGE_COMPACT } from '@/lib/platform/payoutIntervals'

const PAYOUT_META = `Configurable payout cycles (${PAYOUT_INTERVAL_RANGE_COMPACT})`

const OG_IMAGE = '/banner.png'
const OG_IMAGE_ALT = 'TopBlast — The Loss-Mining Protocol on Solana'

export const metadata: Metadata = {
  metadataBase: new URL('https://topblasted.fun'),
  title: 'TopBlast | The Loss-Mining Protocol',
  description: `The Loss-Mining Protocol on Solana. On-chart buybacks and token airdrops for top eligible losers — volume for launchers. ${PAYOUT_META}.`,
  keywords: ['solana', 'spl', 'defi', 'loss-mining', 'crypto', 'topblast', 'helius'],
  authors: [{ name: 'TopBlast' }],
  openGraph: {
    title: 'TopBlast | The Loss-Mining Protocol',
    description: `List on TopBlast: recurring chart volume via buybacks and token airdrops to underwater holders. Solana · ${PAYOUT_META}.`,
    type: 'website',
    siteName: 'TopBlast',
    url: 'https://topblasted.fun',
    locale: 'en_US',
    images: [
      {
        url: OG_IMAGE,
        alt: OG_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TopBlast | The Loss-Mining Protocol',
    description: `List on TopBlast: recurring chart volume via buybacks and token airdrops to underwater holders. Solana · ${PAYOUT_META}.`,
    site: '@oSKNYo_dev',
    creator: '@oSKNYo_dev',
    images: [OG_IMAGE],
  },
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#9945FF',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
