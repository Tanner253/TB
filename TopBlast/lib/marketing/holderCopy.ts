/**
 * Holder-first copy — the main app speaks to the person who might buy a token.
 * The rule: the app answers "what's happening / can I get paid / who's winning".
 * Anything mechanical (VWAP, pool %, cooldowns, indexing, Gen volume math)
 * lives in the whitepaper.
 */

import { WHITEPAPER_URL } from '@/lib/marketing/urls'

export const HOLDER_HERO = {
  eyebrow: 'Live on Solana',
  headline: 'Down bad? Get blasted up.',
  subhead:
    'Every cycle, each listed token’s reward pot buys that token on the open market and airdrops it to the holders who are most underwater. Hold through the dip — the biggest losers win.',
  primaryCta: { label: 'See who’s winning', href: '/catalog' },
  secondaryCta: { label: 'List your token', href: '/launch' },
} as const

/** Three steps, zero jargon. */
export const HOW_IT_WORKS_SIMPLE = {
  title: 'How it works',
  steps: [
    {
      emoji: '🪙',
      title: 'The pot fills up',
      body: 'Creator fees drip into a reward pot for every listed token.',
    },
    {
      emoji: '📈',
      title: 'The pot buys the dip',
      body: 'On a timer, the pot market-buys the token — real green candles on the chart.',
    },
    {
      emoji: '🐳',
      title: 'The losers get paid',
      body: 'The bought tokens are airdropped straight to the most underwater holders. No claim button.',
    },
  ],
  docsNote: 'Want the mechanics — VWAP rankings, pool splits, cooldowns, Gen volume?',
  docsCta: { label: 'Read the whitepaper', href: WHITEPAPER_URL },
} as const

/** "Can I get paid?" — the four things a holder must do, in plain words. */
export const CAN_I_GET_PAID = {
  title: 'Can I get paid?',
  intro: 'You’re eligible when all four are true:',
  rules: [
    { emoji: '💰', text: 'You hold at least the minimum amount' },
    { emoji: '📉', text: 'You’re down from your average buy price' },
    { emoji: '⏱️', text: 'You’ve held for at least 15 minutes' },
    { emoji: '💎', text: 'You haven’t sold or moved tokens out' },
  ],
  footnote: 'Winners sit out one round before they can win again.',
  docsCta: { label: 'Full eligibility rules', href: `${WHITEPAPER_URL}` },
} as const

export const WHITEPAPER_CALLOUT = {
  title: 'Everything technical lives in the whitepaper',
  body: 'How drawdowns are ranked, how the pot is split, how holders are indexed, what Gen volume means — it’s all documented.',
  cta: { label: 'whitepaper.topblasted.fun', href: WHITEPAPER_URL },
} as const
