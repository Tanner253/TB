import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TopBlast Whitepaper | The Loss-Mining Protocol',
  description: 'The world\'s first Loss-Mining Protocol. Get paid for being a top loser. Every hour, the top 3 wallets with the biggest drawdowns win from the reward pool.',
  keywords: ['solana', 'defi', 'loss-mining', 'crypto', 'topblast', 'whitepaper', 'TBLAST'],
  authors: [{ name: 'TopBlast' }],
  openGraph: {
    title: 'TopBlast Whitepaper | The Loss-Mining Protocol',
    description: 'Get paid for being a top loser. Every hour, the top 3 wallets with the biggest drawdowns win.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TopBlast Whitepaper | The Loss-Mining Protocol',
    description: 'Get paid for being a top loser. Every hour, the top 3 wallets with the biggest drawdowns win.',
    site: '@TOPBLASTX',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#06060a',
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
        <link rel="apple-touch-icon" href="/logo.jpg" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}

