/**
 * Pons' UI buys through a router: CurveBuy names the router as recipient and
 * the tokens are forwarded to the buyer in the same transaction. These lock in
 * the netting rule that finds the real buyer, using the shape of the actual
 * on-chain transaction that exposed the bug
 * (0xcd838f20…, router 0x7cf30960aa…, buyer 0x3b11d5172f…).
 */

const CURVE = '0xfed09b20d6e22b706a5e910b10c08add43bdafff'
const ROUTER = '0x7cf30960aa891c4d47cc3f17f33f5679a8985774'
const BUYER = '0x3b11d5172fcd2fe9e49d2b0cc9a976999a39f6ad'
const AMOUNT = 11459986077868545000000000n

type Transfer = { from: string; to: string; value: bigint }

/** Mirrors resolveBuyBeneficiary's netting, which is the part worth pinning. */
function beneficiary(transfers: Transfer[], recipient: string, tokensOut: bigint, excluded: Set<string>): string {
  if (tokensOut <= 0n || transfers.length < 2) return recipient
  const net = new Map<string, bigint>()
  for (const t of transfers) {
    net.set(t.from, (net.get(t.from) ?? 0n) - t.value)
    net.set(t.to, (net.get(t.to) ?? 0n) + t.value)
  }
  const gainers = [...net].filter(([a, v]) => v > 0n && !excluded.has(a))
  const exact = gainers.filter(([, v]) => v === tokensOut)
  return exact.length === 1 ? exact[0][0] : recipient
}

const excluded = new Set([CURVE])

describe('router-forwarded curve buys', () => {
  it('credits the buyer, not the router', () => {
    const transfers = [
      { from: CURVE, to: ROUTER, value: AMOUNT },
      { from: ROUTER, to: BUYER, value: AMOUNT },
    ]
    expect(beneficiary(transfers, ROUTER, AMOUNT, excluded)).toBe(BUYER)
  })

  it('leaves a direct buy alone', () => {
    const transfers = [{ from: CURVE, to: BUYER, value: AMOUNT }]
    expect(beneficiary(transfers, BUYER, AMOUNT, excluded)).toBe(BUYER)
  })

  it('never credits a router that nets zero', () => {
    const transfers = [
      { from: CURVE, to: ROUTER, value: AMOUNT },
      { from: ROUTER, to: BUYER, value: AMOUNT },
    ]
    expect(beneficiary(transfers, ROUTER, AMOUNT, excluded)).not.toBe(ROUTER)
  })

  it('refuses to guess when the buy is split across wallets', () => {
    const half = AMOUNT / 2n
    const transfers = [
      { from: CURVE, to: ROUTER, value: AMOUNT },
      { from: ROUTER, to: BUYER, value: half },
      { from: ROUTER, to: '0xdead00000000000000000000000000000000beef', value: AMOUNT - half },
    ]
    expect(beneficiary(transfers, ROUTER, AMOUNT, excluded)).toBe(ROUTER)
  })

  it('refuses to guess when two wallets each net the exact amount', () => {
    const other = '0xabc0000000000000000000000000000000000001'
    const transfers = [
      { from: CURVE, to: ROUTER, value: AMOUNT },
      { from: ROUTER, to: BUYER, value: AMOUNT },
      { from: CURVE, to: other, value: AMOUNT },
    ]
    expect(beneficiary(transfers, ROUTER, AMOUNT, excluded)).toBe(ROUTER)
  })

  it('ignores the curve even when it nets positive', () => {
    // A creator-tax leg pays tokens back to the curve in the same transaction;
    // the curve is excluded, so it must never be mistaken for the buyer.
    const tax = 1000n
    const transfers = [
      { from: CURVE, to: ROUTER, value: AMOUNT },
      { from: ROUTER, to: BUYER, value: AMOUNT },
      { from: ROUTER, to: CURVE, value: tax },
      { from: CURVE, to: ROUTER, value: tax },
    ]
    expect(beneficiary(transfers, ROUTER, AMOUNT, excluded)).toBe(BUYER)
  })

  it('falls back to the recorded recipient when the receipt is unreadable', () => {
    // Fewer than two transfers means there is no forwarding hop to follow.
    expect(beneficiary([{ from: CURVE, to: ROUTER, value: AMOUNT }], ROUTER, AMOUNT, excluded)).toBe(ROUTER)
    expect(beneficiary([], ROUTER, AMOUNT, excluded)).toBe(ROUTER)
  })
})
