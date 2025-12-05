'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'

// Dynamically import Three.js component to avoid SSR issues
const CandlestickBackground = dynamic(() => import('./components/CandlestickBackground'), {
    ssr: false
})

// --- Icons ---
const Icons = {
    TrendingDown: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>,
    Zap: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>,
    ShieldAlert: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>,
    Clock: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
    ArrowRight: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>,
    Menu: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>,
    X: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
    ChevronDown: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>,
    Trophy: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8m-4-9v9m-6.7-6a3 3 0 0 0 6 0V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v5a3 3 0 0 0 3 3zm14 0a3 3 0 0 0-3-3v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5a3 3 0 0 1-3 3z"/></svg>
}

// --- Data ---
const MOCK_REKT_FEED = [
    { wallet: "8x92...Fa1", loss: "-89.4%", payout: "1,240 $TBLAST" },
    { wallet: "Sol...Whale", loss: "-42.1%", payout: "Waiting..." },
    { wallet: "DeFi...God", loss: "-91.2%", payout: "2,500 $TBLAST" },
    { wallet: "Paper...Hnd", loss: "-12.5%", payout: "Not Eligible" },
    { wallet: "Moon...Boy", loss: "-66.6%", payout: "Waiting..." },
]

// --- Components ---

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <nav className="fixed top-0 left-0 w-full glass-nav z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center gap-2 cursor-pointer group">
                        <motion.div 
                            whileHover={{ rotate: 360 }}
                            transition={{ duration: 0.5 }}
                            className="w-8 h-8 bg-gradient-to-br from-green-400 to-purple-600 rounded flex items-center justify-center text-black font-bold text-xl"
                        >
                            T
                        </motion.div>
                        <span className="text-xl font-bold tracking-tighter group-hover:text-green-400 transition-colors">TOPBLAST</span>
                    </div>
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-8">
                            <a href="#mission" className="hover:text-green-400 transition-colors px-3 py-2 rounded-md text-sm font-medium">Mission</a>
                            <a href="#how-it-works" className="hover:text-green-400 transition-colors px-3 py-2 rounded-md text-sm font-medium">Mechanism</a>
                            <a href="#tokenomics" className="hover:text-green-400 transition-colors px-3 py-2 rounded-md text-sm font-medium">Tokenomics</a>
                            <a href="#whitepaper" className="hover:text-green-400 transition-colors px-3 py-2 rounded-md text-sm font-medium">Whitepaper</a>
                            <motion.button 
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="bg-white text-black px-4 py-2 rounded font-bold hover:bg-green-400 hover:text-black transition-all shadow-[0_0_15px_rgba(255,255,255,0.3)] hover:shadow-[0_0_20px_rgba(20,241,149,0.5)]"
                            >
                                Launch App
                            </motion.button>
                        </div>
                    </div>
                    <div className="-mr-2 flex md:hidden">
                        <button onClick={() => setIsOpen(!isOpen)} className="text-gray-400 hover:text-white p-2">
                            {isOpen ? <Icons.X /> : <Icons.Menu />}
                        </button>
                    </div>
                </div>
            </div>
            {/* Mobile Menu */}
            {isOpen && (
                <div className="md:hidden glass-panel border-t border-gray-800">
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        <a href="#mission" className="block hover:bg-gray-800 px-3 py-2 rounded-md text-base font-medium">Mission</a>
                        <a href="#how-it-works" className="block hover:bg-gray-800 px-3 py-2 rounded-md text-base font-medium">Mechanism</a>
                        <a href="#whitepaper" className="block hover:bg-gray-800 px-3 py-2 rounded-md text-base font-medium">Whitepaper</a>
                    </div>
                </div>
            )}
        </nav>
    )
}

const Hero = () => {
    return (
        <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
            <div className="relative z-10 max-w-7xl mx-auto px-4 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/10 mb-6 backdrop-blur-md">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-xs font-mono text-gray-300">SYSTEM OPERATIONAL // SOLANA NETWORK</span>
                    </div>
                </motion.div>

                <motion.h1 
                    className="text-6xl md:text-8xl font-bold tracking-tighter mb-6 leading-tight glitch"
                    data-text="WHEN YOU DRAWDOWN WE BLAST YOU UP"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.8 }}
                >
                    WHEN YOU <span className="text-red-500 neon-red italic">DRAWDOWN</span>
                    <br />
                    WE <span className="hero-text-gradient neon-purple">BLAST</span> YOU UP
                </motion.h1>

                <motion.p 
                    className="text-xl text-gray-300 max-w-2xl mx-auto mb-10 bg-black/30 backdrop-blur-sm py-2 px-4 rounded-lg"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                >
                    The world&apos;s first <strong>Loss-Mining Protocol</strong>. Built on Solana + Clockwork.
                    <br/>
                    A hedge against yourself.
                </motion.p>

                <motion.div 
                    className="flex flex-col md:flex-row gap-4 justify-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-white text-black px-8 py-4 rounded font-bold text-lg hover:bg-green-400 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                    >
                        Start Losing to Win <Icons.ArrowRight />
                    </motion.button>
                    <motion.button 
                        whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.1)" }}
                        whileTap={{ scale: 0.95 }}
                        className="glass-panel text-white px-8 py-4 rounded font-bold text-lg transition-all border border-white/20"
                    >
                        Read Whitepaper
                    </motion.button>
                </motion.div>
            </div>
        </section>
    )
}

const RektTicker = () => {
    return (
        <div className="w-full bg-red-900/20 border-y border-red-500/30 overflow-hidden py-3 relative z-20 backdrop-blur-sm">
            <div className="flex animate-slide whitespace-nowrap gap-12 px-4">
                {[...MOCK_REKT_FEED, ...MOCK_REKT_FEED, ...MOCK_REKT_FEED, ...MOCK_REKT_FEED].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm font-mono">
                        <span className="text-gray-400">{item.wallet}</span>
                        <span className="text-red-500 font-bold">{item.loss}</span>
                        <span className="text-green-400 bg-green-900/30 px-2 py-0.5 rounded text-xs">{item.payout}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

const CountDown = () => {
    const [timeLeft, setTimeLeft] = useState("59:59")
    
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date()
            const minutes = 59 - now.getMinutes()
            const seconds = 59 - now.getSeconds()
            setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
        }, 1000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="fixed bottom-10 right-10 glass-panel p-4 rounded-lg hidden md:block z-30 border-l-4 border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.2)]">
            <div className="flex items-center gap-3">
                <div className="bg-green-500/20 p-2 rounded-full text-green-400 animate-pulse">
                    <Icons.Clock />
                </div>
                <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Next Blast In</p>
                    <p className="text-2xl font-mono font-bold">{timeLeft}</p>
                </div>
            </div>
        </div>
    )
}

const FeatureCard = ({ icon, title, desc, delay }: { icon: React.ReactNode; title: string; desc: string; delay: number }) => {
    return (
        <motion.div 
            className="glass-panel p-8 rounded-xl hover:border-green-500/50 transition-colors group relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: delay }}
            whileHover={{ y: -5 }}
        >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-purple-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
            <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center mb-6 text-green-400 group-hover:scale-110 group-hover:text-white transition-all duration-300">
                {icon}
            </div>
            <h3 className="text-xl font-bold mb-3">{title}</h3>
            <p className="text-gray-400 leading-relaxed group-hover:text-gray-200 transition-colors">{desc}</p>
        </motion.div>
    )
}

const Mechanism = () => {
    return (
        <section id="how-it-works" className="py-24 relative">
            <div className="glass-section-bg">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold mb-4">How It Works</h2>
                        <p className="text-gray-400">The first protocol that pays you to lose.</p>
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-8">
                        <FeatureCard 
                            icon={<Icons.TrendingDown />} 
                            title="1. Track Your Entry" 
                            desc="Our Smart Contract logs your average buy-in price on-chain. We know exactly when you're underwater."
                            delay={0.1}
                        />
                        <FeatureCard 
                            icon={<Icons.ShieldAlert />} 
                            title="2. Calculate Drawdown" 
                            desc="Every hour, Clockwork bots scan the ledger to find the biggest percentage losers (The Blasters)."
                            delay={0.2}
                        />
                        <FeatureCard 
                            icon={<Icons.Zap />} 
                            title="3. Blast Rewards" 
                            desc="Top 3 losers get paid from the pump.fun swap fee pool (80/15/5 split). Your entry resets, and you live to trade another day."
                            delay={0.3}
                        />
                    </div>
                </div>
            </div>
        </section>
    )
}

const Simulator = () => {
     const [investment, setInvestment] = useState(500)
     const [poolSize, setPoolSize] = useState(1000)
     const [drawdown, setDrawdown] = useState(50)
     
     const winFirst = (poolSize * 0.8).toLocaleString()

     return (
         <div className="mt-8 glass-panel p-6 rounded-lg border border-purple-500/30">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Icons.Trophy /> Confidence Simulator: The "Win-Win" Calculator</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div>
                    <label className="block text-gray-400 mb-2">My Investment ($)</label>
                    <input type="number" value={investment} onChange={(e) => setInvestment(Number(e.target.value))} className="w-full bg-black/50 border border-gray-700 rounded px-3 py-2 text-white focus:border-green-500 outline-none"/>
                </div>
                <div>
                    <label className="block text-gray-400 mb-2">My Drawdown (%)</label>
                    <input type="range" min="1" max="99" value={drawdown} onChange={(e) => setDrawdown(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"/>
                    <div className="text-right text-red-500 font-mono mt-1">-{drawdown}%</div>
                </div>
                <div>
                    <label className="block text-gray-400 mb-2">Est. Hourly Pool ($)</label>
                    <input type="number" value={poolSize} onChange={(e) => setPoolSize(Number(e.target.value))} className="w-full bg-black/50 border border-gray-700 rounded px-3 py-2 text-white focus:border-green-500 outline-none"/>
                </div>
            </div>
            <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-center">
                <div className="text-gray-400">If you rank #1:</div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-green-400 neon-green">+${winFirst}</div>
                    <div className="text-xs text-gray-500">Recovered vs Lost: <span className="text-white">{(investment * (drawdown/100)).toLocaleString()} lost</span></div>
                </div>
            </div>
         </div>
     )
}

const Tokenomics = () => {
     const [hoveredRekt, setHoveredRekt] = useState(false)
     
     const data = [
        { id: 'rekt', label: 'Rekt Pool (Rewards)', value: 95, color: 'bg-green-500', interactive: true },
        { id: 'dev', label: 'Creator / Dev', value: 5, color: 'bg-purple-500', interactive: false },
    ]

    return (
        <section id="tokenomics" className="py-24 relative overflow-hidden">
            <div className="glass-section-bg">
                <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center relative z-10">
                    <div>
                        <h2 className="text-4xl font-bold mb-8">Tokenomics</h2>
                        <p className="text-gray-400 mb-8 text-lg">
                            The Flywheel is simple: <strong>More Volume = Bigger Top Blasts.</strong>
                            <br/><br/>
                            <span className="text-white font-bold">pump.fun Swap Fees:</span>
                        </p>
                        <ul className="list-disc pl-5 mt-2 space-y-2 text-gray-400 mb-8">
                            <li><span className="text-green-400">95%</span> Refills Rekt Pool (Paid to Losers)</li>
                            <li><span className="text-purple-400">5%</span> Creator Rewards</li>
                        </ul>
                        <p className="text-gray-400 mb-8">
                            This ensures the payout pool grows directly with market activity. 
                        </p>
                        <Simulator />
                    </div>
                    <div className="glass-panel p-8 rounded-2xl">
                         <div className="space-y-8">
                            {data.map((item, index) => (
                                <div 
                                    key={index}
                                    onMouseEnter={() => item.interactive && setHoveredRekt(true)}
                                    onMouseLeave={() => item.interactive && setHoveredRekt(false)}
                                    className="relative cursor-pointer"
                                >
                                    <div className="flex justify-between mb-2 font-mono text-sm">
                                        <span>{item.label}</span>
                                        <span>{item.value}% of Fees</span>
                                    </div>
                                    <div className="h-6 bg-gray-800 rounded-full overflow-hidden relative">
                                        <motion.div 
                                            className={`h-full ${item.color}`}
                                            initial={{ width: 0 }}
                                            whileInView={{ width: `${item.value}%` }}
                                            transition={{ duration: 1, delay: index * 0.1 }}
                                        />
                                    </div>
                                    
                                    {/* Hover Interaction for Rekt Pool */}
                                    <AnimatePresence>
                                        {item.interactive && hoveredRekt && (
                                            <motion.div 
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 10 }}
                                                className="absolute top-full left-0 w-full mt-4 bg-gray-900 p-4 rounded-lg border border-green-500/50 z-50 shadow-2xl"
                                            >
                                                <h4 className="text-sm font-bold text-green-400 mb-2">Hourly Payout Distribution</h4>
                                                <div className="flex gap-2 h-16">
                                                    <div className="h-full bg-yellow-400/80 rounded flex flex-col items-center justify-center text-black font-bold text-xs" style={{width: '80%'}}>
                                                        <span>🥇 1st</span>
                                                        <span className="text-lg">80%</span>
                                                    </div>
                                                    <div className="h-full bg-gray-300/80 rounded flex flex-col items-center justify-center text-black font-bold text-xs" style={{width: '15%'}}>
                                                        <span>🥈</span>
                                                        <span>15%</span>
                                                    </div>
                                                    <div className="h-full bg-orange-400/80 rounded flex flex-col items-center justify-center text-black font-bold text-xs" style={{width: '5%'}}>
                                                        <span>🥉</span>
                                                        <span>5%</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

const AccordionItem = ({ title, children, isOpen, onClick }: { title: string; children: React.ReactNode; isOpen: boolean; onClick: () => void }) => {
    return (
        <div className="border-b border-gray-800">
            <button 
                className="w-full py-4 flex items-center justify-between text-left hover:text-green-400 transition-colors"
                onClick={onClick}
            >
                <span className="text-lg font-bold font-mono">{title}</span>
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <Icons.ChevronDown />
                </motion.div>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="pb-6 text-gray-400 leading-relaxed">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

const Whitepaper = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(0)
    
    const sections = [
        {
            title: "1.0 The Hedge Thesis: Volatility Insurance",
            content: (
                <>
                    <p className="mb-4">Most coins are a PVP battle where you only win if the price goes up (Number Go Up technology). <strong>Topblast flips this dynamic.</strong> It acts as volatility insurance for your portfolio, creating an asymmetric bet where downside volatility can result in upside payouts.</p>
                    <p className="mb-4 text-white"><strong>The Win-Win Scenario:</strong></p>
                    <ul className="list-disc pl-5 space-y-2 mb-4">
                        <li><strong>Scenario A (Price Pumps):</strong> You hold the token, the value increases, and you sell for profit. Standard moon mission. You win.</li>
                        <li><strong>Scenario B (Price Dumps):</strong> The market crashes. Paper hands sell in panic. But you? You hold or buy the dip. Your &quot;Drawdown %&quot; increases, skyrocketing you up the <strong>Blaster Leaderboard</strong>. You win the hourly jackpot (80% of the pool) which effectively rebates your loss, often exceeding it by 10x-100x.</li>
                    </ul>
                    <div className="mt-4 p-4 bg-green-900/20 border border-green-500/30 rounded text-sm text-green-300 italic">
                        &quot;In a market of gambling, be the casino. If you can't be the casino, be the player who gets paid to lose.&quot;
                    </div>
                </>
            )
        },
        {
            title: "2.0 Core Mechanics: How Loss is Monetized",
            content: (
                <>
                    <p className="mb-4">Topblast is built on Solana using Rust and Anchor. It relies on a transparent, on-chain tracking mechanism that is verifiable by anyone.</p>
                    <h4 className="text-white font-bold mt-4 mb-2">The &quot;Average Buy Price&quot; Tracker</h4>
                    <p className="mb-4">The system tracks every wallet&apos;s entry price from on-chain buy transactions. When you buy more tokens, your average entry price updates using a volume-weighted calculation (VWAP).</p>
                    <p><strong>Drawdown Calculation:</strong></p>
                    <code className="block bg-gray-900 p-2 rounded text-xs mb-4 text-green-400 font-mono">
                        Current Price - Average Buy Price = PnL <br/>
                        (PnL / Average Buy Price) × 100 = Drawdown %
                    </code>
                    <h4 className="text-white font-bold mt-4 mb-2">Ranking Logic</h4>
                    <p className="mb-2">Holders are ranked by:</p>
                    <ol className="list-decimal pl-5 space-y-1 mb-4">
                        <li><strong>Primary:</strong> Drawdown % (biggest percentage loss first)</li>
                        <li><strong>Tiebreaker:</strong> Absolute USD loss (bigger dollar loss wins ties)</li>
                    </ol>
                    <p>The deeper you are underwater, the higher your rank. This incentivizes holding through dips and buying falling knives, stabilizing the floor price naturally.</p>
                </>
            )
        },
        {
            title: "3.0 Eligibility Rules: Who Can Win?",
            content: (
                <>
                    <p className="mb-4">Not everyone qualifies for the Top Blast. These rules prevent gaming and ensure genuine &quot;bag holders&quot; are rewarded.</p>
                    
                    <h4 className="text-white font-bold mt-4 mb-2">✅ Requirements to Qualify</h4>
                    <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
                        <ul className="space-y-3">
                            <li className="flex items-start gap-2">
                                <span className="text-green-400 font-bold">1.</span>
                                <div><strong className="text-white">Minimum Holding:</strong> Must hold at least <span className="text-green-400 font-mono">100,000 $TBLAST</span> tokens</div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-400 font-bold">2.</span>
                                <div><strong className="text-white">Holding Duration:</strong> Must have held for at least <span className="text-green-400 font-mono">1 hour</span> before the snapshot</div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-400 font-bold">3.</span>
                                <div><strong className="text-white">Minimum Loss:</strong> Your loss must exceed <span className="text-green-400 font-mono">10%</span> of the current hourly pool value (prevents $1 loss gaming)</div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-400 font-bold">4.</span>
                                <div><strong className="text-white">Underwater:</strong> Must be in a loss position (negative PnL)</div>
                            </li>
                        </ul>
                    </div>

                    <h4 className="text-white font-bold mt-4 mb-2">❌ Disqualification Triggers</h4>
                    <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4">
                        <ul className="space-y-3">
                            <li className="flex items-start gap-2">
                                <span className="text-red-400">•</span>
                                <div><strong className="text-white">Sold tokens:</strong> Any sell = immediate disqualification from current cycle</div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-red-400">•</span>
                                <div><strong className="text-white">Transferred OUT:</strong> Moving tokens to another wallet = 1 hour cooldown</div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-red-400">•</span>
                                <div><strong className="text-white">Won last cycle:</strong> Previous winners sit out 1 cycle (must take new risk to compete again)</div>
                            </li>
                        </ul>
                    </div>

                    <div className="mt-4 p-4 bg-purple-900/20 border border-purple-500/30 rounded text-sm">
                        <strong className="text-purple-300">Why these rules?</strong>
                        <p className="text-gray-400 mt-1">Prevents wash trading, sybil attacks, and micro-loss gaming. Only genuine diamond hands who buy and hold through pain are eligible for rewards.</p>
                    </div>
                </>
            )
        },
        {
            title: "4.0 The Psychology of Winning (Why Buy Any Price?)",
            content: (
                <>
                    <p className="mb-4">Why should you feel confident buying at the top? Or the bottom?</p>
                    <ul className="list-disc pl-5 space-y-3">
                        <li><strong>Buying the Top:</strong> If you buy the top and it dumps, you immediately become eligible for the Rekt Pool. The larger the dump, the higher your probability of winning the jackpot. The jackpot is funded by the trading volume that caused the volatility.</li>
                        <li><strong>Buying the Bottom:</strong> If you catch a knife and it keeps dipping, your drawdown % increases, protecting you. If it reverses and pumps, you profit from the token appreciation.</li>
                        <li><strong>No Fear of Bag Holding:</strong> &quot;Bag holders&quot; are usually the victims of DeFi. In Topblast, Bag Holders are the VIPs. The protocol is designed to reward the most loyal holders who endure the most pain.</li>
                    </ul>
                </>
            )
        },
        {
            title: "5.0 Automation: Fully Automatic Payouts",
            content: (
                <>
                    <p className="mb-4">Trust is paramount. <strong>You don&apos;t need to do anything.</strong> No wallet connection, no claiming, no interaction required.</p>
                    <p className="mb-4">Every hour, the system automatically:</p>
                    <ol className="list-decimal pl-5 space-y-2 mb-4">
                        <li><strong>Scans:</strong> Reads all token holder data directly from Solana blockchain</li>
                        <li><strong>Calculates:</strong> Computes average buy price (VWAP) for each wallet from on-chain transactions</li>
                        <li><strong>Ranks:</strong> Sorts eligible wallets by drawdown % (tiebreaker: absolute loss)</li>
                        <li><strong>Pays:</strong> Automatically sends $TBLAST tokens to Top 3 wallets</li>
                        <li><strong>Resets:</strong> Updates winners&apos; entry price to current market price</li>
                    </ol>
                    <div className="mt-4 p-4 bg-green-900/20 border border-green-500/30 rounded">
                        <p className="text-green-300 font-bold mb-2">🎯 Zero Interaction Required</p>
                        <p className="text-gray-400 text-sm">Just buy and hold. If you qualify and rank in the top 3, tokens are sent directly to your wallet. Check the live leaderboard to see your position.</p>
                    </div>
                </>
            )
        },
        {
            title: "6.0 Tokenomics & Fee Structure",
            content: (
                <>
                    <p className="mb-4">The Reward Pool is funded by <strong>creator fees</strong> from pump.fun/PumpSwap trading volume. More volume = bigger pool = bigger blasts.</p>
                    <h4 className="text-white font-bold mt-4 mb-2">The Hourly Split (Top 3 Losers):</h4>
                    <div className="flex gap-2 h-20 mb-4">
                        <div className="h-full bg-yellow-400/80 rounded flex flex-col items-center justify-center text-black font-bold" style={{width: '80%'}}>
                            <span>🥇 1st Place</span>
                            <span className="text-2xl">80%</span>
                        </div>
                        <div className="h-full bg-gray-300/80 rounded flex flex-col items-center justify-center text-black font-bold text-sm" style={{width: '15%'}}>
                            <span>🥈 2nd</span>
                            <span className="text-lg">15%</span>
                        </div>
                        <div className="h-full bg-orange-400/80 rounded flex flex-col items-center justify-center text-black font-bold text-xs" style={{width: '5%'}}>
                            <span>🥉</span>
                            <span>5%</span>
                        </div>
                    </div>
                    <h4 className="text-white font-bold mt-4 mb-2">Creator Fee Allocation:</h4>
                    <ul className="list-disc pl-5 space-y-2 mb-4">
                        <li><span className="text-green-400 font-bold">95%</span> → Reward Pool (distributed to Top Blasters)</li>
                        <li><span className="text-purple-400 font-bold">5%</span> → Dev/Maintenance wallet</li>
                    </ul>
                    <p className="text-gray-400 text-sm">This is a community-first protocol. The vast majority of fees flow back to holders.</p>
                </>
            )
        },
        {
            title: "7.0 Strategic Trading: How to Win",
            content: (
                <>
                    <p className="mb-4">Advanced strategies for the professional Loser:</p>
                    <ul className="list-disc pl-5 space-y-3">
                        <li><strong>The &quot;Kamikaze&quot; Entry:</strong> Buying heavily during a massive red candle to instantly secure a high drawdown percentage if it dips further. Risk: must hold 1+ hour to qualify.</li>
                        <li><strong>The &quot;Diamond Hand&quot; Hold:</strong> Refusing to sell even when down 50%+, knowing that the payout from the Rekt Pool could exceed your loss value.</li>
                        <li><strong>Volume Watch:</strong> The Rekt Pool is biggest when volume is highest. High volatility days are the most profitable days to be &quot;wrong&quot; on price direction.</li>
                        <li><strong>Timing the Cycle:</strong> The snapshot happens every hour on the hour. Position yourself in the top 3 before the snapshot for maximum chance.</li>
                    </ul>
                    <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded text-sm">
                        <strong className="text-yellow-300">⚠️ Remember:</strong>
                        <p className="text-gray-400 mt-1">Selling disqualifies you. Transferring disqualifies you. The only way to win is to buy, hold through the pain, and let the system reward you automatically.</p>
                    </div>
                </>
            )
        },
        {
            title: "8.0 How to Participate",
            content: (
                <>
                    <p className="mb-4">Getting started with Topblast is simple. <strong>No wallet connection to our site required.</strong></p>
                    
                    <div className="space-y-4">
                        <div className="flex items-start gap-4 p-4 bg-gray-900/50 rounded-lg">
                            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-black font-bold text-lg shrink-0">1</div>
                            <div>
                                <h4 className="text-white font-bold mb-1">Buy $TBLAST</h4>
                                <p className="text-gray-400 text-sm">Purchase tokens on any supported DEX (Raydium, Jupiter, etc.) after bonding completes on pump.fun.</p>
                            </div>
                        </div>
                        
                        <div className="flex items-start gap-4 p-4 bg-gray-900/50 rounded-lg">
                            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-black font-bold text-lg shrink-0">2</div>
                            <div>
                                <h4 className="text-white font-bold mb-1">Hold for 1+ Hour</h4>
                                <p className="text-gray-400 text-sm">Your tokens must be held for at least 1 hour before you become eligible for rewards. Don&apos;t sell. Don&apos;t transfer.</p>
                            </div>
                        </div>
                        
                        <div className="flex items-start gap-4 p-4 bg-gray-900/50 rounded-lg">
                            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-black font-bold text-lg shrink-0">3</div>
                            <div>
                                <h4 className="text-white font-bold mb-1">Watch &amp; Win</h4>
                                <p className="text-gray-400 text-sm">Check the live leaderboard to see your ranking. If you&apos;re in the top 3 at the hourly snapshot, tokens are sent directly to your wallet. No claiming needed.</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 p-4 bg-green-900/20 border border-green-500/30 rounded">
                        <p className="text-green-300 font-bold mb-2">💡 That&apos;s it. Seriously.</p>
                        <p className="text-gray-400 text-sm">Buy, hold, and if you qualify as a top loser, you get paid. The entire system runs automatically using public blockchain data.</p>
                    </div>
                </>
            )
        },
        {
            title: "9.0 Frequently Asked Questions",
            content: (
                <>
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-white font-bold mb-2">How do I check my ranking?</h4>
                            <p className="text-gray-400">Visit the live Leaderboard page on our site. Your wallet address will appear if you&apos;re eligible. No wallet connection required—all data is public.</p>
                        </div>

                        <div>
                            <h4 className="text-white font-bold mb-2">When do payouts start?</h4>
                            <p className="text-gray-400">Payouts begin after the token graduates from pump.fun&apos;s bonding curve and sufficient creator fees have accumulated in the reward pool.</p>
                        </div>

                        <div>
                            <h4 className="text-white font-bold mb-2">What happens if I win?</h4>
                            <p className="text-gray-400">$TBLAST tokens are sent directly to your wallet automatically. Your average buy price (VWAP) resets to the current market price, and you sit out 1 cycle before competing again.</p>
                        </div>

                        <div>
                            <h4 className="text-white font-bold mb-2">What if there are fewer than 3 eligible holders?</h4>
                            <p className="text-gray-400">If only 2 holders qualify, they split 95% (80% + 15%). If only 1 qualifies, they receive the full payout. The remaining 5% stays in the pool.</p>
                        </div>

                        <div>
                            <h4 className="text-white font-bold mb-2">Can I win multiple times?</h4>
                            <p className="text-gray-400">Yes, but not consecutively. After winning, you must sit out 1 cycle. Your VWAP resets, so you need to take new risk (experience new losses) to compete again.</p>
                        </div>

                        <div>
                            <h4 className="text-white font-bold mb-2">What if I transfer tokens to another wallet?</h4>
                            <p className="text-gray-400">Transferring tokens OUT disqualifies you for 1 hour. The receiving wallet&apos;s VWAP will be recalculated. This prevents gaming via wallet splitting.</p>
                        </div>

                        <div>
                            <h4 className="text-white font-bold mb-2">Is this gambling?</h4>
                            <p className="text-gray-400">No. Payouts are deterministic based on your holdings and the price—there&apos;s no randomness. It&apos;s more like a structured reward system for diamond hands than a lottery.</p>
                        </div>

                        <div>
                            <h4 className="text-white font-bold mb-2">How big can payouts get?</h4>
                            <p className="text-gray-400">The reward pool grows with trading volume. More volume = more creator fees = bigger pool = bigger blasts. On high-volume days, the 1st place payout could significantly exceed your loss amount.</p>
                        </div>
                    </div>
                </>
            )
        }
    ]

    return (
        <section id="whitepaper" className="py-24 relative">
            <div className="glass-section-bg">
                <div className="max-w-4xl mx-auto px-4">
                    <h2 className="text-4xl font-bold mb-12 text-center">Whitepaper <span className="text-green-500 text-sm align-top">v2.1</span></h2>
                    <div className="glass-panel rounded-xl p-2 md:p-8">
                        {sections.map((section, idx) => (
                            <AccordionItem 
                                key={idx}
                                title={section.title}
                                isOpen={openIndex === idx}
                                onClick={() => setOpenIndex(idx === openIndex ? null : idx)}
                            >
                                {section.content}
                            </AccordionItem>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}

const Footer = () => {
    return (
        <footer className="py-12 border-t border-gray-900/50 bg-black/60 backdrop-blur-md text-center text-gray-500 text-sm relative z-10">
            <div className="flex justify-center gap-6 mb-8">
                <a href="#" className="hover:text-white transition-colors">Twitter</a>
                <a href="#" className="hover:text-white transition-colors">Discord</a>
                <a href="#" className="hover:text-white transition-colors">Telegram</a>
                <a href="#" className="hover:text-white transition-colors">Github</a>
            </div>
            <p>&copy; 2025 Topblast Protocol. Built on Solana.</p>
        </footer>
    )
}

export default function Home() {
    return (
        <div className="antialiased selection:bg-green-500 selection:text-black">
            {/* Fixed 3D Candlestick Background */}
            <CandlestickBackground />
            
            {/* Scrollable Content Layer */}
            <div className="relative z-10">
                <Navbar />
                <Hero />
                <RektTicker />
                <Mechanism />
                <Tokenomics />
                <Whitepaper />
                <Footer />
            </div>
            
            {/* Fixed Countdown (stays visible) */}
            <CountDown />
        </div>
    )
}
