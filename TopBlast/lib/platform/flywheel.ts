/** Protocol-wide flywheel economics (client-safe constants) */

export const DEV_FEE_PCT = 12

/** Share of each tenant's dev fee routed to platform-token buyback */
export const DEV_FEE_BUYBACK_SHARE_PCT = 50

/** Effective buyback rate: 50% of 12% = 6% of each payout pool */
export const PLATFORM_BUYBACK_PCT_OF_POOL =
  DEV_FEE_PCT * (DEV_FEE_BUYBACK_SHARE_PCT / 100)

/** Effective ops rate: other 50% of dev fee = 6% of each payout pool */
export const PLATFORM_OPS_PCT_OF_POOL = PLATFORM_BUYBACK_PCT_OF_POOL

/** Remaining dev fee share label (of the 12% fee, not of pool) */
export const DEV_FEE_OPS_SHARE_PCT = 100 - DEV_FEE_BUYBACK_SHARE_PCT

/**
 * Market-bought tokens are destroyed with the token's own `burn(uint256)`.
 * Every Pons launch is the same ERC20Burnable implementation, so supply
 * actually drops and anyone can check it against totalSupply. Sending to the
 * zero address would revert — these tokens carry OpenZeppelin's
 * ERC20InvalidReceiver guard.
 */
export const FLYWHEEL_BURN_METHOD = 'erc20-burn' as const

/**
 * Automation ships behind FLYWHEEL_AUTO_BUYBACK. It spends real money on a
 * path that has not executed in production yet, so it does not default on.
 */
export const FLYWHEEL_BURN_STATUS = 'staged' as const

export const FLYWHEEL_TREE = {
  root: `Every tenant cycle → ${DEV_FEE_PCT}% ETH to the platform treasury`,
  buyback: `${PLATFORM_BUYBACK_PCT_OF_POOL}% of original pool (${DEV_FEE_BUYBACK_SHARE_PCT}% of fee) → market-buy platform token`,
  ops: `${PLATFORM_OPS_PCT_OF_POOL}% of original pool (${DEV_FEE_OPS_SHARE_PCT}% of fee) → ops / infra / growth`,
  burn: 'Purchased tokens → burn() → supply permanently reduced',
  burnNote:
    'Buy and burn run inside the payout cycle itself, after winners are paid — a failure there returns the share to ops rather than stranding it. Only confirmed burns are counted in the public totals.',
} as const

export const FLYWHEEL_INTRO =
  'Every SaaS listing pays a flat 12% protocol fee in ETH on each payout cycle. Fees route to the TopBlast platform treasury — half funds platform-token buyback, half funds ops and growth.'

export const FLYWHEEL_STEPS = [
  'Projects list tokens for conviction rewards via self-serve TopBlast',
  FLYWHEEL_TREE.root,
  FLYWHEEL_TREE.buyback,
  FLYWHEEL_TREE.burn,
  FLYWHEEL_TREE.ops,
  'More SaaS tenants → more fee flow → stronger platform token',
] as const
