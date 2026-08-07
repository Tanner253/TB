import mongoose, { Schema, Document, Model } from 'mongoose'

// Tenant registry (SaaS)
export type TenantStatus = 'pending' | 'active' | 'paused'

export interface ITenant extends Document {
  slug: string
  mint: string
  symbol: string
  decimals: number
  encryptedPayoutKey: string
  payoutWalletAddress: string
  devWalletAddress: string
  status: TenantStatus
  payoutIntervalMinutes: number
  minTokenHolding: number
  minLossThresholdPct: number
  minPoolSol: number
  executePayouts: boolean
  createdAt: Date
  updatedAt: Date
}

const TenantSchema = new Schema<ITenant>({
  slug: { type: String, required: true, unique: true, index: true },
  mint: { type: String, required: true, unique: true, index: true },
  symbol: { type: String, required: true },
  decimals: { type: Number, default: 6 },
  encryptedPayoutKey: { type: String, required: true },
  payoutWalletAddress: { type: String, required: true },
  devWalletAddress: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'active', 'paused'], default: 'active' },
  payoutIntervalMinutes: { type: Number, default: 15 },
  minTokenHolding: { type: Number, default: 1000 },
  minLossThresholdPct: { type: Number, default: 10 },
  minPoolSol: { type: Number, default: 0.001 },
  executePayouts: { type: Boolean, default: true },
}, { timestamps: true })

// Holder Interface
export interface IHolder extends Document {
  tenantSlug: string
  wallet: string
  balance: number
  vwap: number | null
  totalBought: number
  totalCostBasis: number
  firstBuyAt: Date | null
  lastActivityAt: Date | null
  lastTransferOutAt: Date | null
  lastWinCycle: number | null
  isEligible: boolean
  ineligibleReason: string | null
  createdAt: Date
  updatedAt: Date
}

const HolderSchema = new Schema<IHolder>({
  tenantSlug: { type: String, default: '_legacy', index: true },
  wallet: { type: String, required: true, index: true },
  balance: { type: Number, default: 0 },
  vwap: { type: Number, default: null },
  totalBought: { type: Number, default: 0 },
  totalCostBasis: { type: Number, default: 0 },
  firstBuyAt: { type: Date, default: null },
  lastActivityAt: { type: Date, default: null },
  lastTransferOutAt: { type: Date, default: null },
  lastWinCycle: { type: Number, default: null },
  isEligible: { type: Boolean, default: false },
  ineligibleReason: { type: String, default: null },
}, { timestamps: true })
HolderSchema.index({ tenantSlug: 1, wallet: 1 }, { unique: true })

// Snapshot Interface
export interface ISnapshot extends Document {
  tenantSlug: string
  cycle: number
  timestamp: Date
  tokenPrice: number
  poolBalance: number
  totalHolders: number
  eligibleCount: number
  rankings: any[]
  createdAt: Date
}

const SnapshotSchema = new Schema<ISnapshot>({
  tenantSlug: { type: String, default: '_legacy', index: true },
  cycle: { type: Number, required: true, index: true },
  timestamp: { type: Date, required: true },
  tokenPrice: { type: Number, required: true },
  poolBalance: { type: Number, required: true },
  totalHolders: { type: Number, required: true },
  eligibleCount: { type: Number, required: true },
  rankings: { type: [Schema.Types.Mixed], default: [] },
}, { timestamps: true })
SnapshotSchema.index({ tenantSlug: 1, cycle: 1 }, { unique: true })

// Payout Interface
export interface IPayout extends Document {
  tenantSlug: string
  cycle: number
  rank: number
  wallet: string
  amount: number
  amountTokens: number
  drawdownPct: number
  lossUsd: number
  txHash: string | null
  status: string
  errorMessage: string | null
  createdAt: Date
}

const PayoutSchema = new Schema<IPayout>({
  tenantSlug: { type: String, default: '_legacy', index: true },
  cycle: { type: Number, required: true, index: true },
  rank: { type: Number, required: true },
  wallet: { type: String, required: true },
  amount: { type: Number, required: true },
  amountTokens: { type: Number, required: true },
  drawdownPct: { type: Number, required: true },
  lossUsd: { type: Number, required: true },
  txHash: { type: String, default: null },
  status: { type: String, default: 'pending' },
  errorMessage: { type: String, default: null },
}, { timestamps: true })

// Disqualification Interface
export interface IDisqualification extends Document {
  tenantSlug: string
  wallet: string
  reason: string
  expiresAt: Date
  createdAt: Date
}

const DisqualificationSchema = new Schema<IDisqualification>({
  tenantSlug: { type: String, default: '_legacy', index: true },
  wallet: { type: String, required: true, index: true },
  reason: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true })

// Pool Balance Interface (per tenant)
export interface IPoolBalance extends Document {
  tenantSlug: string
  balance: number
  balanceTokens: number
  totalDistributed: number
  totalCycles: number
  lastDepositAt: Date | null
  lastPayoutAt: Date | null
  updatedAt: Date
}

const PoolBalanceSchema = new Schema<IPoolBalance>({
  tenantSlug: { type: String, default: '_legacy', unique: true, index: true },
  balance: { type: Number, default: 0 },
  balanceTokens: { type: Number, default: 0 },
  totalDistributed: { type: Number, default: 0 },
  totalCycles: { type: Number, default: 0 },
  lastDepositAt: { type: Date, default: null },
  lastPayoutAt: { type: Date, default: null },
}, { timestamps: true })

// Price Cache Interface
export interface IPriceCache extends Document {
  timestamp: Date
  price: number
  source: string
  createdAt: Date
}

const PriceCacheSchema = new Schema<IPriceCache>({
  timestamp: { type: Date, required: true },
  price: { type: Number, required: true },
  source: { type: String, default: 'jupiter' },
}, { timestamps: true })

// Timer State Interface (singleton - stores payout timer state for serverless consistency)
export interface ITimerState extends Document {
  key: string // Always 'payout_timer' - singleton pattern
  tokenMint: string
  timerStatus: 'waiting' | 'active'
  lastPayoutTime: Date | null
  currentCycle: number
  failedAttempts: number
  isPayoutInProgress: boolean
  lockAcquiredAt: Date | null // When the current lock was acquired
  lockCycle: number | null // Which cycle holds the lock
  accruedDevFeeEth: number // Rolled up when single-cycle dev fee < min transfer
  updatedAt: Date
}

const TimerStateSchema = new Schema<ITimerState>({
  key: { type: String, required: true, unique: true, default: 'payout_timer' },
  tokenMint: { type: String, default: '' },
  timerStatus: { type: String, enum: ['waiting', 'active'], default: 'waiting' },
  lastPayoutTime: { type: Date, default: null },
  currentCycle: { type: Number, default: 0 },
  failedAttempts: { type: Number, default: 0 },
  isPayoutInProgress: { type: Boolean, default: false },
  lockAcquiredAt: { type: Date, default: null },
  lockCycle: { type: Number, default: null },
  accruedDevFeeEth: { type: Number, default: 0 },
}, { timestamps: true })

// Current Rankings Interface (singleton - stores current rankings for serverless consistency)
// This ensures all Vercel instances show the same rankings
export interface ICurrentRankings extends Document {
  key: string // Always 'current_rankings' - singleton pattern
  tokenMint: string
  rankings: Array<{
    wallet: string
    balance: number
    vwap: number
    drawdownPct: number
    lossUsd: number
    isEligible: boolean
    ineligibleReason: string | null
    firstBuyAt?: Date | string | null
    hasSold?: boolean
    hasTransferredOut?: boolean
    totalTokensBought?: number
    lastWinCycle?: number | null
    isContract?: boolean
  }>
  totalHolders: number
  eligibleCount: number
  holdersWithVwap: number
  tokenPrice: number
  lastCalculated: Date
  updatedAt: Date
}

const CurrentRankingsSchema = new Schema<ICurrentRankings>({
  key: { type: String, required: true, unique: true, default: 'current_rankings' },
  tokenMint: { type: String, default: '' },
  rankings: { type: [Schema.Types.Mixed], default: [] },
  totalHolders: { type: Number, default: 0 },
  eligibleCount: { type: Number, default: 0 },
  holdersWithVwap: { type: Number, default: 0 },
  tokenPrice: { type: Number, default: 0 },
  lastCalculated: { type: Date, default: Date.now },
}, { timestamps: true })

// Export models (check if already registered to avoid OverwriteModelError)
export const Tenant: Model<ITenant> = mongoose.models.Tenant || mongoose.model<ITenant>('Tenant', TenantSchema)
export const Holder: Model<IHolder> = mongoose.models.Holder || mongoose.model<IHolder>('Holder', HolderSchema)
export const Snapshot: Model<ISnapshot> = mongoose.models.Snapshot || mongoose.model<ISnapshot>('Snapshot', SnapshotSchema)
export const Payout: Model<IPayout> = mongoose.models.Payout || mongoose.model<IPayout>('Payout', PayoutSchema)
export const Disqualification: Model<IDisqualification> = mongoose.models.Disqualification || mongoose.model<IDisqualification>('Disqualification', DisqualificationSchema)
export const PoolBalance: Model<IPoolBalance> = mongoose.models.PoolBalance || mongoose.model<IPoolBalance>('PoolBalance', PoolBalanceSchema)
export const PriceCache: Model<IPriceCache> = mongoose.models.PriceCache || mongoose.model<IPriceCache>('PriceCache', PriceCacheSchema)
export const TimerState: Model<ITimerState> = mongoose.models.TimerState || mongoose.model<ITimerState>('TimerState', TimerStateSchema)
export const CurrentRankings: Model<ICurrentRankings> = mongoose.models.CurrentRankings || mongoose.model<ICurrentRankings>('CurrentRankings', CurrentRankingsSchema)

