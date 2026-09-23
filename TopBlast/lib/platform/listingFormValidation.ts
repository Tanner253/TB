/**
 * Shape checks for the listing form, run before anything is submitted.
 *
 * The server is the authority and stays that way — only it can ask the chain
 * whether a token is a Pons launch, ETH-paired, still on its curve, and whether
 * the payout wallet is the launch's creatorFeeRecipient. None of that can be
 * known in the browser.
 *
 * What the browser *can* do is stop someone filling in an entire form, pasting
 * a private key, and only then learning they typed 41 hex characters. These are
 * deliberately shape-only, and deliberately mirror the server's own rules so
 * the two never disagree about what a valid slug looks like.
 *
 * Dependency-free so it can be unit tested and run on the client.
 */

export interface ListingFormValues {
  slug: string
  symbol: string
  mint: string
  payoutWalletPrivateKey: string
  payoutIntervalMinutes: number
  winnerCount: number
  minTokenHolding: number
  payoutMode: 'token' | 'sol'
}

export type ListingFieldErrors = Partial<Record<keyof ListingFormValues, string>>

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
/** 32 bytes, with or without the 0x prefix — both are accepted by the server. */
const EVM_PRIVATE_KEY_RE = /^(0x)?[0-9a-fA-F]{64}$/

export const WINNER_COUNT_RANGE = { min: 3, max: 10 } as const

export function validateListingForm(values: ListingFormValues): ListingFieldErrors {
  const errors: ListingFieldErrors = {}

  const slug = values.slug.trim()
  if (!slug) errors.slug = 'Choose your session link'
  else if (!SLUG_RE.test(slug)) {
    errors.slug =
      'Use 3–32 lowercase letters, numbers or hyphens, starting and ending with a letter or number'
  }

  const symbol = values.symbol.trim()
  if (!symbol) errors.symbol = 'Enter your ticker symbol'
  else if (symbol.length > 12) errors.symbol = 'Ticker symbols are at most 12 characters'

  const mint = values.mint.trim()
  if (!mint) errors.mint = 'Paste your Pons token contract address'
  else if (!EVM_ADDRESS_RE.test(mint)) {
    errors.mint = 'That is not an EVM contract address — it should be 0x followed by 40 hex characters'
  } else if (/^0x0{40}$/i.test(mint)) {
    errors.mint = 'That is the zero address'
  }

  const key = values.payoutWalletPrivateKey.trim()
  if (!key) errors.payoutWalletPrivateKey = 'Enter the payout wallet private key'
  else if (EVM_ADDRESS_RE.test(key)) {
    // A very easy and very costly mistake to make.
    errors.payoutWalletPrivateKey = 'That looks like a wallet address, not a private key'
  } else if (!EVM_PRIVATE_KEY_RE.test(key)) {
    errors.payoutWalletPrivateKey = 'A private key is 64 hex characters, optionally prefixed with 0x'
  } else if (mint && key.replace(/^0x/, '').toLowerCase() === mint.replace(/^0x/, '').toLowerCase()) {
    errors.payoutWalletPrivateKey = 'That is the token address, not a private key'
  }

  if (!Number.isFinite(values.payoutIntervalMinutes) || values.payoutIntervalMinutes <= 0) {
    errors.payoutIntervalMinutes = 'Pick a payout frequency'
  }

  const winners = values.winnerCount
  if (!Number.isInteger(winners) || winners < WINNER_COUNT_RANGE.min || winners > WINNER_COUNT_RANGE.max) {
    errors.winnerCount = `Winners per cycle must be between ${WINNER_COUNT_RANGE.min} and ${WINNER_COUNT_RANGE.max}`
  }

  const minHold = values.minTokenHolding
  if (!Number.isFinite(minHold) || minHold <= 0) {
    errors.minTokenHolding = 'Minimum balance must be greater than zero'
  }

  if (values.payoutMode !== 'token' && values.payoutMode !== 'sol') {
    errors.payoutMode = 'Pick a payout currency'
  }

  return errors
}

export function isListingFormValid(values: ListingFormValues): boolean {
  return Object.keys(validateListingForm(values)).length === 0
}
