import { parseWalletMintTransactions } from '@/lib/solana/helius'

describe('parseWalletMintTransactions', () => {
  const mint = 'EhPRAU29zMjRxcTTgh1XW49t2Fn1SGtczUMxLZxmpump'
  const buyer = 'A7k3e7mQEYFxLjM6LXUk8bD7tM2T86retcJPjdqsvC5j'
  const pool = 'Eg37sGi63Pq5PPNEtfgaheeqnibUq1865J7R6nNGj7zv'

  it('detects Jupiter swap buy when tokens arrive at wallet', () => {
    const txs = parseWalletMintTransactions(buyer, mint, [
      {
        signature: 'sig-buy',
        timestamp: 1_700_000_000,
        type: 'SWAP',
        feePayer: buyer,
        tokenTransfers: [
          {
            mint,
            fromUserAccount: pool,
            toUserAccount: buyer,
            tokenAmount: 1_637_695.535,
          },
        ],
        nativeTransfers: [
          { fromUserAccount: buyer, toUserAccount: pool, amount: 50_000_000 },
        ],
      },
    ])

    expect(txs.some(t => t.type === 'BUY' && t.tokenAmount > 0)).toBe(true)
    expect(txs.find(t => t.type === 'BUY')?.solAmount).toBeCloseTo(0.05, 4)
  })

  it('marks pool-to-wallet transfer as TRANSFER_IN not BUY', () => {
    const recipient = 'DiiHaXbhwf2HVkyMSNRxkctomAy9jaBxUT1vbPZokgwZ'
    const txs = parseWalletMintTransactions(recipient, mint, [
      {
        signature: 'sig-xfer',
        timestamp: 1_700_000_000,
        type: 'TRANSFER',
        feePayer: recipient,
        tokenTransfers: [
          {
            mint,
            fromUserAccount: pool,
            toUserAccount: recipient,
            tokenAmount: 16_075_721.28,
          },
        ],
      },
    ])

    expect(txs.some(t => t.type === 'TRANSFER_IN')).toBe(true)
    expect(txs.some(t => t.type === 'BUY')).toBe(false)
  })
})
