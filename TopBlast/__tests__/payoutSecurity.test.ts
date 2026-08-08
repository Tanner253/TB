import {
  assertProductionPayoutConfig,
  isValidSolanaAddress,
  maxDistributableSol,
  assertPayoutTransferAllowed,
} from '@/lib/payout/payoutSecurity'

jest.mock('@/lib/config', () => ({
  config: {
    isProd: true,
    executePayouts: true,
    devWalletAddress: 'oBrNjdETmjiGdutugqkHGzwaHnmdpJKhnpkud1GPpd6',
    tokenMint: 'EhPRAU29zMjRxcTTgh1XW49t2Fn1SGtczUMxLZxmpump',
    tokenDecimals: 6,
    minTokenHolding: 1000,
    poolPercentage: 0.99,
  },
}))

jest.mock('@/lib/solana/indexer', () => ({
  getTokenHolders: jest.fn(async () => [
    {
      wallet: '7F8RuECaT5GqVCzFkh89GXUo24hptgaQbJFVWZM1WL3z',
      balance: 1_000_000_000_000,
      isContract: false,
    },
  ]),
}))

describe('payoutSecurity', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, CRON_SECRET: 'test-secret', PAYOUT_WALLET_PRIVATE_KEY: 'fake' }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('rejects EVM dev wallet addresses', () => {
    expect(isValidSolanaAddress('0x9b3283f077d49fee9ccc174a9482fd6c3b758589')).toBe(false)
    expect(isValidSolanaAddress('oBrNjdETmjiGdutugqkHGzwaHnmdpJKhnpkud1GPpd6')).toBe(true)
  })

  it('requires payout wallet key when execute payouts in production', () => {
    delete process.env.PAYOUT_WALLET_PRIVATE_KEY
    expect(assertProductionPayoutConfig()).toMatch(/PAYOUT_WALLET_PRIVATE_KEY/)
  })

  it('caps distributable SOL by wallet reserve', () => {
    process.env.MIN_WALLET_RESERVE_SOL = '0.01'
    expect(maxDistributableSol(0.1)).toBeCloseTo(0.09, 5)
    expect(maxDistributableSol(0.005)).toBe(0)
  })

  it('blocks unknown winner recipients', async () => {
    const result = await assertPayoutTransferAllowed({
      rank: 1,
      recipient: '5qmtDCvUreD8G59M5FosdpV8Gqdd3kFgdH1Vv7HKXUKq',
      amountSol: 0.01,
      walletSol: 0.1,
      allowedWinners: [
        {
          wallet: '7F8RuECaT5GqVCzFkh89GXUo24hptgaQbJFVWZM1WL3z',
          drawdownPct: -40,
          lossUsd: 10,
        },
      ],
      expectedWinnerAmounts: [0.01],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toMatch(/not live eligible winner/)
    }
  })

  it('blocks payouts above distributable cap', async () => {
    process.env.MIN_WALLET_RESERVE_SOL = '0.01'
    const winnerWallet = '7F8RuECaT5GqVCzFkh89GXUo24hptgaQbJFVWZM1WL3z'
    const result = await assertPayoutTransferAllowed({
      rank: 1,
      recipient: winnerWallet,
      amountSol: 0.095,
      walletSol: 0.1,
      allowedWinners: [
        { wallet: winnerWallet, drawdownPct: -40, lossUsd: 10 },
      ],
      expectedWinnerAmounts: [0.01],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toMatch(/exceeds distributable cap/)
    }
  })

  it('allows dev fee to DEV_WALLET_ADDRESS even when dev is excluded from competition', async () => {
    const devWallet = 'oBrNjdETmjiGdutugqkHGzwaHnmdpJKhnpkud1GPpd6'
    const result = await assertPayoutTransferAllowed({
      rank: 0,
      recipient: devWallet,
      amountSol: 0.006,
      walletSol: 0.1,
      allowedWinners: [],
      expectedWinnerAmounts: [],
    })
    expect(result.ok).toBe(true)
  })

  it('blocks winner payout to dev wallet', async () => {
    const devWallet = 'oBrNjdETmjiGdutugqkHGzwaHnmdpJKhnpkud1GPpd6'
    const result = await assertPayoutTransferAllowed({
      rank: 1,
      recipient: devWallet,
      amountSol: 0.01,
      walletSol: 0.1,
      allowedWinners: [
        { wallet: devWallet, drawdownPct: -40, lossUsd: 10 },
      ],
      expectedWinnerAmounts: [0.01],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toMatch(/excluded protocol wallet/)
    }
  })
})
