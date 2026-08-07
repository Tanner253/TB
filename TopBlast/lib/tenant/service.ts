import { Keypair, PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import connectDB from '@/lib/db'
import { Tenant, TimerState } from '@/lib/db/models'
import { encryptSecret, decryptSecret } from './crypto'
import { runWithTenant } from './context'
import type {
  CreateTenantInput,
  PublicTenantSummary,
  TenantRuntimeConfig,
  TenantStatus,
} from './types'
import { getTimerKey } from './keys'
import { decorateCatalogTenants } from '@/lib/platform/catalog'
import { requirePlatformDevWalletAddress } from '@/lib/platform/devWallet'

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/

function isLikelySolanaMint(mint: string): boolean {
  if (!mint || mint.length < 32 || mint.length > 44) return false
  if (mint.startsWith('0x')) return false
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(mint)
}

function derivePayoutAddress(privateKeyBase58: string): string {
  const decoded = bs58.decode(privateKeyBase58.trim())
  return Keypair.fromSecretKey(decoded).publicKey.toBase58()
}

function validatePrivateKey(privateKeyBase58: string): void {
  try {
    const decoded = bs58.decode(privateKeyBase58.trim())
    Keypair.fromSecretKey(decoded)
  } catch {
    throw new Error('Invalid payout wallet private key (expected base58 Solana keypair)')
  }
}

function validateMint(mint: string): void {
  try {
    // eslint-disable-next-line no-new
    new PublicKey(mint.trim())
  } catch {
    throw new Error('Invalid SPL mint address')
  }
  if (!isLikelySolanaMint(mint.trim())) {
    throw new Error('Mint must be a valid Solana base58 address')
  }
}

export function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase()
}

export function validateSlug(slug: string): string {
  const normalized = normalizeSlug(slug)
  if (!SLUG_RE.test(normalized)) {
    throw new Error('Slug must be 3–32 characters: lowercase letters, numbers, and hyphens')
  }
  if (normalized === '_legacy') {
    throw new Error('This slug is reserved')
  }
  return normalized
}

export async function listPublicTenants(): Promise<PublicTenantSummary[]> {
  await connectDB()
  const rows = await Tenant.find({ status: { $in: ['active', 'pending'] as TenantStatus[] } })
    .sort({ createdAt: -1 })
    .lean()

  const tenants = rows.map(row => ({
    slug: row.slug,
    symbol: row.symbol,
    mint: row.mint,
    status: row.status as TenantStatus,
    createdAt: row.createdAt.toISOString(),
    payoutWalletAddress: row.payoutWalletAddress,
  }))

  return decorateCatalogTenants(tenants)
}

export async function getTenantBySlug(slug: string) {
  await connectDB()
  return Tenant.findOne({ slug: normalizeSlug(slug) }).lean()
}

export async function resolveTenantRuntime(slug: string): Promise<TenantRuntimeConfig | null> {
  const doc = await getTenantBySlug(slug)
  if (!doc || doc.status === 'paused') return null

  return {
    tenantSlug: doc.slug,
    tokenMint: doc.mint,
    tokenSymbol: doc.symbol,
    tokenDecimals: doc.decimals,
    devWalletAddress: requirePlatformDevWalletAddress(),
    payoutIntervalMinutes: doc.payoutIntervalMinutes,
    minTokenHolding: doc.minTokenHolding,
    minLossThresholdPct: doc.minLossThresholdPct,
    minPoolSol: doc.minPoolSol,
    minPoolEth: doc.minPoolSol,
    executePayouts: doc.executePayouts,
    payoutWalletPrivateKey: decryptSecret(doc.encryptedPayoutKey),
  }
}

export async function createTenant(input: CreateTenantInput) {
  const slug = validateSlug(input.slug)
  validateMint(input.mint)
  validatePrivateKey(input.payoutWalletPrivateKey)

  const mint = input.mint.trim()
  const symbol = (input.symbol || 'TOKEN').trim().slice(0, 12)
  const decimals = input.decimals ?? 6
  const payoutWalletAddress = derivePayoutAddress(input.payoutWalletPrivateKey)
  const devWalletAddress = requirePlatformDevWalletAddress()
  const payoutIntervalMinutes = input.payoutIntervalMinutes ?? 15
  const minTokenHolding = input.minTokenHolding ?? 1000

  await connectDB()

  const existing = await Tenant.findOne({ $or: [{ slug }, { mint }] }).lean()
  if (existing?.slug === slug) {
    throw new Error('Slug already taken')
  }
  if (existing?.mint === mint) {
    throw new Error('This token mint is already registered')
  }

  const encryptedPayoutKey = encryptSecret(input.payoutWalletPrivateKey.trim())

  const tenant = await Tenant.create({
    slug,
    mint,
    symbol,
    decimals,
    encryptedPayoutKey,
    payoutWalletAddress,
    devWalletAddress,
    status: 'active',
    payoutIntervalMinutes,
    minTokenHolding,
    minLossThresholdPct: 10,
    minPoolSol: 0.001,
    executePayouts: true,
  })

  await TimerState.findOneAndUpdate(
    { key: `${slug}:payout_timer` },
    {
      $setOnInsert: {
        tokenMint: mint,
        timerStatus: 'waiting',
        lastPayoutTime: null,
        currentCycle: 0,
        failedAttempts: 0,
        isPayoutInProgress: false,
        lockAcquiredAt: null,
        lockCycle: null,
        accruedDevFeeEth: 0,
      },
    },
    { upsert: true }
  )

  return {
    slug: tenant.slug,
    symbol: tenant.symbol,
    mint: tenant.mint,
    status: tenant.status,
    payoutWalletAddress: tenant.payoutWalletAddress,
    appUrl: `/${tenant.slug}`,
  }
}

export async function runForTenantSlug<T>(slug: string, fn: () => Promise<T>): Promise<T> {
  const runtime = await resolveTenantRuntime(slug)
  if (!runtime) {
    throw new Error('Tenant not found')
  }
  return runWithTenant(runtime, fn)
}

export async function listActiveTenantSlugs(): Promise<string[]> {
  await connectDB()
  const rows = await Tenant.find({ status: 'active' }).select('slug').lean()
  return rows.map(r => r.slug)
}

export { getTimerKey }
