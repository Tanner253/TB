import mongoose, { Schema, Document, Model } from 'mongoose'

/**
 * Analytics / ecosystem-tool collections — ADDITIVE ONLY.
 *
 * Nothing in the payout engine reads these. They exist so holder behavior is
 * recorded as append-only history (the core models are current-state and get
 * overwritten on every refresh), and to back the public Rekt / loss-board
 * tools with caching. Every writer must be failure-isolated: an analytics
 * write may never break a refresh or payout.
 */

// ---------------------------------------------------------------------------
// HolderEvent — append-only log of holder behavior transitions.
// Derived by diffing consecutive CurrentRankings persists. Payout wins are
// deliberately NOT duplicated here: the Payout collection is already an
// append-only log and joins cleanly on (tenantSlug, wallet, createdAt).
// ---------------------------------------------------------------------------

export type HolderEventType =
  | 'first_seen' // wallet appeared on the tracked leaderboard
  | 'balance_increase' // bought (or received) a meaningful amount
  | 'balance_decrease' // sold (or sent) a meaningful amount, still holding
  | 'sold_out' // left the board while it had free space — position closed
  | 'dropped_out' // left the board while it was full — ambiguous (cut vs sold)
  | 'eligible_enter' // crossed into payout eligibility
  | 'eligible_exit' // fell out of payout eligibility

export type HolderEventSource = 'chain_refresh' | 'price_recompute'

export interface IHolderEvent extends Document {
  tenantSlug: string
  wallet: string
  type: HolderEventType
  /** Balance after the transition (human units). */
  balance: number
  /** Balance in the previous snapshot (null for first_seen). */
  prevBalance: number | null
  /** balance - prevBalance (0 for pure eligibility transitions). */
  delta: number
  tokenPrice: number
  drawdownPct: number | null
  isEligible: boolean
  /** 'chain_refresh' = fresh holder pull; 'price_recompute' = price-only pass. */
  source: HolderEventSource
  createdAt: Date
}

const HolderEventSchema = new Schema<IHolderEvent>(
  {
    tenantSlug: { type: String, required: true },
    wallet: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: [
        'first_seen',
        'balance_increase',
        'balance_decrease',
        'sold_out',
        'dropped_out',
        'eligible_enter',
        'eligible_exit',
      ],
    },
    balance: { type: Number, required: true },
    prevBalance: { type: Number, default: null },
    delta: { type: Number, default: 0 },
    tokenPrice: { type: Number, default: 0 },
    drawdownPct: { type: Number, default: null },
    isEligible: { type: Boolean, default: false },
    source: { type: String, enum: ['chain_refresh', 'price_recompute'], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

HolderEventSchema.index({ tenantSlug: 1, wallet: 1, createdAt: -1 })
HolderEventSchema.index({ tenantSlug: 1, type: 1, createdAt: -1 })
HolderEventSchema.index({ tenantSlug: 1, createdAt: -1 })

// ---------------------------------------------------------------------------
// RektReport — cached public wallet report card (Phase B).
// ---------------------------------------------------------------------------

export interface IRektReport extends Document {
  wallet: string
  /** Serialized report payload rendered by /rekt (schema owned by the builder). */
  report: Record<string, unknown>
  computedAt: Date
  /** Total times this report was served (viral-loop metric). */
  views: number
  createdAt: Date
  updatedAt: Date
}

const RektReportSchema = new Schema<IRektReport>(
  {
    wallet: { type: String, required: true, unique: true, index: true },
    report: { type: Schema.Types.Mixed, required: true },
    computedAt: { type: Date, required: true },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
)

// ---------------------------------------------------------------------------
// UnlistedBoard — on-demand loss leaderboard for tokens with no listing
// (Phase C). Doubles as the control-group dataset for retention analytics.
// ---------------------------------------------------------------------------

export interface IUnlistedBoard extends Document {
  mint: string
  symbol: string | null
  rankings: unknown[]
  tokenPrice: number
  /** Total holders reported on-chain (not just analyzed rows). */
  reportedHolderCount: number
  lastRefreshedAt: Date
  refreshCount: number
  /** Bumped on every page view — used to expire dead boards. */
  lastViewedAt: Date
  createdAt: Date
  updatedAt: Date
}

const UnlistedBoardSchema = new Schema<IUnlistedBoard>(
  {
    mint: { type: String, required: true, unique: true, index: true },
    symbol: { type: String, default: null },
    rankings: { type: [Schema.Types.Mixed], default: [] },
    tokenPrice: { type: Number, default: 0 },
    reportedHolderCount: { type: Number, default: 0 },
    lastRefreshedAt: { type: Date, required: true },
    refreshCount: { type: Number, default: 0 },
    lastViewedAt: { type: Date, required: true },
  },
  { timestamps: true }
)

export const HolderEvent: Model<IHolderEvent> =
  mongoose.models.HolderEvent || mongoose.model<IHolderEvent>('HolderEvent', HolderEventSchema)
export const RektReport: Model<IRektReport> =
  mongoose.models.RektReport || mongoose.model<IRektReport>('RektReport', RektReportSchema)
export const UnlistedBoard: Model<IUnlistedBoard> =
  mongoose.models.UnlistedBoard || mongoose.model<IUnlistedBoard>('UnlistedBoard', UnlistedBoardSchema)
