import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TopBlast | The Loss-Mining Protocol',
  description: 'The Loss-Mining Protocol on Robinhood Chain. Top 3 losers win native ETH payouts every 15 minutes.',
  keywords: ['robinhood chain', 'evm', 'defi', 'loss-mining', 'crypto', 'topblast', 'ethereum'],
  authors: [{ name: 'TopBlast' }],
  openGraph: {
    title: 'TopBlast | The Loss-Mining Protocol',
    description: 'Get paid in native ETH for being a top loser. Robinhood Chain · automated payouts every 15 minutes.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TopBlast | The Loss-Mining Protocol',
    description: 'Get paid in native ETH for being a top loser. Robinhood Chain · automated payouts every 15 minutes.',
    site: '@topblasteth',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
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
