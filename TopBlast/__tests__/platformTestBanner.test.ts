jest.mock('@/lib/config', () => ({
  config: {
    tenantSlug: '_legacy',
    tokenMint: 'So11111111111111111111111111111111111111112',
  },
}))

describe('getPlatformTestBanner', () => {
  const originalMint = process.env.TOKEN_MINT_ADDRESS
  const originalKey = process.env.PAYOUT_WALLET_PRIVATE_KEY

  afterEach(() => {
    if (originalMint === undefined) delete process.env.TOKEN_MINT_ADDRESS
    else process.env.TOKEN_MINT_ADDRESS = originalMint
    if (originalKey === undefined) delete process.env.PAYOUT_WALLET_PRIVATE_KEY
    else process.env.PAYOUT_WALLET_PRIVATE_KEY = originalKey
    jest.resetModules()
  })

  it('returns hardcoded banner for env-driven platform token leaderboard', async () => {
    process.env.TOKEN_MINT_ADDRESS = 'So11111111111111111111111111111111111111112'
    process.env.PAYOUT_WALLET_PRIVATE_KEY = 'fake'

    const { getPlatformTestBanner } = await import('@/lib/platform/testBanner')
    expect(getPlatformTestBanner()).toEqual({
      label: 'TEST',
      message: 'NOT OFFICIAL TOKEN',
    })
  })

  it('returns null when env platform is not configured', async () => {
    delete process.env.TOKEN_MINT_ADDRESS
    delete process.env.PAYOUT_WALLET_PRIVATE_KEY

    const { getPlatformTestBanner } = await import('@/lib/platform/testBanner')
    expect(getPlatformTestBanner()).toBeNull()
  })
})
