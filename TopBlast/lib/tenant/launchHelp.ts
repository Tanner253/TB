/** Keys explained for launch / help UI (client-safe). */
export const LAUNCH_KEY_HELP = {
  payoutWalletPrivateKey: {
    title: 'Payout wallet private key (creator rewards wallet)',
    body:
      'Your Solana keypair in base58 — usually the wallet that receives creator fees on Pump.fun, Raydium, etc. TopBlast uses it each cycle to send SOL rewards to eligible losers. Fund this wallet with SOL; it is not the TopBlast platform fee wallet.',
  },
  tenantEncryptionKey: {
    title: 'TENANT_ENCRYPTION_KEY (platform server only)',
    body:
      'Set by TopBlast operators in server env — not by launchers. It encrypts your payout private key before storage in the database so keys are not saved in plain text. It is not used to send transactions; your payout key is decrypted only when executing your listing\'s payouts.',
  },
} as const

/** What happens after a user submits a listing (client-safe). */
export const LAUNCH_FLOW = {
  title: 'What happens when you launch',
  steps: [
    {
      title: 'Your listing goes live',
      body: 'TopBlast stores your mint, ticker, and encrypted payout key. Your session gets its own URL and runs independently from every other listing.',
    },
    {
      title: 'We index your token on-chain',
      body: 'Holder balances and buy history are pulled via Helius. Rankings usually appear within a few minutes of launch.',
    },
    {
      title: 'Cycles run automatically',
      body: 'Every ~15 minutes our cron checks your listing: eligible losers are ranked, and SOL is paid from your funded wallet when the timer completes. No manual start.',
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
      title: 'Wait for holders and eligible losers',
      body: 'Holders must buy and hold your token. Eligible losers are underwater vs their average buy price and meet all hold/balance/loss rules (shown below).',
    },
    {
      n: 4,
      title: 'Cron runs every ~15 minutes — no manual cycle start',
      body: 'The payout timer starts when the first eligible holder appears. Each listing is processed independently; other tokens on TopBlast do not affect yours.',
    },
  ],
} as const
