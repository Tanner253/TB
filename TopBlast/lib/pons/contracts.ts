import 'server-only'

/**
 * Pons v2 on Robinhood Chain — addresses, ABIs and the shared viem clients.
 *
 * Every address below was taken from docs.ponsfamily.com AND independently
 * verified against deployed bytecode (see MIGRATION-ROBINHOOD.md). Pons v1 is
 * legacy (Uniswap V3) and deliberately unsupported.
 */

import { createPublicClient, createWalletClient, http, parseAbi, defineChain } from 'viem'
import { accountForKey } from './keys'
export { accountForKey } from './keys'

export const ROBINHOOD_MAINNET_CHAIN_ID = 4663
export const ROBINHOOD_TESTNET_CHAIN_ID = 46630

const MAINNET_RPC = 'https://rpc.mainnet.chain.robinhood.com'
const TESTNET_RPC = 'https://rpc.testnet.chain.robinhood.com'

/** Wrapped native asset — the default quote token for Pons launches. */
export const WETH_ADDRESS = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' as const

/** Uniswap v4 singleton, read from `poolManager()` on the Pons meme hook. */
export const V4_POOL_MANAGER = '0x8366a39cc670b4001a1121b8f6a443a643e40951' as const

/** Pons v2 deployment (mainnet). */
export const PONS_V2 = {
  factory: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e',
  feeEscrow: '0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e',
  locker: '0x267444D099b10fB5Ed7c3Cc7B7c767AdcA574952',
  memeHook: '0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044',
  buybackVault: '0x42df2a798f82289E177311362e8f5ccC45c1219c',
  launchAndBuy: '0xe33E9E479dF8802cb0866d5d05258bEc4cF62948',
  launchDeployer: '0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42',
  graduationExecutor: '0xC7819B64A1dAECD7eC19856d026cb14EfBd89046',
  graduationGuard: '0xf5695117b99B6f6401e67d4195BD653628176C6C',
} as const

export function isTestnet(): boolean {
  const n = (process.env.CHAIN_NETWORK || 'mainnet').toLowerCase()
  return n === 'testnet' || n === 'devnet'
}

export function getChainId(): number {
  return isTestnet() ? ROBINHOOD_TESTNET_CHAIN_ID : ROBINHOOD_MAINNET_CHAIN_ID
}

/** Custom RPC (paid/private) wins — the public node rate-limits under load. */
export function getRpcUrl(): string {
  const custom = process.env.ROBINHOOD_RPC_URL?.trim()
  if (custom) return custom
  return isTestnet() ? TESTNET_RPC : MAINNET_RPC
}

export const robinhoodChain = defineChain({
  id: getChainId(),
  name: isTestnet() ? 'Robinhood Chain Testnet' : 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [getRpcUrl()] } },
})

let _public: ReturnType<typeof createPublicClient> | null = null

export function publicClient() {
  if (!_public) {
    _public = createPublicClient({ chain: robinhoodChain, transport: http(getRpcUrl()) })
  }
  return _public
}

/**
 * Wallet client for the ACTIVE tenant's payout wallet. Reads the per-tenant
 * key from AsyncLocalStorage exactly like the Solana path did, so multi-tenant
 * isolation is unchanged.
 */
export function walletClientForKey(privateKeyHex: string | undefined | null) {
  const account = accountForKey(privateKeyHex)
  if (!account) return null
  return createWalletClient({ account, chain: robinhoodChain, transport: http(getRpcUrl()) })
}

// ---------------------------------------------------------------------------
// ABIs — transcribed from docs.ponsfamily.com (v2)
// ---------------------------------------------------------------------------

/** Launch phase — the authoritative routing signal. Never infer it. */
export enum LaunchPhase {
  NotGraduated = 0, // trading on the bonding curve
  Swept = 1, // curve closed, pool not yet created (transient)
  PoolCreated = 2, // trading on Uniswap v4
  Rescued = 3, // recovery path — off the normal flow
}

export const FACTORY_ABI = parseAbi([
  'struct LaunchedToken { address token; address curve; address deployer; address creatorFeeRecipient; address pairToken; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; uint16 creatorTaxBps; bool buybackEnabled; uint8 phase; uint256 sweptQuote; uint256 sweptTokens; uint256 sweptAt; bool exists; }',
  'function getLaunchedToken(address token) view returns (LaunchedToken)',
  'event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)',
  'event CreatorFeeRecipientUpdated(address indexed token, address indexed previousRecipient, address indexed newRecipient)',
])

/** Bonding curve — buys/sells and the state needed to quote them locally. */
export const CURVE_ABI = parseAbi([
  'function quoteFeeBalance() view returns (uint256)',
  'function creatorTaxBalance() view returns (uint256)',
  'function sweepFees(uint256 minBuybackTokensOut)',
  'function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) payable returns (uint256 tokensOut)',
  'function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient) returns (uint256 quoteOut)',
  'function isNativeQuote() view returns (bool)',
  'function pairToken() view returns (address)',
  'function getReserves() view returns (uint256 quoteReserve, uint256 tokenReserve)',
  'function quoteReserve() view returns (uint256)',
  'function realQuoteReserve() view returns (uint256)',
  'function tokenReserve() view returns (uint256)',
  'function sellableTokens() view returns (uint256)',
  'function reservedTokens() view returns (uint256)',
  'function readyToGraduate() view returns (bool)',
  'function feeBps() view returns (uint256)',
  'function creatorTaxBps() view returns (uint256)',
  'function currentSnipeTaxBps(address recipient) view returns (uint256)',
  'event CurveBuy(address indexed buyer, address indexed recipient, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 tax)',
  'event CurveSell(address indexed seller, address indexed recipient, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 tax)',
])

/**
 * Fee escrow — creator rewards are CREDITED here, not pushed, so a recipient
 * that cannot receive a transfer never blocks anyone else. Separate native
 * and per-token ledgers.
 */
export const FEE_ESCROW_ABI = parseAbi([
  'function balanceOf(address recipient) view returns (uint256)',
  'function balanceOfToken(address recipient, address token) view returns (uint256)',
  'function claim()',
  'function claimToken(address token)',
])

export const ERC20_ABI = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])

/** Native asset sentinel used by Uniswap v4 and Pons for ETH-quoted launches. */
export const NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000' as const

export function isNativeAsset(addr: string | null | undefined): boolean {
  return !addr || addr.toLowerCase() === NATIVE_ADDRESS
}
