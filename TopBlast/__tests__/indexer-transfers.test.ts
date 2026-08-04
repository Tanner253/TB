import {
  classifyIncomingTokenTransfer,
  classifyOutgoingTokenTransfer,
} from '@/lib/evm/indexer'

describe('token transfer classification', () => {
  const wallet = '0xe52ecc0b8cb032a200301e0e5f79276af77201bd'

  it('treats LP pool → wallet as BUY (Pons swap)', () => {
    const result = classifyIncomingTokenTransfer(
      {
        from: { hash: '0xc1E01C299dD264146c00a57d61bBC79a92fa0989', is_contract: true },
        to: { hash: wallet, is_contract: false },
        method: '0x4d819a2a',
      },
      wallet
    )
    expect(result).toBe('BUY')
  })

  it('treats wallet → LP pool as SELL', () => {
    const result = classifyOutgoingTokenTransfer(
      {
        from: { hash: wallet },
        to: { hash: '0xc1E01C299dD264146c00a57d61bBC79a92fa0989', is_contract: true },
      },
      wallet
    )
    expect(result).toBe('SELL')
  })

  it('treats EOA → wallet as TRANSFER_IN', () => {
    const result = classifyIncomingTokenTransfer(
      {
        from: { hash: '0xabcabcabcabcabcabcabcabcabcabcabcabcabca', is_contract: false },
        to: { hash: wallet, is_contract: false },
      },
      wallet
    )
    expect(result).toBe('TRANSFER_IN')
  })

  it('treats launchToken from factory as BUY', () => {
    const result = classifyIncomingTokenTransfer(
      {
        from: { hash: '0xc1E01C299dD264146c00a57d61bBC79a92fa0989', is_contract: true },
        to: { hash: wallet, is_contract: false },
        method: 'launchToken',
      },
      wallet
    )
    expect(result).toBe('BUY')
  })
})
