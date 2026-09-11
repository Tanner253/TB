/**
 * A payout record must keep saying what it actually paid. Relabelling the
 * Solana-era history as ETH after the migration would quietly falsify the
 * one page users check to confirm what they received.
 */

import { nativeUnitForMint } from '@/lib/platform/chainShape'

describe('nativeUnitForMint', () => {
  it('keeps Solana-era listings denominated in SOL', () => {
    expect(nativeUnitForMint('JAKnM5B8pC7747QqGEGyeJmdAn55mmjb2Eqd2bpSpump')).toBe('SOL')
    expect(nativeUnitForMint('So11111111111111111111111111111111111111112')).toBe('SOL')
  })

  it('denominates Pons listings in ETH', () => {
    expect(nativeUnitForMint('0x600A5bbB67EB4e405f9aAE72f3E049a3888eeF68')).toBe('ETH')
    expect(nativeUnitForMint('0x600a5bbb67eb4e405f9aae72f3e049a3888eef68')).toBe('ETH')
  })

  it('defaults to the current chain when the mint is unknown', () => {
    expect(nativeUnitForMint(null)).toBe('ETH')
    expect(nativeUnitForMint('')).toBe('ETH')
  })
})
