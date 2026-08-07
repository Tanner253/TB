/** Protocol-wide flywheel economics (client-safe constants) */

export const DEV_FEE_PCT = 12

/** Share of each tenant's dev fee routed to platform-token buyback */
export const DEV_FEE_BUYBACK_SHARE_PCT = 50

/** Effective buyback rate: 50% of 12% = 6% of each payout pool */
export const PLATFORM_BUYBACK_PCT_OF_POOL =
  DEV_FEE_PCT * (DEV_FEE_BUYBACK_SHARE_PCT / 100)

/** Remaining dev fee after buyback allocation (operations, infra, growth) */
export const DEV_FEE_OPS_SHARE_PCT = 100 - DEV_FEE_BUYBACK_SHARE_PCT

export const FLYWHEEL_STEPS = [
  'Projects launch loss-mining via self-serve TopBlast',
  'Every payout cycle collects a 12% dev fee in SOL',
  '50% of dev fees (6% of pool) buy the platform token',
  'More SaaS tenants → more buy pressure → stronger platform token',
] as const
