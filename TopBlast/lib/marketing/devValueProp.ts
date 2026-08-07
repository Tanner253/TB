/** Shared marketing copy — Solana dev / launcher narrative. */

import { formatPayoutIntervalOptionsList } from '@/lib/platform/payoutIntervals'

const PAYOUT_SCHEDULE_OPTIONS = formatPayoutIntervalOptionsList()

export const DEV_HERO = {
  headline: 'Reward bullish holders — not sellers',
  subhead:
    'TopBlast turns creator-fee SOL into loss-mining rewards for holders who bought the top and stayed in. No cashback sell pressure. No “dev tax” FUD.',
  cta: 'Launch your token',
} as const

export const ALTERNATIVES_COMPARISON = [
  {
    id: 'cashback',
    name: 'Cashback / rebates',
    holderBehavior: 'Buy → claim → sell',
    chartEffect: 'Instant sell pressure',
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
    name: 'TopBlast loss-mining',
    holderBehavior: 'Buy, hold through drawdown, compete for SOL',
    chartEffect: 'Rewards conviction — winners hold to qualify',
    devOptics: 'Community rewards funded from your creator wallet',
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
      body: 'Top 3 eligible losers by drawdown % (most underwater first). Not biggest wallet — must pass every rule.',
    },
    {
      title: 'Timer',
      body: `Choose payout frequency at launch (${PAYOUT_SCHEDULE_OPTIONS}). Cycles start automatically when the first eligible holder appears. Cron keeps timers in sync — no manual start.`,
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
    title: 'Incentivize holding, not exiting',
    body: 'Holders compete while underwater — they do not farm a rebate and immediately sell.',
  },
  {
    title: 'You fund the program',
    body: 'Payouts come from your creator-rewards wallet. You choose how much SOL to allocate.',
  },
  {
    title: 'Hands-off operations',
    body: `Rankings, eligibility, timer, and SOL payouts run on autopilot per listing — on the schedule you pick (${PAYOUT_SCHEDULE_OPTIONS}).`,
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
  twitter: 'https://x.com/topblasteth',
  whitepaper: WHITEPAPER_URL,
} as const
