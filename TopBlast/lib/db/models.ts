import mongoose, { Schema, Document, Model } from 'mongoose'

// Holder Interface
export interface IHolder extends Document {
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
  wallet: { type: String, required: true, unique: true, index: true },
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

// Snapshot Interface
export interface ISnapshot extends Document {
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
  cycle: { type: Number, required: true, unique: true, index: true },
  timestamp: { type: Date, required: true },
  tokenPrice: { type: Number, required: true },
  poolBalance: { type: Number, required: true },
  totalHolders: { type: Number, required: true },
  eligibleCount: { type: Number, required: true },
  rankings: { type: [Schema.Types.Mixed], default: [] },
}, { timestamps: true })

// Payout Interface
export interface IPayout extends Document {
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
  wallet: string
  reason: string
  expiresAt: Date
  createdAt: Date
}

const DisqualificationSchema = new Schema<IDisqualification>({
  wallet: { type: String, required: true, index: true },
  reason: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true })

// Pool Balance Interface (singleton)
export interface IPoolBalance extends Document {
  balance: number
  balanceTokens: number
  totalDistributed: number
  totalCycles: number
  lastDepositAt: Date | null
  lastPayoutAt: Date | null
  updatedAt: Date
}

const PoolBalanceSchema = new Schema<IPoolBalance>({
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

// Export models (check if already registered to avoid OverwriteModelError)
export const Holder: Model<IHolder> = mongoose.models.Holder || mongoose.model<IHolder>('Holder', HolderSchema)
export const Snapshot: Model<ISnapshot> = mongoose.models.Snapshot || mongoose.model<ISnapshot>('Snapshot', SnapshotSchema)
export const Payout: Model<IPayout> = mongoose.models.Payout || mongoose.model<IPayout>('Payout', PayoutSchema)
export const Disqualification: Model<IDisqualification> = mongoose.models.Disqualification || mongoose.model<IDisqualification>('Disqualification', DisqualificationSchema)
export const PoolBalance: Model<IPoolBalance> = mongoose.models.PoolBalance || mongoose.model<IPoolBalance>('PoolBalance', PoolBalanceSchema)
export const PriceCache: Model<IPriceCache> = mongoose.models.PriceCache || mongoose.model<IPriceCache>('PriceCache', PriceCacheSchema)

