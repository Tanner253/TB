import {
  DEFAULT_PAYOUT_INTERVAL_MINUTES,
  formatPayoutInterval,
  formatPayoutIntervalOptionsList,
} from '@/lib/platform/payoutIntervals'

const PAYOUT_OPTIONS = formatPayoutIntervalOptionsList()
const DEFAULT_PAYOUT_LABEL = formatPayoutInterval(DEFAULT_PAYOUT_INTERVAL_MINUTES)

/** Keys explained for launch / help UI (client-safe). */
export const LAUNCH_KEY_HELP = {
  payoutWalletPrivateKey: {
    title: 'Payout wallet private key (creator rewards wallet)',
    body:
      'Your Solana keypair in base58 — usually the wallet that receives creator fees on Pump.fun, Raydium, etc. TopBlast uses it each cycle to send SOL rewards to eligible losers. Fund this wallet with SOL; it is not the TopBlast platform fee wallet.',
  },
  payoutInterval: {
    title: 'Payout frequency',
    body: `How often winners are paid after the timer starts. Choose at launch — ${PAYOUT_OPTIONS}. Default is ${DEFAULT_PAYOUT_LABEL}. Cannot be changed after listing creation.`,
  },
  tenantEncryptionKey: {
    title: 'Key encryption (TopBlast operators only)',
    body:
      'TopBlast encrypts your payout private key before storing it. Keys are never saved in plain text and are only decrypted when executing your listing\'s payouts.',
  },
} as const

/** What happens after a user submits a listing (client-safe). */
export const LAUNCH_FLOW = {
  title: 'What happens when you launch',
  steps: [
    {
      title: 'Your listing goes live',
      body: 'TopBlast stores your mint, ticker, payout schedule, and encrypted payout key. Your session gets its own URL and runs independently from every other listing.',
    },
    {
      title: 'We index your token on-chain',
      body: 'Holder balances and buy history are pulled via Helius. Rankings usually appear within a few minutes of launch.',
    },
    {
      title: 'Cycles run automatically',
      body: `Winners are paid on the interval you selected (${PAYOUT_OPTIONS}). Platform cron keeps timers in sync — no manual cycle start.`,
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
      title: 'Launch with a valid base58 payout private key',
      body: 'Use the creator-rewards wallet for your token. TopBlast encrypts it at rest and only decrypts it to execute your payout cycles.',
    },
    {
      n: 2,
      title: 'Fund that wallet\'s public address with SOL',
      body: 'Winner payouts come from this wallet each cycle (~99% of balance). If it is empty, cycles cannot pay out — your session status will show the deposit address.',
    },
    {
      n: 3,
      title: 'Choose your payout frequency',
      body: `Pick a cycle length in the launch form: ${PAYOUT_OPTIONS}. Default is ${DEFAULT_PAYOUT_LABEL}. Shorter cycles = more engagement; longer cycles = fewer, larger moments.`,
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
