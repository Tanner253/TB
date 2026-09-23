import {
  addressExplorerUrl,
  explorerLabel,
  tokenExplorerUrl,
  txExplorerUrl,
  usesEvmExplorer,
} from '@/lib/platform/explorer'

const EVM_TOKEN = '0xD2Cf09d6DF99B4C289dd007EFF8f2dB89D28b5C5'
const EVM_WALLET = '0x2d32630c0ca699a383521c2784788446f73abed4'
const SOL_MINT = 'JAKnM5B8pC7747QqGEGyeJmdAn55mmjb2Eqd2bpSpump'

describe('explorer links follow the address, not the deployment', () => {
  it('sends Robinhood Chain tokens to Blockscout', () => {
    expect(tokenExplorerUrl(EVM_TOKEN)).toBe(
      `https://robinhoodchain.blockscout.com/token/${EVM_TOKEN}`
    )
    expect(usesEvmExplorer(EVM_TOKEN)).toBe(true)
    expect(explorerLabel(EVM_TOKEN)).toBe('Blockscout')
  })

  it('never sends an 0x address to Solscan', () => {
    for (const url of [
      tokenExplorerUrl(EVM_TOKEN),
      addressExplorerUrl(EVM_WALLET),
      txExplorerUrl(`0x${'a'.repeat(64)}`),
    ]) {
      expect(url).not.toContain('solscan')
    }
  })

  it('keeps legacy base58 mints on Solscan', () => {
    expect(tokenExplorerUrl(SOL_MINT)).toBe(`https://solscan.io/token/${SOL_MINT}`)
    expect(explorerLabel(SOL_MINT)).toBe('Solscan')
  })

  it('routes tx hashes by their own shape', () => {
    expect(txExplorerUrl(`0x${'b'.repeat(64)}`)).toContain('blockscout')
    expect(txExplorerUrl('5Kd3NfWJ2sLwqFZ8vQ1rT9xYbHcGmAePuVnRdX4tJkSo')).toContain('solscan')
  })

  it('lets a caller force the chain when the hash is ambiguous', () => {
    expect(txExplorerUrl('abc123', { evm: true })).toContain('blockscout')
  })

  it('never builds a link on the redirecting robinhood.com host', () => {
    // explorer.mainnet.chain.robinhood.com redirects to Blockscout but DROPS
    // the path, so a link there lands on the explorer home page.
    expect(tokenExplorerUrl(EVM_TOKEN)).not.toContain('chain.robinhood.com')
  })

  it('returns null rather than a broken link for empty input', () => {
    for (const v of [null, undefined, '', '   ']) {
      expect(tokenExplorerUrl(v)).toBeNull()
      expect(addressExplorerUrl(v)).toBeNull()
      expect(txExplorerUrl(v)).toBeNull()
    }
  })
})
