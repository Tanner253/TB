const { createPublicClient,http,parseAbi }=require('viem');
const c=createPublicClient({transport:http('https://rpc.mainnet.chain.robinhood.com')});
const token=process.argv[2];
async function main(){
 const code=await c.getBytecode({address:token});console.log('code bytes',code?.length);
 const erc=parseAbi(['function symbol() view returns(string)','function decimals() view returns(uint8)','function totalSupply() view returns(uint256)']);
 console.log(await Promise.all(erc.map(a=>c.readContract({address:token,abi:erc,functionName:a.name}))));
 const abi=parseAbi(['struct LaunchedToken { address token; address deployer; address pairedToken; address positionManager; uint256 positionId; uint256 dexId; uint256 launchConfigId; uint256 restrictionsEndBlock; uint256 supply; bool isToken0; uint24 poolFee; bool exists; }','function getLaunchedToken(address token) view returns(LaunchedToken)']);
 for(const factory of ['0xa5aab3f0c6eeadf30ef1d3eb997108e976351feb','0x0c37a24f5d23a486fa692d1500881d698b1f77a4']){
 const result=await c.readContract({address:factory,abi,functionName:'getLaunchedToken',args:[token]});console.log(JSON.stringify({factory,result},(_,v)=>typeof v==='bigint'?v.toString():v));
 }
}
main().catch(e=>{console.error(e.shortMessage||e.message);process.exitCode=1})
