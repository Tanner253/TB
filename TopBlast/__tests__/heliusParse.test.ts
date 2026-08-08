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

  it('detects pump.fun TRANSFER buy when wallet pays SOL (not SWAP type)', () => {
    const pumpBuyer = '98ZzbYBphzGgoEuWhihc4jFoJc9qidmbASPKv5YSwmnc'
    const txs = parseWalletMintTransactions(pumpBuyer, mint, [
      {
        signature: 'sig-pump-buy',
        timestamp: 1_700_000_000,
        type: 'TRANSFER',
        source: 'SYSTEM_PROGRAM',
        feePayer: pumpBuyer,
        tokenTransfers: [
          {
            mint,
            fromUserAccount: pool,
            toUserAccount: pumpBuyer,
            tokenAmount: 702_851.446329,
          },
        ],
        nativeTransfers: [
          { fromUserAccount: pumpBuyer, toUserAccount: pool, amount: 23_274_080 },
        ],
      },
    ])

    const buy = txs.find(t => t.type === 'BUY')
    expect(buy).toBeTruthy()
    expect(buy?.tokenAmount).toBeCloseTo(702_851.446329, 3)
    expect(buy?.solAmount).toBeCloseTo(0.02327408, 5)
    expect(txs.some(t => t.type === 'TRANSFER_IN')).toBe(false)
  })

  it('detects buy from description USD when nativeTransfers missing', () => {
    const buyer = 'B6rnExampleWallet111111111111111111111111111'
    const txs = parseWalletMintTransactions(buyer, mint, [
      {
        signature: 'sig-desc-buy',
        timestamp: 1_700_000_000,
        type: 'TRANSFER',
        feePayer: buyer,
        description: 'B6rn swapped $44.37 for 12.7M tokens',
        tokenTransfers: [
          {
            mint,
            fromUserAccount: pool,
            toUserAccount: buyer,
            tokenAmount: 12_730_591,
          },
        ],
      },
    ])

    expect(txs.some(t => t.type === 'BUY')).toBe(true)
  })

  it('detects pump.fun INITIALIZE_ACCOUNT buy when wallet pays SOL to bonding curve', () => {
    const pumpBuyer = 'B6rneBPNPGu5TyJ8nk6NSi7cVnThz75f66wZZ4PTvAZC'
    const bondingCurve = 'H2uPQ4oa2thbjmsDnGy8u4Rh2pdpstPJ78QXfganw68N'
    const txs = parseWalletMintTransactions(pumpBuyer, mint, [
      {
        signature: 'sig-pump-init',
        timestamp: 1_700_000_000,
        type: 'INITIALIZE_ACCOUNT',
        feePayer: pumpBuyer,
        tokenTransfers: [
          {
            mint,
            fromUserAccount: bondingCurve,
            toUserAccount: pumpBuyer,
            tokenAmount: 5_003_857.236008,
          },
        ],
        nativeTransfers: [
          { fromUserAccount: pumpBuyer, toUserAccount: bondingCurve, amount: 296_296_296 },
          { fromUserAccount: pumpBuyer, toUserAccount: '53zkMK3TdAhXPnKkXzNwuVJYhGbpepZos3tDzMJ5osh4', amount: 888_889 },
        ],
      },
    ])

    const buy = txs.find(t => t.type === 'BUY')
    expect(buy).toBeTruthy()
    expect(buy?.tokenAmount).toBeCloseTo(5_003_857.236008, 3)
    expect(buy?.solAmount).toBeGreaterThan(0.29)
    expect(txs.some(t => t.type === 'TRANSFER_IN')).toBe(false)
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
