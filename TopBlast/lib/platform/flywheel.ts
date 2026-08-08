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

/** Burn destination for market-bought tokens — automated bot on roadmap */
export const FLYWHEEL_BURN_STATUS = 'planned' as const

export const FLYWHEEL_TREE = {
  root: `Every tenant cycle → ${DEV_FEE_PCT}% SOL to the platform treasury`,
  buyback: `${PLATFORM_BUYBACK_PCT_OF_POOL}% of original pool (${DEV_FEE_BUYBACK_SHARE_PCT}% of fee) → market-buy platform token`,
  ops: `${PLATFORM_OPS_PCT_OF_POOL}% of original pool (${DEV_FEE_OPS_SHARE_PCT}% of fee) → ops / infra / growth`,
  burn: 'Purchased tokens → burn address / incinerator',
  burnNote:
    'Buyback + burn automation is on the roadmap. Dev fees accrue to the platform treasury today; market buys are executed manually until the bot ships.',
} as const

export const FLYWHEEL_INTRO =
  'Every SaaS listing pays a flat 12% protocol fee in SOL on each payout cycle. Fees route to the TopBlast platform treasury — half funds platform-token buyback, half funds ops and growth.'

export const FLYWHEEL_STEPS = [
  'Projects list tokens for conviction rewards via self-serve TopBlast',
  FLYWHEEL_TREE.root,
  FLYWHEEL_TREE.buyback,
  FLYWHEEL_TREE.burn,
  FLYWHEEL_TREE.ops,
  'More SaaS tenants → more fee flow → stronger platform token',
] as const
