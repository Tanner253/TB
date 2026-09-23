import {
  isListingFormValid,
  validateListingForm,
  type ListingFormValues,
} from '@/lib/platform/listingFormValidation'

const good: ListingFormValues = {
  slug: 'my-token',
  symbol: 'MYTKN',
  mint: '0xD2Cf09d6DF99B4C289dd007EFF8f2dB89D28b5C5',
  payoutWalletPrivateKey: '0x' + 'a'.repeat(64),
  payoutIntervalMinutes: 15,
  winnerCount: 3,
  minTokenHolding: 100_000,
  payoutMode: 'token',
}

const withField = (over: Partial<ListingFormValues>) => ({ ...good, ...over })

describe('listing form validation', () => {
  it('accepts a well-formed listing', () => {
    expect(validateListingForm(good)).toEqual({})
    expect(isListingFormValid(good)).toBe(true)
  })

  it('accepts a private key without the 0x prefix', () => {
    expect(isListingFormValid(withField({ payoutWalletPrivateKey: 'b'.repeat(64) }))).toBe(true)
  })

  describe('private key — the costly field to get wrong', () => {
    it('rejects a key that is really a wallet address', () => {
      const e = validateListingForm(withField({ payoutWalletPrivateKey: good.mint }))
      expect(e.payoutWalletPrivateKey).toMatch(/address, not a private key/i)
    })

    it('rejects a key one character short', () => {
      const e = validateListingForm(withField({ payoutWalletPrivateKey: '0x' + 'a'.repeat(63) }))
      expect(e.payoutWalletPrivateKey).toMatch(/64 hex/i)
    })

    it('rejects non-hex characters', () => {
      const e = validateListingForm(withField({ payoutWalletPrivateKey: '0x' + 'z'.repeat(64) }))
      expect(e.payoutWalletPrivateKey).toBeDefined()
    })

    it('rejects an empty key', () => {
      expect(validateListingForm(withField({ payoutWalletPrivateKey: '  ' })).payoutWalletPrivateKey).toBeDefined()
    })
  })

  describe('token address', () => {
    it('rejects a base58 mint from the old chain', () => {
      const e = validateListingForm(withField({ mint: 'JAKnM5B8pC7747QqGEGyeJmdAn55mmjb2Eqd2bpSpump' }))
      expect(e.mint).toMatch(/EVM contract address/i)
    })

    it('rejects the zero address', () => {
      expect(validateListingForm(withField({ mint: '0x' + '0'.repeat(40) })).mint).toMatch(/zero address/i)
    })

    it('rejects a truncated address', () => {
      expect(validateListingForm(withField({ mint: '0x' + 'a'.repeat(39) })).mint).toBeDefined()
    })
  })

  describe('slug', () => {
    it.each([
      ['My-Token', 'uppercase'],
      ['ab', 'too short'],
      ['-leading', 'leading hyphen'],
      ['trailing-', 'trailing hyphen'],
      ['has space', 'space'],
      ['a'.repeat(40), 'too long'],
    ])('rejects %s (%s)', slug => {
      expect(validateListingForm(withField({ slug })).slug).toBeDefined()
    })

    it('accepts hyphenated lowercase', () => {
      expect(validateListingForm(withField({ slug: 'blast-off-2' })).slug).toBeUndefined()
    })
  })

  it('bounds winners to 3–10', () => {
    for (const winnerCount of [0, 2, 11, 3.5]) {
      expect(validateListingForm(withField({ winnerCount })).winnerCount).toBeDefined()
    }
    for (const winnerCount of [3, 10]) {
      expect(validateListingForm(withField({ winnerCount })).winnerCount).toBeUndefined()
    }
  })

  it('requires a positive minimum balance and interval', () => {
    expect(validateListingForm(withField({ minTokenHolding: 0 })).minTokenHolding).toBeDefined()
    expect(validateListingForm(withField({ payoutIntervalMinutes: 0 })).payoutIntervalMinutes).toBeDefined()
  })

  it('reports every bad field at once rather than stopping at the first', () => {
    const e = validateListingForm({ ...good, slug: '', symbol: '', mint: 'nope', payoutWalletPrivateKey: '' })
    expect(Object.keys(e).sort()).toEqual(['mint', 'payoutWalletPrivateKey', 'slug', 'symbol'])
  })
})
