export const APP_URL = 'https://topblasted.fun'

export const WHITEPAPER_URL = 'https://whitepaper.topblasted.fun'

export const LINKS = {
  twitter: 'https://x.com/oSKNYo_dev',
  github: 'https://github.com/Tanner253/TB',
  app: APP_URL,
  whitepaper: WHITEPAPER_URL,
  launch: `${APP_URL}/launch`,
  catalog: `${APP_URL}/catalog`,
  platformLeaderboard: `${APP_URL}/leaderboard`,
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

export const CHART_VOLUME = {
  title: 'Built-in chart volume',
  tagline: 'Every payout cycle buys your token, then airdrops winners',
  intro:
    'When you launch on TopBlast, winner rewards route through your session token. Each cycle executes a Jupiter buy on your chart, then airdrops purchased tokens to the top 3 eligible losers. Lifetime SOL spent on buys is tracked as Gen volume in the catalog.',
  steps: [
    { title: 'Fund the pool', body: 'Creator-fee SOL in your listing payout wallet — you control the budget.' },
    { title: 'On-chart buyback', body: 'Pool SOL swaps into your session token via Jupiter — real chart volume.' },
    { title: 'Token airdrops', body: 'Purchased tokens split 60/25/15 to top eligible losers — wallet-to-wallet, no claim.' },
  ],
  genVolume:
    'Gen volume is the cumulative SOL the protocol has market-bought into your mint across all payout cycles. It appears on catalog cards and listing stats — proof of recurring buy pressure, not rebates or manual dev buys.',
} as const

/** Sticky section strip — shown on desktop & mobile (horizontal scroll) */
export const DOC_SECTIONS = [
  { href: '#for-creators', label: 'Overview' },
  { href: '#chart-volume', label: 'Chart volume' },
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
      { href: '#chart-volume', label: 'Chart volume' },
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

/** Heroic footer rally line — keep in sync with TopBlast lib/marketing/brand.ts */
export const MISSION_HERO = 'Clean the Solana trenches.'

export const MISSION_LEAD =
  'TopBlast turns creator fees into on-chart buybacks and airdrops for holders with conviction.'

export const MISSION_BODY =
  'PvE reward mechanics in a PvP market — incentivize holding, reduce sell pressure, and give every listed token pro-trader chart utility and room to run higher.'
