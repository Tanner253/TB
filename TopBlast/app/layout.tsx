import type { Metadata, Viewport } from 'next'
import './globals.css'
import { PAYOUT_INTERVAL_RANGE_COMPACT } from '@/lib/platform/payoutIntervals'

const PAYOUT_META = `Configurable payout cycles (${PAYOUT_INTERVAL_RANGE_COMPACT})`

export const metadata: Metadata = {
  title: 'TopBlast | The Loss-Mining Protocol',
  description: `The Loss-Mining Protocol on Solana. Top 3 eligible losers win native SOL payouts. ${PAYOUT_META}.`,
  keywords: ['solana', 'spl', 'defi', 'loss-mining', 'crypto', 'topblast', 'helius'],
  authors: [{ name: 'TopBlast' }],
  openGraph: {
    title: 'TopBlast | The Loss-Mining Protocol',
    description: `Get paid in native SOL for being a top loser. Solana · ${PAYOUT_META}.`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TopBlast | The Loss-Mining Protocol',
    description: `Get paid in native SOL for being a top loser. Solana · ${PAYOUT_META}.`,
    site: '@topblasteth',
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
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
