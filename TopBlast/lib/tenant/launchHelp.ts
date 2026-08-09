import {
  DEFAULT_PAYOUT_INTERVAL_MINUTES,
  formatPayoutInterval,
  formatPayoutIntervalOptionsList,
} from '@/lib/platform/payoutIntervals'
import {
  DEFAULT_MIN_TOKEN_HOLDING,
  formatMinTokenHolding,
} from '@/lib/platform/minTokenHolding'
import {
  DEFAULT_WINNER_COUNT,
  minPoolForWinnerCount,
  WINNER_COUNT_OPTIONS,
} from '@/lib/payout/winnerCount'
import { formatWinnerSharePercents } from '@/lib/payout/shares'

const PAYOUT_OPTIONS = formatPayoutIntervalOptionsList()
const DEFAULT_PAYOUT_LABEL = formatPayoutInterval(DEFAULT_PAYOUT_INTERVAL_MINUTES)
const DEFAULT_MIN_BALANCE_LABEL = formatMinTokenHolding(DEFAULT_MIN_TOKEN_HOLDING)

/** Keys explained for launch / help UI (client-safe). */
export const LAUNCH_KEY_HELP = {
  payoutWalletPrivateKey: {
    title: 'Payout wallet private key (dedicated creator wallet only)',
    body:
      'Use a dedicated Solana payout wallet — not your personal trading wallet or seed phrase. TopBlast never asks token holders for private keys; only listing creators submit this once when they list. The key is encrypted at rest and only decrypted server-side to run your payout cycles.',
  },
  payoutInterval: {
    title: 'Payout frequency',
    body: `How often winners are paid after the timer starts. Choose when you list — ${PAYOUT_OPTIONS}. Default is ${DEFAULT_PAYOUT_LABEL}. Cannot be changed after listing creation.`,
  },
  minTokenHolding: {
    title: 'Minimum token balance',
    body: `Holders need at least this many tokens (raw units, not USD) to qualify for rewards. Default is ${DEFAULT_MIN_BALANCE_LABEL}. Set higher to filter dust wallets; lower for micro-cap tokens. Locked when you list.`,
  },
  winnerCount: {
    title: 'Winners per cycle',
    body: `How many eligible losers get paid each cycle (3–10). Default is ${DEFAULT_WINNER_COUNT}. More winners means smaller shares for everyone — biggest loser always gets the most. Locked when you list.`,
  },
  tenantEncryptionKey: {
    title: 'Key encryption (TopBlast operators only)',
    body:
      'TopBlast encrypts your payout private key before storing it. Keys are never saved in plain text and are only decrypted when executing your listing\'s payouts.',
  },
} as const

/** What happens after a user submits a listing (client-safe). */
export const LAUNCH_FLOW = {
  title: 'What happens when you list',
  steps: [
    {
      title: 'Your listing goes live',
      body: 'TopBlast stores your mint, ticker, payout schedule, and encrypted payout key. Your session gets its own URL and runs independently from every other listing.',
    },
    {
      title: 'We index your token on-chain',
      body: 'Holder balances and buy history are pulled via Helius. Rankings usually appear within a few minutes of listing.',
    },
    {
      title: 'Cycles run automatically',
      body: `Winners are paid on the interval you selected (${PAYOUT_OPTIONS}). The timer runs automatically when someone qualifies — payouts send when it hits zero.`,
    },
    {
      title: 'You stay in control',
      body: 'Session status on your leaderboard shows funding, indexing, eligibility, and payout blockers with clear next steps — no support ticket required.',
    },
  ],
} as const

/** Checklist every launcher should follow (client-safe). */
export const HOW_TO_RUN_LISTING = {
  title: 'What you need to run a listing',
  steps: [
    {
      n: 1,
      title: 'List with a valid base58 payout private key',
      body: 'Use the creator-rewards wallet for your token. TopBlast encrypts it at rest and only decrypts it to execute your payout cycles.',
    },
    {
      n: 2,
      title: 'Fund that wallet\'s public address with SOL',
      body: 'Winner payouts come from this wallet each cycle (~99% of balance). If it is empty, cycles cannot pay out — your session status will show the deposit address.',
    },
    {
      n: 3,
      title: 'Set payout frequency, winners, and minimum balance',
      body: `Pick a cycle length (${PAYOUT_OPTIONS}), winners per cycle (3–10, default ${DEFAULT_WINNER_COUNT}), and minimum token balance (default ${DEFAULT_MIN_BALANCE_LABEL} raw tokens). All locked when you list.`,
    },
    {
      n: 4,
      title: 'Wait for holders and eligible losers',
      body: 'Holders must buy and hold your token. Eligible losers are underwater vs their average buy price and meet all hold/balance/loss rules (shown below).',
    },
    {
      n: 5,
      title: 'Timer starts when someone qualifies',
      body: 'The payout timer begins when the first eligible holder appears. Each listing is processed independently; other tokens on TopBlast do not affect yours.',
    },
  ],
} as const

export { PAYOUT_OPTIONS, DEFAULT_PAYOUT_LABEL }

export function formatWinnerCountPreview(count: number): string {
  const minPool = minPoolForWinnerCount(count)
  return `${count} winners · ${formatWinnerSharePercents(count)} split · $${minPool.toFixed(2)} min pool`
}
