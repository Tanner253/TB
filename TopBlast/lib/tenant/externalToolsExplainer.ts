/** Copy explaining why third-party holder tools may disagree with TopBlast eligibility. */

export const EXTERNAL_TOOLS_EXPLAINER = {
  title: 'Why gmgn / pump.fun PnL ≠ TopBlast eligibility',
  summary:
    'Explorer UIs estimate PnL for display. TopBlast only pays wallets that pass every on-chain rule below — small differences are normal.',
  points: [
    {
      label: 'On-chain buys only',
      body: 'Loss is measured from verified swap buys (VWAP via Helius), not wallet transfers or airdrops. Tokens received another way show red on gmgn but have no buy history here.',
    },
    {
      label: 'Live price source',
      body: 'We mark drawdown from DexScreener’s active pair. gmgn and pump.fun may use a slightly different price or timing, so % loss and USD loss can differ by a few basis points.',
    },
    {
      label: 'All rules must pass',
      body: 'Underwater on a chart is not enough. Holders still need minimum balance, hold time from first buy, no sells/transfers out, pool-relative loss threshold, and must not be LP or protocol wallets.',
    },
    {
      label: 'Per-row reason',
      body: 'When indexed, each wallet shows a specific status (e.g. “Hold duration not met”, “In profit”, “Received via transfer”). That reason is authoritative for payouts.',
    },
  ],
} as const
