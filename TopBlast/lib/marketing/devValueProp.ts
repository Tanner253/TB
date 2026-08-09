/** Shared marketing copy — Solana dev / launcher narrative. */

import { formatPayoutIntervalOptionsList } from '@/lib/platform/payoutIntervals'

const PAYOUT_SCHEDULE_OPTIONS = formatPayoutIntervalOptionsList()

export const DEV_HERO = {
  headline: 'Creator fees become on-chart volume',
  subhead:
    'Fund a payout wallet with creator-fee SOL. Each cycle the protocol buys your session token via Jupiter, then airdrops it to eligible underwater holders (3–10 winners, set at launch).',
  cta: 'List your token',
} as const

/** Homepage — cashback contrast (above the fold). */
export const HOME_VS_CASHBACK = {
  title: 'Skip the cashback bot',
  subtitle: 'Same creator-fee budget. Different outcome for your chart and your holders.',
  cashback: {
    label: 'Cashback / rebate bots',
    points: [
      'Pay SOL rebates for volume traded on chart — often sell-side',
      'Rewards trading activity, not underwater holders',
      'Mercenary volume — no incentive to hold through drawdown',
    ],
  },
  topblast: {
    label: 'TopBlast conviction rewards',
    points: [
      'Rewards holders with conviction who stay underwater',
      'Pool SOL market-buys your token via Jupiter each cycle',
      'Winners receive your token — tracked as Gen volume in the catalog',
    ],
  },
} as const

/** Homepage — how to launch (simplified from launchHelp). */
export const HOME_LAUNCH_STEPS = [
  {
    title: 'Submit your token',
    body: 'Mint, ticker, payout wallet key, cycle length, and min balance — all on the list page.',
    href: '/launch',
  },
  {
    title: 'Fund the payout wallet',
    body: 'Send creator-fee SOL to the wallet you registered. ~99% of the balance is used each cycle.',
    href: '/launch',
  },
  {
    title: 'Holders get indexed',
    body: 'Helius tracks balances and buy prices. Rankings appear on your listing within minutes.',
  },
  {
    title: 'Cycles run on autopilot',
    body: 'When eligible losers exist, the timer counts down, buys your token, and airdrops winners — no manual start.',
  },
] as const

/** How session listings generate on-chart volume for launchers. */
export const CHART_VOLUME_ENGINE = {
  title: 'Built-in chart volume',
  tagline: 'Every payout cycle buys your token, then airdrops winners',
  intro:
    'When you list on TopBlast, your payout wallet doesn’t just send SOL — it routes winner rewards through your session token. That means recurring Jupiter buys on your chart plus token airdrops to the top eligible losers.',
  steps: [
    {
      title: 'Fund the pool',
      body: 'Creator-fee SOL sits in your listing’s payout wallet — you control the budget.',
    },
    {
      title: 'On-chart buyback',
      body: 'Each cycle, the protocol swaps pool SOL into your session token via Jupiter. Buys show as real chart volume.',
    },
    {
      title: 'Token airdrops',
      body: 'Purchased tokens split by rank (biggest loser gets most) and airdrop to eligible losers — no claim button, wallet-to-wallet.',
    },
  ],
  stats: [
    { label: 'Buy pressure', value: 'Every cycle', hint: 'Jupiter route into your mint' },
    { label: 'Distribution', value: '3–10 winners', hint: 'Set when you list' },
    { label: 'Tracking', value: 'Gen volume', hint: 'Lifetime SOL bought on-chart' },
  ],
  footer:
    'Unlike cashback bots that reward traded volume (often sells), TopBlast rewards underwater holders: winners must hold through drawdown to qualify — and they receive your token from on-chart buys, not exit liquidity.',
} as const

/** Homepage “How it works” — dedicated chart volume tab. */
export const HOME_CHART_VOLUME = {
  eyebrow: 'Your listing, your chart',
  title: 'Every cycle, pool SOL market-buys your token',
  lead:
    'List on TopBlast and fund a payout wallet with creator-fee SOL. On each payout cycle, the protocol swaps ~88% of the pool into your session token via Jupiter — a real market buy on your active pair. Traders see it on your chart; TopBlast tracks the running total as Gen volume.',
  flow: [
    {
      title: 'You fund the pool',
      body: 'Creator-fee SOL in the payout wallet you register when listing.',
    },
    {
      title: 'Cycle triggers',
      body: 'When eligible underwater holders exist, the timer runs and the cycle executes.',
    },
    {
      title: 'Jupiter buys your mint',
      body: '~88% of pool SOL swaps into your session token on the open market — on-chart buy volume.',
    },
    {
      title: 'Winners airdropped',
      body: 'Purchased tokens split by rank to top eligible losers — wallet-to-wallet.',
    },
    {
      title: 'Gen volume updated',
      body: 'SOL spent on buys accumulates on your catalog listing — proof of protocol-driven chart volume.',
    },
  ],
  callouts: [
    {
      label: 'Your mint',
      value: 'Every buy routes to the token you listed',
    },
    {
      label: 'Your pair',
      value: 'Volume hits DexScreener / your live chart',
    },
    {
      label: 'Your budget',
      value: 'You control how much SOL funds cycles',
    },
  ],
  notThis:
    'This is not a manual dev buy you schedule yourself, and not a cashback rebate that pays traders to sell. TopBlast automates recurring Jupiter buys into your token each cycle you fund the pool.',
} as const

export const ALTERNATIVES_COMPARISON = [
  {
    id: 'cashback',
    name: 'Cashback / rebates',
    holderBehavior: 'Trade volume → claim SOL rebates',
    chartEffect: 'Sell-side volume rewarded',
    devOptics: 'Mercenary flow, weak holders',
    tone: 'negative' as const,
  },
  {
    id: 'creator',
    name: 'Creator rewards only',
    holderBehavior: 'Fees accumulate to dev wallet',
    chartEffect: 'No direct holder incentive',
    devOptics: '“Dev tax” / extraction FUD',
    tone: 'negative' as const,
  },
  {
    id: 'topblast',
    name: 'TopBlast conviction rewards',
    holderBehavior: 'Buy, hold through drawdown, compete for rewards',
    chartEffect: 'On-chart buybacks + token airdrops every cycle',
    devOptics: 'Funded volume engine — your chart, your holders',
    tone: 'positive' as const,
  },
] as const

export const DYNAMIC_POT = {
  title: 'Dynamic pot & eligibility',
  intro:
    'Every listing has its own payout wallet. The pool size and loss threshold move together — bigger pot, bigger minimum loss to qualify.',
  bullets: [
    {
      title: 'Pot size',
      body: '~99% of your funded payout wallet SOL each cycle. You control budget by topping up creator-fee SOL.',
    },
    {
      title: 'Min loss threshold',
      body: 'Eligible holders must be underwater at least 10% of the live pool (USD). Pool $500 → ~$50 min loss. Pool $5,000 → ~$500 min loss.',
    },
    {
      title: 'Winners',
      body: 'Eligible losers by drawdown % (3–10 winners per listing). Each cycle: SOL swaps into your session token on-chart, then tokens airdrop in descending rank order.',
    },
    {
      title: 'Timer',
      body: `Choose payout frequency when you list (${PAYOUT_SCHEDULE_OPTIONS}). Cycles start automatically when the first eligible holder appears. Cron keeps timers in sync — no manual start.`,
    },
  ],
  example: {
    poolUsd: 2000,
    minLossUsd: 200,
    firstPlaceUsd: 1056,
  },
} as const

export const CREATOR_BENEFITS = [
  {
    title: 'Recurring chart volume',
    body: 'Every payout cycle executes an on-chart buy of your session token before distributing to winners — tracked as Gen volume in the catalog.',
  },
  {
    title: 'Incentivize holding, not exiting',
    body: 'Holders compete while underwater — they do not farm sell-side volume for rebates.',
  },
  {
    title: 'You fund the program',
    body: 'Payouts come from your creator-rewards wallet. You choose how much SOL to allocate.',
  },
  {
    title: 'Hands-off operations',
    body: `Rankings, eligibility, timer, buybacks, and token airdrops run on autopilot per listing — on the schedule you pick (${PAYOUT_SCHEDULE_OPTIONS}).`,
  },
  {
    title: 'Built for Pump.fun → migration',
    body: 'Live price follows DexScreener across bonding curve and PumpSwap/Raydium migration automatically.',
  },
] as const

import {
  DEV_FEE_PCT,
  DEV_FEE_BUYBACK_SHARE_PCT,
  PLATFORM_BUYBACK_PCT_OF_POOL,
  PLATFORM_OPS_PCT_OF_POOL,
} from '@/lib/platform/flywheel'
import { WHITEPAPER_URL } from '@/lib/marketing/urls'

export const TRUST_FOOTER =
  `Payout keys are encrypted at rest. TopBlast only signs transactions to pay eligible winners from your wallet. ` +
  `A flat ${DEV_FEE_PCT}% protocol fee per cycle goes to the platform treasury: ` +
  `${PLATFORM_BUYBACK_PCT_OF_POOL}% of the pool (${DEV_FEE_BUYBACK_SHARE_PCT}% of the fee) market-buys the platform token for burn, ` +
  `${PLATFORM_OPS_PCT_OF_POOL}% funds ops and infra. Buyback + burn automation is on the roadmap.`

export { APP_URL, WHITEPAPER_URL, appHostname } from '@/lib/marketing/urls'

export const EXTERNAL_LINKS = {
  twitter: 'https://x.com/oSKNYo_dev',
  github: 'https://github.com/Tanner253/TB',
  whitepaper: WHITEPAPER_URL,
} as const
