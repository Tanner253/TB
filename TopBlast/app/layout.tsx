import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TopBlast | The Loss-Mining Protocol',
  description: 'The Loss-Mining Protocol on Solana. Top 3 losers win native SOL payouts every 15 minutes.',
  keywords: ['solana', 'spl', 'defi', 'loss-mining', 'crypto', 'topblast', 'helius'],
  authors: [{ name: 'TopBlast' }],
  openGraph: {
    title: 'TopBlast | The Loss-Mining Protocol',
    description: 'Get paid in native SOL for being a top loser. Solana · automated payouts every 15 minutes.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TopBlast | The Loss-Mining Protocol',
    description: 'Get paid in native SOL for being a top loser. Solana · automated payouts every 15 minutes.',
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
