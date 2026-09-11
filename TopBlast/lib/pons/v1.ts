import 'server-only'
import { parseAbi, type Address } from 'viem'
import { publicClient, WETH_ADDRESS } from './contracts'
export const V1_ABI = parseAbi([
 'struct LaunchedToken { address token; address deployer; address pairedToken; address positionManager; uint256 positionId; uint256 dexId; uint256 launchConfigId; uint256 restrictionsEndBlock; uint256 supply; bool isToken0; uint24 poolFee; bool exists; }',
 'function getLaunchedToken(address token) view returns (LaunchedToken)',
])
export const V3_ABI = parseAbi([
 'function factory() view returns(address)',
 'function getPool(address tokenA,address tokenB,uint24 fee) view returns(address)',
 'function slot0() view returns(uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)',
 'event Swap(address indexed sender,address indexed recipient,int256 amount0,int256 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick)',
])
export async function getV1Launch(token: string) {
 const c = publicClient()
 for (const factory of ['0xa5aab3f0c6eeadf30ef1d3eb997108e976351feb','0x0c37a24f5d23a486fa692d1500881d698b1f77a4'] as Address[]) {
   const row = await c.readContract({ address: factory, abi: V1_ABI, functionName: 'getLaunchedToken', args: [token as Address] })
   if (!row.exists) continue
   const dex = await c.readContract({ address: row.positionManager, abi: V3_ABI, functionName: 'factory' })
   const pool = await c.readContract({ address: dex, abi: V3_ABI, functionName: 'getPool', args: [row.token, row.pairedToken, row.poolFee] })
   return { ...row, pool, nativeQuote: row.pairedToken.toLowerCase() === WETH_ADDRESS.toLowerCase() }
 }
 return null
}
