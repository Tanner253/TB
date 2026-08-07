export const APP_URL = 'https://www.topblastweb3.xyz'

export const LINKS = {
  twitter: 'https://x.com/topblasteth',
  app: APP_URL,
  launch: `${APP_URL}/launch`,
  catalog: `${APP_URL}/catalog`,
  platformLeaderboard: `${APP_URL}/topblast/leaderboard`,
} as const

/** Default SaaS launch form value — must match TopBlast lib/platform/minTokenHolding.ts */
export const DEFAULT_MIN_TOKEN_HOLDING = 1000

export const DEFAULT_MIN_TOKEN_HOLDING_LABEL = DEFAULT_MIN_TOKEN_HOLDING.toLocaleString('en-US')

export const PAYOUT = {
  dev: 12,
  first: 60,
  second: 25,
  third: 15,
  community: 88,
} as const

export const FLYWHEEL = {
  devFeePct: 12,
  devFeeBuybackShare: 50,
  buybackPctOfPool: 6,
  opsPctOfPool: 6,
  opsShareOfDevFee: 50,
  burnStatus: 'planned' as const,
  intro:
    'Every SaaS listing pays a flat 12% protocol fee in SOL on each payout cycle. Fees route to the TopBlast platform treasury — half funds platform-token buyback, half funds ops and growth.',
  tree: {
    root: 'Every tenant cycle → 12% SOL to the platform treasury',
    buyback: '6% of original pool (50% of fee) → market-buy platform token',
    ops: '6% of original pool (50% of fee) → ops / infra / growth',
    burn: 'Purchased tokens → burn address / incinerator',
    burnNote:
      'Buyback + burn automation is on the roadmap. Dev fees accrue to the platform treasury today; market buys are executed manually until the bot ships.',
  },
} as const

/** Payout cycle lengths selectable at /launch (must match TopBlast app). */
export const PAYOUT_INTERVAL_OPTIONS = [
  '15 minutes',
  '30 minutes',
  '1 hour',
  '2 hours',
  '4 hours',
  '6 hours',
] as const

export const PAYOUT_INTERVAL_OPTIONS_TEXT = `${PAYOUT_INTERVAL_OPTIONS.slice(0, -1).join(', ')}, or ${PAYOUT_INTERVAL_OPTIONS[PAYOUT_INTERVAL_OPTIONS.length - 1]}`

/** Compact range for hero stat cards — must match TopBlast PAYOUT_INTERVAL_RANGE_COMPACT */
export const PAYOUT_INTERVAL_HERO_RANGE = '15m–6h'

/** Sticky section strip — shown on desktop & mobile (horizontal scroll) */
export const DOC_SECTIONS = [
  { href: '#for-creators', label: 'Overview' },
  { href: '#protocol', label: 'Protocol' },
  { href: '#dynamic-pot', label: 'Dynamic pot' },
  { href: '#eligibility', label: 'Eligibility' },
  { href: '#saas', label: 'SaaS' },
  { href: '#security', label: 'Security' },
  { href: '#token', label: 'Token' },
  { href: '#technical', label: 'Architecture' },
  { href: '#roadmap', label: 'Roadmap' },
] as const

/** Mobile menu only — grouped for scanability */
export const NAV_MENU_GROUPS = [
  {
    label: 'Product',
    items: [
      { href: '#for-creators', label: 'Overview' },
      { href: '#protocol', label: 'Protocol' },
    ],
  },
  {
    label: 'Mechanics',
    items: [
      { href: '#dynamic-pot', label: 'Dynamic pot' },
      { href: '#eligibility', label: 'Eligibility' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { href: '#saas', label: 'SaaS' },
      { href: '#security', label: 'Security' },
      { href: '#token', label: 'Token' },
    ],
  },
  {
    label: 'Project',
    items: [
      { href: '#technical', label: 'Architecture' },
      { href: '#roadmap', label: 'Roadmap' },
    ],
  },
] as const
