import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Topblast | The Loss-Mining Protocol',
  description: 'The world\'s first Loss-Mining Protocol. Built on Solana + Clockwork.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

