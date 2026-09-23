/** Protocol-wide flywheel economics (client-safe constants) */

/**
 * The protocol takes two separate cuts of every payout pool, and they are
 * deliberately separate line items rather than one fee that gets split:
 *
 *   12% dev  — ops, infra, growth. Paid to DEV_WALLET_ADDRESS.
 *    8% burn — market-buys the platform token and destroys it.
 *   ---
 *   20% protocol, 80% to eligible losers.
 *
 * Keeping them separate matters because the burn is a promise about supply,
 * not a budget line. A cut of the dev fee can quietly be re-allocated; a
 * first-class 8% cannot, and it is the number holders can check against
 * totalSupply.
 */
export const DEV_FEE_PCT = 12

/** Market-buys the platform token and burns it. Its own cut, not a share of the dev fee. */
export const BUYBACK_BURN_PCT = 8

/** Everything the protocol takes before winners are paid. */
export const PROTOCOL_FEE_PCT = DEV_FEE_PCT + BUYBACK_BURN_PCT

/** What reaches eligible losers. */
export const COMMUNITY_PCT = 100 - PROTOCOL_FEE_PCT

/** Effective buyback rate against the original pool — same number, named for the UI. */
export const PLATFORM_BUYBACK_PCT_OF_POOL = BUYBACK_BURN_PCT

/** Effective ops rate against the original pool. */
export const PLATFORM_OPS_PCT_OF_POOL = DEV_FEE_PCT

/** Buyback's share of the total protocol take, for "x% of the fee" copy. */
export const BUYBACK_SHARE_OF_PROTOCOL_PCT = Math.round(
  (BUYBACK_BURN_PCT / PROTOCOL_FEE_PCT) * 100
)

/**
 * Market-bought tokens are destroyed with the token's own `burn(uint256)`.
 * Every Pons launch is the same ERC20Burnable implementation, so supply
 * actually drops and anyone can check it against totalSupply. Sending to the
 * zero address would revert — these tokens carry OpenZeppelin's
 * ERC20InvalidReceiver guard. Burned supply cannot be sold, re-minted or
 * recovered by anyone, including us.
 */
export const FLYWHEEL_BURN_METHOD = 'erc20-burn' as const

/** The buy-and-burn runs on every cycle with no operator action. */
export const FLYWHEEL_BURN_STATUS = 'automated' as const

export const FLYWHEEL_TREE = {
  root: `Every tenant cycle → ${PROTOCOL_FEE_PCT}% ETH to the protocol, ${COMMUNITY_PCT}% to eligible losers`,
  buyback: `${BUYBACK_BURN_PCT}% of the pool → market-buys the platform token`,
  ops: `${DEV_FEE_PCT}% of the pool → ops / infra / growth`,
  burn: 'Purchased tokens → burn() → supply permanently reduced, unsellable',
  burnNote:
    'Buy and burn run inside the payout cycle itself, after winners are paid — a failure there returns the share to ops rather than stranding it. Only confirmed burns are counted in the public totals.',
} as const

export const FLYWHEEL_INTRO =
  `Every SaaS listing pays a flat ${PROTOCOL_FEE_PCT}% protocol fee in ETH on each payout cycle: ` +
  `${DEV_FEE_PCT}% funds ops and growth, and ${BUYBACK_BURN_PCT}% market-buys the TopBlast platform ` +
  'token and burns it. The burn is automatic and happens every cycle.'

export const FLYWHEEL_STEPS = [
  'Projects list tokens for conviction rewards via self-serve TopBlast',
  FLYWHEEL_TREE.root,
  FLYWHEEL_TREE.buyback,
  FLYWHEEL_TREE.burn,
  FLYWHEEL_TREE.ops,
  'More SaaS tenants → more fee flow → less platform-token supply',
] as const
