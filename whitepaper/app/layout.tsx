import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TopBlast | Bullish-Holder Rewards for Solana Devs',
  description:
    'Turn creator-fee SOL into loss-mining rewards for holders who bought the top and stayed in. Self-serve SaaS for any SPL token — no cashback sell pressure.',
  keywords: [
    'solana',
    'spl',
    'pump.fun',
    'loss-mining',
    'token creator',
    'creator rewards',
    'topblast',
    'whitepaper',
    'saas',
  ],
  authors: [{ name: 'TopBlast' }],
  openGraph: {
    title: 'TopBlast | Bullish-Holder Rewards for Solana Devs',
    description:
      'Reward holders who stay bullish while underwater. Self-serve loss-mining for any Solana token.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TopBlast | Bullish-Holder Rewards for Solana Devs',
    description:
      'Turn creator-fee SOL into holder rewards — without cashback sell pressure.',
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
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
