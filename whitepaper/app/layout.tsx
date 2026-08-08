import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://whitepaper.topblasted.fun'),
  title: 'TopBlast | Loss-Mining + Chart Volume for Solana',
  description:
    'Turn creator-fee SOL into on-chart Jupiter buybacks and token airdrops for underwater holders. Self-serve SaaS for any SPL token — Gen volume tracked in the catalog.',
  keywords: [
    'solana',
    'spl',
    'pump.fun',
    'loss-mining',
    'chart volume',
    'gen volume',
    'jupiter',
    'buyback',
    'token creator',
    'creator rewards',
    'topblast',
    'whitepaper',
    'saas',
  ],
  authors: [{ name: 'TopBlast' }],
  openGraph: {
    title: 'TopBlast | Loss-Mining + Chart Volume for Solana',
    description:
      'Reward underwater holders with on-chart buybacks and token airdrops. Every cycle adds measurable Gen volume to your chart.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TopBlast | Loss-Mining + Chart Volume for Solana',
    description:
      'Creator fees become on-chart volume — Jupiter buys, token airdrops, no cashback sell pressure.',
    site: '@oSKNYo_dev',
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
