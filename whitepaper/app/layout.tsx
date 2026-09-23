import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://whitepaper.topblast.family'),
  title: 'TopBlast | Loss-Mining + Chart Volume on Robinhood Chain',
  description:
    'Turn Pons creator fees into on-chart buybacks and token airdrops for underwater holders. Self-serve SaaS for any Pons token on Robinhood Chain — Gen volume tracked in the catalog.',
  keywords: [
    'robinhood chain',
    'pons',
    'ponsfamily',
    'loss-mining',
    'chart volume',
    'gen volume',
    'uniswap v4',
    'buyback',
    'token creator',
    'creator rewards',
    'topblast',
    'whitepaper',
    'saas',
  ],
  authors: [{ name: 'TopBlast' }],
  openGraph: {
    title: 'TopBlast | Loss-Mining + Chart Volume on Robinhood Chain',
    description:
      'Reward underwater holders with on-chart buybacks and token airdrops. Every cycle adds measurable Gen volume to your chart.',
    type: 'website',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TopBlast | Loss-Mining + Chart Volume on Robinhood Chain',
    description:
      'Creator fees become on-chart volume — real buys on your Pons curve, token airdrops, no cashback sell pressure.',
    site: '@oSKNYo_dev',
    images: ['/og-image.png'],
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
