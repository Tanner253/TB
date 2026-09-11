const { createPublicClient, http, parseAbi } = require('viem')
const rpc = 'https://rpc.mainnet.chain.robinhood.com'
const client = createPublicClient({ transport: http(rpc) })
async function main() {
 const chain = await client.getChainId()
 if (chain !== 4663) throw Error('Unexpected chain: ' + chain)
 const head = await client.getBlockNumber()
 const factory = '0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e'
 const abi = parseAbi(['event TokenLaunched(address indexed token,address indexed curve,address indexed deployer,address pairToken,uint256 launchConfigId,uint256 graduationThreshold)',
 'struct LaunchedToken { address token; address curve; address deployer; address creatorFeeRecipient; address pairToken; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; uint16 creatorTaxBps; bool buybackEnabled; uint8 phase; uint256 sweptQuote; uint256 sweptTokens; uint256 sweptAt; bool exists; }',
 'function getLaunchedToken(address token) view returns (LaunchedToken)'])
 const logs = await client.getLogs({address:factory,event:abi[0],fromBlock:head-100000n,toBlock:head,strict:true})
 const counts = {}; for (const l of logs) counts[l.args.pairToken] = (counts[l.args.pairToken] || 0) + 1;  const token = process.argv[2] || [...logs].reverse().find(l => l.args.pairToken === '0x0000000000000000000000000000000000000000')?.args.token
 console.log(JSON.stringify({chain,head:head.toString(),launches:logs.length,token}))
 if (token) {
   const launch = await client.readContract({address:factory,abi,functionName:'getLaunchedToken',args:[token]})
   console.log(JSON.stringify({launch},(_,v)=>typeof v==='bigint'?v.toString():v)); const curveAbi=parseAbi(['function getReserves() view returns(uint256,uint256)','function sellableTokens() view returns(uint256)','function feeBps() view returns(uint256)','function creatorTaxBps() view returns(uint256)'])
   const reads = await Promise.all(curveAbi.map(a=>client.readContract({address:launch.curve,abi:curveAbi,functionName:a.name})))
   console.log(JSON.stringify({launch,reads},(_,v)=>typeof v==='bigint'?v.toString():v))
 }
}
main().catch(e=>{console.error(e.shortMessage || e.message);process.exitCode=1})
