'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import Image from 'next/image'

// Dynamically import Three.js component to avoid SSR issues
const CandlestickBackground = dynamic(() => import('./components/CandlestickBackground'), {
    ssr: false
})

// App URL
const APP_URL = 'https://topblastweb3.xyz'

// External Links
const LINKS = {
    twitter: 'https://x.com/TOPBLASTX',
    github: 'https://github.com/Tanner253/TB',
    app: APP_URL,
}

// --- Icons ---
const Icons = {
    TrendingDown: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>,
    Zap: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>,
    ShieldAlert: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>,
    Clock: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
    ArrowRight: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>,
    Menu: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>,
    Close: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
    ChevronDown: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>,
    Trophy: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8m-4-9v9m-6.7-6a3 3 0 0 0 6 0V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v5a3 3 0 0 0 3 3zm14 0a3 3 0 0 0-3-3v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5a3 3 0 0 1-3 3z"/></svg>,
    ExternalLink: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>,
    Rocket: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path></svg>,
    Shield: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>,
    BarChart: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>,
    Users: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
    Gift: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>,
    // Social Icons
    XTwitter: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
    GitHub: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>,
}

// --- Components ---

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <nav className="fixed top-0 left-0 w-full glass-nav z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <a href={APP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 cursor-pointer group">
                        <motion.div 
                            whileHover={{ rotate: 360 }}
                            transition={{ duration: 0.5 }}
                            className="w-8 h-8 rounded overflow-hidden"
                        >
                            <Image src="/logo.jpg" alt="TopBlast" width={32} height={32} className="w-full h-full object-cover" />
                        </motion.div>
                        <span className="text-xl font-bold tracking-tighter group-hover:text-green-400 transition-colors">TOPBLAST</span>
                    </a>
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-center space-x-6">
                            <a href="#why-invest" className="hover:text-green-400 transition-colors px-2 py-2 rounded-md text-sm font-medium">Why $TBLAST</a>
                            <a href="#how-it-works" className="hover:text-green-400 transition-colors px-2 py-2 rounded-md text-sm font-medium">Mechanism</a>
                            <a href="#tokenomics" className="hover:text-green-400 transition-colors px-2 py-2 rounded-md text-sm font-medium">Tokenomics</a>
                            <a href="#whitepaper" className="hover:text-green-400 transition-colors px-2 py-2 rounded-md text-sm font-medium">Whitepaper</a>
                            <a href="#updates" className="hover:text-green-400 transition-colors px-2 py-2 rounded-md text-sm font-medium">Updates</a>
                            <a href="#roadmap" className="hover:text-purple-400 transition-colors px-2 py-2 rounded-md text-sm font-medium flex items-center gap-1">
                                <span className="text-xs">🗺️</span> Roadmap
                            </a>
                            
                            {/* Social Links */}
                            <div className="flex items-center gap-3 border-l border-white/10 pl-4">
                                <a href={LINKS.twitter} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors" title="Follow on X">
                                    <Icons.XTwitter />
                                </a>
                                <a href={LINKS.github} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors" title="GitHub">
                                    <Icons.GitHub />
                                </a>
                            </div>
                            
                            <a href={APP_URL} target="_blank" rel="noopener noreferrer">
                                <motion.button 
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="bg-gradient-to-r from-green-400 to-emerald-500 text-black px-4 py-2 rounded font-bold hover:from-green-300 hover:to-emerald-400 transition-all shadow-[0_0_15px_rgba(20,241,149,0.4)] hover:shadow-[0_0_25px_rgba(20,241,149,0.6)] flex items-center gap-2"
                                >
                                    Launch App <Icons.ExternalLink />
                                </motion.button>
                            </a>
                        </div>
                    </div>
                    <div className="-mr-2 flex md:hidden">
                        <button onClick={() => setIsOpen(!isOpen)} className="text-gray-400 hover:text-white p-2">
                            {isOpen ? <Icons.Close /> : <Icons.Menu />}
                        </button>
                    </div>
                </div>
            </div>
            {/* Mobile Menu */}
            {isOpen && (
                <div className="md:hidden glass-panel border-t border-gray-800">
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        <a href="#why-invest" className="block hover:bg-gray-800 px-3 py-2 rounded-md text-base font-medium">Why $TBLAST</a>
                        <a href="#how-it-works" className="block hover:bg-gray-800 px-3 py-2 rounded-md text-base font-medium">Mechanism</a>
                        <a href="#tokenomics" className="block hover:bg-gray-800 px-3 py-2 rounded-md text-base font-medium">Tokenomics</a>
                        <a href="#whitepaper" className="block hover:bg-gray-800 px-3 py-2 rounded-md text-base font-medium">Whitepaper</a>
                        <a href="#roadmap" className="block hover:bg-gray-800 px-3 py-2 rounded-md text-base font-medium">🗺️ Roadmap</a>
                        {/* Mobile Social Links */}
                        <div className="flex items-center gap-4 px-3 py-2">
                            <a href={LINKS.twitter} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                                <Icons.XTwitter /> @TOPBLASTX
                            </a>
                            <a href={LINKS.github} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                                <Icons.GitHub /> GitHub
                            </a>
                        </div>
                        <a href={APP_URL} target="_blank" rel="noopener noreferrer" className="block bg-green-500 text-black px-3 py-2 rounded-md text-base font-bold mt-2">
                            Launch App →
                        </a>
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
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-green-500/30 mb-6 backdrop-blur-md">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-xs font-mono text-green-300">LIVE ON SOLANA • AUTOMATED PAYOUTS</span>
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
                    className="text-xl text-gray-300 max-w-2xl mx-auto mb-6 bg-black/30 backdrop-blur-sm py-2 px-4 rounded-lg"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                >
                    The world&apos;s first <strong className="text-green-400">Loss-Mining Protocol</strong>. Built on Solana.
                    <br/>
                    Get paid for being a top loser. Automatically. Every 2 hours.
                </motion.p>

                {/* Value Proposition Pills */}
                <motion.div 
                    className="flex flex-wrap justify-center gap-3 mb-10"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                >
                    <span className="px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 text-sm font-medium">💰 2-Hour Payouts</span>
                    <span className="px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-full text-purple-400 text-sm font-medium">🤖 Fully Automated</span>
                    <span className="px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-400 text-sm font-medium">🔗 On-Chain Verified</span>
                    <span className="px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-yellow-400 text-sm font-medium">🎯 No Claiming Needed</span>
                </motion.div>

                <motion.div 
                    className="flex flex-col md:flex-row gap-4 justify-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <a href={APP_URL} target="_blank" rel="noopener noreferrer">
                        <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="bg-gradient-to-r from-green-400 to-emerald-500 text-black px-8 py-4 rounded-lg font-bold text-lg hover:from-green-300 hover:to-emerald-400 transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(20,241,149,0.3)]"
                        >
                            <Icons.Rocket /> View Live Leaderboard
                        </motion.button>
                    </a>
                    <a href="#whitepaper">
                        <motion.button 
                            whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.1)" }}
                            whileTap={{ scale: 0.95 }}
                            className="glass-panel text-white px-8 py-4 rounded-lg font-bold text-lg transition-all border border-white/20"
                        >
                            Read Whitepaper
                        </motion.button>
                    </a>
                </motion.div>

                {/* Quick Stats */}
                <motion.div 
                    className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                >
                    <div className="glass-panel rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-green-400 font-mono">80%</div>
                        <div className="text-xs text-gray-400 mt-1">1st Place Payout</div>
                    </div>
                    <div className="glass-panel rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-cyan-400 font-mono">1hr</div>
                        <div className="text-xs text-gray-400 mt-1">Payout Frequency</div>
                    </div>
                    <div className="glass-panel rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-purple-400 font-mono">95%</div>
                        <div className="text-xs text-gray-400 mt-1">To Community</div>
                    </div>
                    <div className="glass-panel rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-yellow-400 font-mono">0</div>
                        <div className="text-xs text-gray-400 mt-1">Interaction Needed</div>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}

const RektTicker = () => {
    const LIVE_FEED = [
        { wallet: "7xKXt...Fa1", loss: "-72.5%", payout: "Winner 🏆" },
        { wallet: "Sol...Whale", loss: "-45.2%", payout: "2nd Place" },
        { wallet: "DeFi...Pro", loss: "-38.7%", payout: "3rd Place" },
        { wallet: "Diam...Hand", loss: "-29.1%", payout: "Eligible ✓" },
        { wallet: "Moon...Boy", loss: "-15.3%", payout: "Eligible ✓" },
    ]
    
    return (
        <div className="w-full bg-green-900/20 border-y border-green-500/30 overflow-hidden py-3 relative z-20 backdrop-blur-sm">
            <div className="flex animate-slide whitespace-nowrap gap-12 px-4">
                {[...LIVE_FEED, ...LIVE_FEED, ...LIVE_FEED, ...LIVE_FEED].map((item, i) => (
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

// Why Invest Section - NEW
const WhyInvest = () => {
    const benefits = [
        {
            icon: <Icons.Shield />,
            title: "Downside Protection",
            desc: "Unlike traditional tokens where you only win if price goes up, $TBLAST rewards you when price dumps. Your loss becomes your ticket to win.",
            highlight: "Win when price pumps OR dumps"
        },
        {
            icon: <Icons.Gift />,
            title: "Automatic Rewards",
            desc: "No staking, no claiming, no wallet connection. Just buy, hold, and if you qualify as a top loser, rewards are sent directly to your wallet.",
            highlight: "Zero interaction required"
        },
        {
            icon: <Icons.BarChart />,
            title: "Volume-Backed Pool",
            desc: "The reward pool grows with trading volume. More trading = bigger pool = bigger payouts. The flywheel rewards diamond hands.",
            highlight: "Pool grows with activity"
        },
        {
            icon: <Icons.Users />,
            title: "Community First",
            desc: "95% of all fees go back to the community through 2-hour payouts. Only 5% for development. This is a protocol by degens, for degens.",
            highlight: "95% to holders"
        },
    ]

    return (
        <section id="why-invest" className="py-24 relative">
            <div className="glass-section-bg">
                <div className="max-w-7xl mx-auto px-4">
                    <motion.div 
                        className="text-center mb-16"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <span className="inline-block px-4 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-green-400 text-sm font-medium mb-4">
                            INVESTOR VALUE
                        </span>
                        <h2 className="text-4xl md:text-5xl font-bold mb-4">Why Buy <span className="text-green-400">$TBLAST</span>?</h2>
                        <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                            The only token where being wrong about price direction can still make you money.
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-2 gap-6 mb-12">
                        {benefits.map((benefit, idx) => (
                            <motion.div
                                key={idx}
                                className="glass-panel p-8 rounded-2xl hover:border-green-500/50 transition-all group"
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: idx * 0.1 }}
                                whileHover={{ y: -5 }}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-14 h-14 bg-green-500/20 rounded-xl flex items-center justify-center text-green-400 shrink-0 group-hover:scale-110 transition-transform">
                                        {benefit.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold mb-2">{benefit.title}</h3>
                                        <p className="text-gray-400 mb-3">{benefit.desc}</p>
                                        <span className="inline-block px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-xs font-medium">
                                            ✓ {benefit.highlight}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Investment Thesis */}
                    <motion.div
                        className="glass-panel rounded-2xl p-8 border-2 border-green-500/30 relative overflow-hidden"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl"></div>
                        <div className="relative">
                            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                                <span className="text-3xl">💡</span>
                                The Win-Win Investment Thesis
                            </h3>
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-6">
                                    <div className="text-green-400 font-bold mb-2 flex items-center gap-2">
                                        <span className="text-2xl">📈</span> Scenario A: Price Pumps
                                    </div>
                                    <p className="text-gray-300">
                                        Your tokens appreciate in value. You profit from standard price appreciation. 
                                        <span className="text-green-400 font-bold"> You win.</span>
                                    </p>
                                </div>
                                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6">
                                    <div className="text-red-400 font-bold mb-2 flex items-center gap-2">
                                        <span className="text-2xl">📉</span> Scenario B: Price Dumps
                                    </div>
                                    <p className="text-gray-300">
                                        Your drawdown increases. You climb the leaderboard. You win 80% of the 2-hour pool. 
                                        <span className="text-green-400 font-bold"> You still win.</span>
                                    </p>
                                </div>
                            </div>
                            <div className="mt-6 text-center">
                                <a href={APP_URL} target="_blank" rel="noopener noreferrer">
                                    <motion.button
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="bg-gradient-to-r from-green-400 to-emerald-500 text-black px-8 py-3 rounded-lg font-bold text-lg shadow-[0_0_20px_rgba(20,241,149,0.3)] hover:shadow-[0_0_30px_rgba(20,241,149,0.5)] transition-all"
                                    >
                                        Check Live Rankings on App →
                                    </motion.button>
                                </a>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}

const CountDown = () => {
    const [timeLeft, setTimeLeft] = useState("1:59:59")
    
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date()
            // 2-hour cycle: calculate position within 2-hour window
            const totalMinutesInCycle = now.getHours() % 2 === 0 
                ? now.getMinutes() 
                : 60 + now.getMinutes()
            const totalSecondsElapsed = totalMinutesInCycle * 60 + now.getSeconds()
            const totalSecondsInCycle = 2 * 60 * 60 // 2 hours in seconds
            const secondsRemaining = totalSecondsInCycle - totalSecondsElapsed - 1
            
            const hours = Math.floor(secondsRemaining / 3600)
            const minutes = Math.floor((secondsRemaining % 3600) / 60)
            const seconds = secondsRemaining % 60
            
            setTimeLeft(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
        }, 1000)
        return () => clearInterval(interval)
    }, [])

    return (
        <a href={`${APP_URL}/leaderboard`} target="_blank" rel="noopener noreferrer">
            <motion.div 
                className="fixed bottom-10 right-10 glass-panel p-4 rounded-lg hidden md:block z-30 border-l-4 border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.2)] cursor-pointer hover:shadow-[0_0_30px_rgba(74,222,128,0.4)] transition-all"
                whileHover={{ scale: 1.05 }}
            >
                <div className="flex items-center gap-3">
                    <div className="bg-green-500/20 p-2 rounded-full text-green-400 animate-pulse">
                        <Icons.Clock />
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Next Blast In</p>
                        <p className="text-2xl font-mono font-bold">{timeLeft}</p>
                    </div>
                </div>
                <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
                    View Leaderboard <Icons.ExternalLink />
                </div>
            </motion.div>
        </a>
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
                        <span className="inline-block px-4 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-400 text-sm font-medium mb-4">
                            PROTOCOL MECHANICS
                        </span>
                        <h2 className="text-4xl font-bold mb-4">How It Works</h2>
                        <p className="text-gray-400">The first protocol that pays you to lose. Fully automated, no interaction needed.</p>
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-8 mb-12">
                        <FeatureCard 
                            icon={<Icons.TrendingDown />} 
                            title="1. Track Your Entry" 
                            desc="The system calculates your VWAP (average buy price) from real on-chain transactions. We know exactly when you're underwater."
                            delay={0.1}
                        />
                        <FeatureCard 
                            icon={<Icons.ShieldAlert />} 
                            title="2. Calculate Drawdown" 
                            desc="Every 2 hours, the system scans all holders to find the biggest percentage losers. Ranked by drawdown %, with USD loss as tiebreaker."
                            delay={0.2}
                        />
                        <FeatureCard 
                            icon={<Icons.Zap />} 
                            title="3. Blast Rewards" 
                            desc="Top 3 losers automatically receive payouts (80/15/5 split). Tokens sent directly to wallets. No claiming, no gas, no interaction."
                            delay={0.3}
                        />
                    </div>

                    {/* CTA to App */}
                    <motion.div 
                        className="text-center"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                    >
                        <a href={`${APP_URL}/leaderboard`} target="_blank" rel="noopener noreferrer">
                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.98 }}
                                className="bg-white/10 border border-white/20 px-6 py-3 rounded-lg font-medium hover:bg-white/20 transition-all flex items-center gap-2 mx-auto"
                            >
                                See Live Rankings <Icons.ExternalLink />
                            </motion.button>
                        </a>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}

const Simulator = () => {
     const [investment, setInvestment] = useState(500)
     const [poolSize, setPoolSize] = useState(1000)
     const [drawdown, setDrawdown] = useState(50)
     
     const winFirst = (poolSize * 0.8 * 0.95).toFixed(0) // After 5% dev fee
     const lossAmount = (investment * (drawdown/100)).toFixed(0)
     const netProfit = (parseFloat(winFirst) - parseFloat(lossAmount)).toFixed(0)
     const roi = ((parseFloat(winFirst) / investment) * 100).toFixed(0)

     return (
         <div className="mt-8 glass-panel p-6 rounded-lg border border-purple-500/30">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Icons.Trophy /> ROI Calculator: The &quot;Win-Win&quot; Simulator</h3>
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
                    <label className="block text-gray-400 mb-2">Est. 2-Hour Pool ($)</label>
                    <input type="number" value={poolSize} onChange={(e) => setPoolSize(Number(e.target.value))} className="w-full bg-black/50 border border-gray-700 rounded px-3 py-2 text-white focus:border-green-500 outline-none"/>
                </div>
            </div>
            <div className="mt-6 pt-6 border-t border-white/10 grid md:grid-cols-3 gap-4">
                <div className="bg-red-900/20 rounded-lg p-4 text-center">
                    <div className="text-xs text-gray-400 uppercase">Paper Loss</div>
                    <div className="text-2xl font-bold text-red-400 font-mono">-${lossAmount}</div>
                </div>
                <div className="bg-green-900/20 rounded-lg p-4 text-center">
                    <div className="text-xs text-gray-400 uppercase">1st Place Win</div>
                    <div className="text-2xl font-bold text-green-400 neon-green font-mono">+${winFirst}</div>
                </div>
                <div className="bg-purple-900/20 rounded-lg p-4 text-center">
                    <div className="text-xs text-gray-400 uppercase">Net Profit</div>
                    <div className={`text-2xl font-bold font-mono ${parseFloat(netProfit) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {parseFloat(netProfit) >= 0 ? '+' : ''}${netProfit}
                    </div>
                </div>
            </div>
            <div className="mt-4 text-center text-sm text-gray-400">
                Potential ROI if you rank #1: <span className="text-green-400 font-bold">{roi}%</span>
            </div>
         </div>
     )
}

const Tokenomics = () => {
     const [hoveredRekt, setHoveredRekt] = useState(false)
     
     const data = [
        { id: 'rekt', label: 'Community Rewards (Rekt Pool)', value: 95, color: 'bg-green-500', interactive: true },
        { id: 'dev', label: 'Development & Maintenance', value: 5, color: 'bg-purple-500', interactive: false },
    ]

    return (
        <section id="tokenomics" className="py-24 relative overflow-hidden">
            <div className="glass-section-bg">
                <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center relative z-10">
                    <div>
                        <span className="inline-block px-4 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded-full text-cyan-400 text-sm font-medium mb-4">
                            ECONOMICS
                        </span>
                        <h2 className="text-4xl font-bold mb-8">Tokenomics</h2>
                        <p className="text-gray-400 mb-8 text-lg">
                            The Flywheel is simple: <strong className="text-white">More Volume = Bigger Blasts.</strong>
                        </p>
                        
                        <div className="space-y-4 mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <span className="text-gray-300"><span className="text-green-400 font-bold">95%</span> of fees → Community Rewards (Top 3 Losers)</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                <span className="text-gray-300"><span className="text-purple-400 font-bold">5%</span> of fees → Protocol Development</span>
                            </div>
                        </div>

                        <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg mb-8">
                            <p className="text-green-300 text-sm">
                                <strong>💡 Flywheel Effect:</strong> More trading → More fees → Bigger pool → Bigger payouts → More attention → More trading
                            </p>
                        </div>
                        
                        <Simulator />
                    </div>
                    <div className="glass-panel p-8 rounded-2xl">
                         <h3 className="text-xl font-bold mb-6">Fee Distribution</h3>
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
                                        <span className="font-bold">{item.value}%</span>
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
                                                <h4 className="text-sm font-bold text-green-400 mb-2">2-Hour Payout Split</h4>
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

                        {/* App Link */}
                        <div className="mt-8 pt-6 border-t border-white/10">
                            <a href={`${APP_URL}/stats`} target="_blank" rel="noopener noreferrer">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    className="w-full bg-white/5 border border-white/10 py-3 rounded-lg font-medium hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                                >
                                    View Live Pool Stats <Icons.ExternalLink />
                                </motion.button>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

// Update Log Section - NEW
const UpdateLog = () => {
    const updates = [
        {
            version: "v2.1.0",
            date: "December 2025",
            tag: "CURRENT",
            changes: [
                "Live automated payouts on Solana mainnet",
                "Real-time leaderboard with 5-second polling",
                "VWAP calculation from on-chain transaction history",
                "Payout history with Solscan transaction links",
                "Anti-gaming: winner cooldown, transfer detection, sell detection"
            ]
        },
        {
            version: "v2.0.0",
            date: "December 2025",
            tag: "MAJOR",
            changes: [
                "Complete rewrite with Next.js 14",
                "MongoDB for holder caching and payout history",
                "Helius RPC integration for blockchain data",
                "Jupiter Price API for real-time pricing",
                "Framer Motion animations"
            ]
        },
        {
            version: "v1.0.0",
            date: "November 2025",
            tag: "LAUNCH",
            changes: [
                "Initial whitepaper release",
                "Protocol concept and mechanism design",
                "Eligibility rules and anti-gaming framework"
            ]
        }
    ]

    return (
        <section id="updates" className="py-24 relative">
            <div className="glass-section-bg">
                <div className="max-w-4xl mx-auto px-4">
                    <motion.div 
                        className="text-center mb-12"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <span className="inline-block px-4 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full text-yellow-400 text-sm font-medium mb-4">
                            DEVELOPMENT
                        </span>
                        <h2 className="text-4xl font-bold mb-4">Update Log</h2>
                        <p className="text-gray-400">Track our progress and see what&apos;s new in each version.</p>
                    </motion.div>

                    <div className="space-y-6">
                        {updates.map((update, idx) => (
                            <motion.div
                                key={idx}
                                className="glass-panel rounded-xl p-6 border-l-4 border-green-500"
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: idx * 0.1 }}
                            >
                                <div className="flex items-center gap-4 mb-4">
                                    <span className="text-2xl font-bold text-green-400 font-mono">{update.version}</span>
                                    <span className="text-sm text-gray-400">{update.date}</span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                        update.tag === 'CURRENT' ? 'bg-green-500 text-black' :
                                        update.tag === 'MAJOR' ? 'bg-purple-500 text-white' :
                                        'bg-gray-600 text-white'
                                    }`}>
                                        {update.tag}
                                    </span>
                                </div>
                                <ul className="space-y-2">
                                    {update.changes.map((change, i) => (
                                        <li key={i} className="flex items-start gap-2 text-gray-300">
                                            <span className="text-green-400 mt-1">✓</span>
                                            {change}
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}

// Roadmap Section - Interactive Timeline for Shareholders
const Roadmap = () => {
    const [activePhase, setActivePhase] = useState(0)
    
    const phases = [
        {
            phase: 1,
            title: "Foundation",
            date: "Dec 16 - Jan 5",
            status: "upcoming",
            icon: "🏗️",
            color: "purple",
            summary: "Building the Multi-Token Engine",
            description: "Transform TopBlast from a single-token protocol into a platform capable of supporting any token.",
            milestones: [
                { task: "Multi-token architecture", detail: "Platform tracks multiple tokens simultaneously" },
                { task: "Isolated reward pools", detail: "Each token gets its own independent reward pool" },
                { task: "Shared infrastructure", detail: "Common VWAP and eligibility calculation engine" },
            ],
            deliverable: "Internal demo with 2+ tokens running Loss-Mining"
        },
        {
            phase: 2,
            title: "Onboarding Flow",
            date: "Jan 6 - Jan 26",
            status: "upcoming",
            icon: "🚀",
            color: "blue",
            summary: "Making It Easy to Launch",
            description: "Self-service portal where any token creator can integrate TopBlast mechanics.",
            milestones: [
                { task: "Token creator dashboard", detail: "Simple UI to input token address and configure" },
                { task: "Parameter customization", detail: "Choose payout interval, fee split, thresholds" },
                { task: "Preview & simulation", detail: "Test your configuration before going live" },
            ],
            deliverable: "Working 'Create Your TopBlast Pool' wizard"
        },
        {
            phase: 3,
            title: "Payment & Burn",
            date: "Jan 27 - Feb 16",
            status: "upcoming",
            icon: "🔥",
            color: "orange",
            summary: "TBLAST Deflationary Mechanics",
            description: "Platform fees automatically buy TBLAST from the market and burn it forever.",
            milestones: [
                { task: "Payment integration", detail: "Accept SOL/USDC for platform access" },
                { task: "Auto-buy mechanism", detail: "Payments swap to TBLAST on Jupiter" },
                { task: "Burn execution", detail: "Purchased TBLAST sent to burn address" },
            ],
            deliverable: "First external token pays to join, TBLAST burned on-chain"
        },
        {
            phase: 4,
            title: "Public Launch",
            date: "Feb 17 - Mar 9",
            status: "upcoming",
            icon: "🌍",
            color: "green",
            summary: "Opening the Platform",
            description: "Full public launch with marketing push and partner tokens.",
            milestones: [
                { task: "Public dashboard", detail: "Browse all TopBlast-enabled tokens" },
                { task: "Documentation & guides", detail: "Complete integration tutorials" },
                { task: "Launch partners", detail: "5+ tokens debut with TopBlast mechanics" },
            ],
            deliverable: "Public platform with 5+ integrated tokens"
        },
        {
            phase: 5,
            title: "Scale & Optimize",
            date: "Mar 10 - Mar 31",
            status: "upcoming",
            icon: "📈",
            color: "emerald",
            summary: "Ready for Growth",
            description: "Analytics, API access, and infrastructure for mass adoption.",
            milestones: [
                { task: "Analytics dashboard", detail: "Burn stats, total value distributed, active pools" },
                { task: "Public API", detail: "Let other platforms integrate TopBlast" },
                { task: "Performance optimization", detail: "Handle 100+ concurrent pools" },
            ],
            deliverable: "Full SaaS platform live - Q1 Complete ✅"
        }
    ]
    
    const getStatusColor = (status: string, color: string) => {
        if (status === 'complete') return 'bg-green-500'
        if (status === 'in-progress') return 'bg-yellow-500 animate-pulse'
        return `bg-${color}-500/30`
    }
    
    const getPhaseColor = (color: string) => {
        const colors: Record<string, string> = {
            purple: 'from-purple-500 to-purple-600',
            blue: 'from-blue-500 to-blue-600',
            orange: 'from-orange-500 to-orange-600',
            green: 'from-green-500 to-green-600',
            emerald: 'from-emerald-500 to-emerald-600',
        }
        return colors[color] || 'from-gray-500 to-gray-600'
    }

    return (
        <section id="roadmap" className="py-24 relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-900/5 to-transparent" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/5 rounded-full blur-3xl" />
            
            <div className="glass-section-bg relative z-10">
                <div className="max-w-6xl mx-auto px-4">
                    <motion.div 
                        className="text-center mb-16"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <span className="inline-block px-4 py-1 bg-gradient-to-r from-purple-500/20 to-green-500/20 border border-purple-500/30 rounded-full text-purple-400 text-sm font-medium mb-4">
                            🗺️ SHAREHOLDER ROADMAP
                        </span>
                        <h2 className="text-4xl md:text-5xl font-bold mb-4">
                            Platform <span className="bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text text-transparent">Evolution</span>
                        </h2>
                        <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                            From single-token protocol to Loss-Mining as a Service. 
                            <span className="text-green-400 font-semibold"> Target: End of Q1 2025</span>
                        </p>
                    </motion.div>

                    {/* Timeline Navigation */}
                    <div className="relative mb-12">
                        {/* Progress Line */}
                        <div className="absolute top-6 left-0 right-0 h-1 bg-gray-800 rounded-full hidden md:block">
                            <motion.div 
                                className="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-green-500 rounded-full"
                                initial={{ width: '0%' }}
                                whileInView={{ width: `${((activePhase + 1) / phases.length) * 100}%` }}
                                viewport={{ once: true }}
                                transition={{ duration: 1, delay: 0.5 }}
                            />
                        </div>
                        
                        {/* Phase Buttons */}
                        <div className="flex justify-between relative">
                            {phases.map((phase, idx) => (
                                <motion.button
                                    key={idx}
                                    onClick={() => setActivePhase(idx)}
                                    className={`flex flex-col items-center group ${idx <= activePhase ? 'cursor-pointer' : 'cursor-pointer'}`}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: idx * 0.1 }}
                                    whileHover={{ scale: 1.05 }}
                                >
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-2 transition-all duration-300 ${
                                        idx === activePhase 
                                            ? `bg-gradient-to-r ${getPhaseColor(phase.color)} shadow-lg shadow-${phase.color}-500/30` 
                                            : 'bg-gray-800 group-hover:bg-gray-700'
                                    }`}>
                                        {phase.icon}
                                    </div>
                                    <span className={`text-xs font-medium hidden md:block transition-colors ${
                                        idx === activePhase ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'
                                    }`}>
                                        Phase {phase.phase}
                                    </span>
                                </motion.button>
                            ))}
                        </div>
                    </div>

                    {/* Active Phase Details */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activePhase}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                            className="glass-panel rounded-2xl p-8 border border-gray-800"
                        >
                            <div className="flex flex-col lg:flex-row gap-8">
                                {/* Left: Phase Info */}
                                <div className="lg:w-1/3">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="text-4xl">{phases[activePhase].icon}</span>
                                        <div>
                                            <h3 className="text-2xl font-bold">{phases[activePhase].title}</h3>
                                            <p className="text-gray-400 text-sm">{phases[activePhase].date}</p>
                                        </div>
                                    </div>
                                    <p className="text-lg text-green-400 font-semibold mb-3">
                                        {phases[activePhase].summary}
                                    </p>
                                    <p className="text-gray-400 mb-6">
                                        {phases[activePhase].description}
                                    </p>
                                    <div className="p-4 bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-lg border border-green-500/30">
                                        <p className="text-xs text-green-400 uppercase tracking-wider mb-1">Deliverable</p>
                                        <p className="text-white font-medium">{phases[activePhase].deliverable}</p>
                                    </div>
                                </div>
                                
                                {/* Right: Milestones */}
                                <div className="lg:w-2/3">
                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Key Milestones</h4>
                                    <div className="space-y-4">
                                        {phases[activePhase].milestones.map((milestone, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.1 }}
                                                className="flex items-start gap-4 p-4 bg-gray-900/50 rounded-lg hover:bg-gray-900 transition-colors"
                                            >
                                                <div className={`w-8 h-8 rounded-full bg-gradient-to-r ${getPhaseColor(phases[activePhase].color)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                                                    {idx + 1}
                                                </div>
                                                <div>
                                                    <h5 className="font-semibold text-white mb-1">{milestone.task}</h5>
                                                    <p className="text-gray-400 text-sm">{milestone.detail}</p>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    {/* Navigation Arrows */}
                    <div className="flex justify-center gap-4 mt-8">
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setActivePhase(Math.max(0, activePhase - 1))}
                            disabled={activePhase === 0}
                            className={`p-3 rounded-full ${activePhase === 0 ? 'bg-gray-800 text-gray-600' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        </motion.button>
                        <div className="flex items-center gap-2">
                            {phases.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setActivePhase(idx)}
                                    className={`w-2 h-2 rounded-full transition-all ${idx === activePhase ? 'bg-green-400 w-6' : 'bg-gray-600 hover:bg-gray-500'}`}
                                />
                            ))}
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setActivePhase(Math.min(phases.length - 1, activePhase + 1))}
                            disabled={activePhase === phases.length - 1}
                            className={`p-3 rounded-full ${activePhase === phases.length - 1 ? 'bg-gray-800 text-gray-600' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </motion.button>
                    </div>

                    {/* Value Proposition for TBLAST Holders */}
                    <motion.div 
                        className="mt-16 grid md:grid-cols-3 gap-6"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <div className="glass-panel rounded-xl p-6 text-center border border-orange-500/30 bg-gradient-to-b from-orange-900/10 to-transparent">
                            <div className="text-4xl mb-3">🔥</div>
                            <h4 className="font-bold text-lg mb-2">Deflationary Pressure</h4>
                            <p className="text-gray-400 text-sm">Every token that joins = TBLAST bought and burned forever</p>
                        </div>
                        <div className="glass-panel rounded-xl p-6 text-center border border-green-500/30 bg-gradient-to-b from-green-900/10 to-transparent">
                            <div className="text-4xl mb-3">💰</div>
                            <h4 className="font-bold text-lg mb-2">Revenue Sharing</h4>
                            <p className="text-gray-400 text-sm">Platform fees flow back to TBLAST reward pool</p>
                        </div>
                        <div className="glass-panel rounded-xl p-6 text-center border border-purple-500/30 bg-gradient-to-b from-purple-900/10 to-transparent">
                            <div className="text-4xl mb-3">🗳️</div>
                            <h4 className="font-bold text-lg mb-2">Future Governance</h4>
                            <p className="text-gray-400 text-sm">TBLAST holders vote on new token listings</p>
                        </div>
                    </motion.div>

                    {/* Q1 Target Banner */}
                    <motion.div 
                        className="mt-12 text-center p-6 rounded-xl bg-gradient-to-r from-green-900/30 via-emerald-900/30 to-green-900/30 border border-green-500/30"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                    >
                        <p className="text-green-400 font-mono text-lg">
                            📅 TARGET COMPLETION: <span className="text-white font-bold">MARCH 31, 2025</span>
                        </p>
                        <p className="text-gray-400 text-sm mt-2">Full SaaS platform with 10+ integrated tokens</p>
                    </motion.div>
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
                    <p className="mb-4">Most tokens are a PVP battle where you only win if the price goes up. <strong className="text-white">Topblast flips this dynamic.</strong> It acts as volatility insurance for your portfolio, creating an asymmetric bet where downside volatility can result in upside payouts.</p>
                    <p className="mb-4 text-white"><strong>The Win-Win Scenario:</strong></p>
                    <ul className="list-disc pl-5 space-y-2 mb-4">
                        <li><strong className="text-green-400">Scenario A (Price Pumps):</strong> You hold the token, the value increases, and you sell for profit. Standard moon mission. You win.</li>
                        <li><strong className="text-red-400">Scenario B (Price Dumps):</strong> The market crashes. Paper hands sell. But you hold. Your drawdown % increases, shooting you up the Blaster Leaderboard. You win the 2-hour jackpot (80% of the pool).</li>
                    </ul>
                    <div className="mt-4 p-4 bg-green-900/20 border border-green-500/30 rounded text-sm text-green-300 italic">
                        &quot;In a market of gambling, be the casino. If you can&apos;t be the casino, be the player who gets paid to lose.&quot;
                    </div>
                </>
            )
        },
        {
            title: "2.0 Core Mechanics: VWAP & Drawdown",
            content: (
                <>
                    <p className="mb-4">Topblast uses real on-chain data to calculate your position. Everything is transparent and verifiable.</p>
                    <h4 className="text-white font-bold mt-4 mb-2">Volume-Weighted Average Price (VWAP)</h4>
                    <p className="mb-4">The system tracks every wallet&apos;s entry price from on-chain buy transactions. Your VWAP updates as you buy more tokens.</p>
                    <code className="block bg-gray-900 p-3 rounded text-xs mb-4 text-green-400 font-mono">
                        VWAP = Total Cost Basis / Total Tokens Bought<br/>
                        Total Cost Basis = Σ(SOL spent × SOL price) + Σ(stablecoin spent)
                    </code>
                    <h4 className="text-white font-bold mt-4 mb-2">Drawdown Calculation</h4>
                    <code className="block bg-gray-900 p-3 rounded text-xs mb-4 text-green-400 font-mono">
                        Drawdown % = ((Current Price - VWAP) / VWAP) × 100
                    </code>
                    <h4 className="text-white font-bold mt-4 mb-2">Ranking Logic</h4>
                    <ol className="list-decimal pl-5 space-y-1 mb-4">
                        <li><strong>Primary:</strong> Drawdown % (most negative first)</li>
                        <li><strong>Tiebreaker:</strong> Absolute USD loss (bigger loss wins)</li>
                    </ol>
                </>
            )
        },
        {
            title: "3.0 Eligibility Rules",
            content: (
                <>
                    <p className="mb-4">These rules prevent gaming and ensure genuine diamond hands are rewarded.</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                        <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-3 text-center">
                            <div className="text-xs text-gray-400 uppercase">Min Balance</div>
                            <div className="text-xl font-bold text-green-400 font-mono">100K</div>
                            <div className="text-xs text-gray-500">$TBLAST</div>
                        </div>
                        <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-3 text-center">
                            <div className="text-xs text-gray-400 uppercase">Hold Time</div>
                            <div className="text-xl font-bold text-green-400 font-mono">1 hr</div>
                            <div className="text-xs text-gray-500">minimum</div>
                        </div>
                        <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-3 text-center">
                            <div className="text-xs text-gray-400 uppercase">Min Loss</div>
                            <div className="text-xl font-bold text-green-400 font-mono">10%</div>
                            <div className="text-xs text-gray-500">of pool</div>
                        </div>
                        <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-3 text-center">
                            <div className="text-xs text-gray-400 uppercase">Min Pool</div>
                            <div className="text-xl font-bold text-green-400 font-mono">$50</div>
                            <div className="text-xs text-gray-500">for payout</div>
                        </div>
                    </div>

                    <h4 className="text-white font-bold mt-4 mb-2">❌ Disqualification Triggers</h4>
                    <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4">
                        <ul className="space-y-2">
                            <li className="flex items-start gap-2">
                                <span className="text-red-400">•</span>
                                <div><strong className="text-white">Sold tokens:</strong> Immediate disqualification</div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-red-400">•</span>
                                <div><strong className="text-white">Transferred OUT:</strong> 2 hour cooldown</div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-red-400">•</span>
                                <div><strong className="text-white">Won last cycle:</strong> 1 cycle cooldown</div>
                            </li>
                        </ul>
                    </div>
                </>
            )
        },
        {
            title: "4.0 Payout Distribution",
            content: (
                <>
                    <p className="mb-4">Every 2 hours, the reward pool is distributed to the top 3 losers automatically.</p>
                    <div className="flex gap-2 h-20 mb-6">
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
                    <div className="p-4 bg-green-900/20 border border-green-500/30 rounded">
                        <p className="text-green-300 font-bold mb-2">🎯 Zero Interaction Required</p>
                        <p className="text-gray-400 text-sm">Just buy and hold. Winners receive tokens directly in their wallets. Check your ranking on the <a href={`${APP_URL}/leaderboard`} target="_blank" rel="noopener noreferrer" className="text-green-400 underline hover:text-green-300">live leaderboard</a>.</p>
                    </div>
                </>
            )
        },
        {
            title: "5.0 How to Participate",
            content: (
                <>
                    <p className="mb-4"><strong className="text-white">No wallet connection to our site required.</strong></p>
                    
                    <div className="space-y-4">
                        <div className="flex items-start gap-4 p-4 bg-gray-900/50 rounded-lg">
                            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-black font-bold text-lg shrink-0">1</div>
                            <div>
                                <h4 className="text-white font-bold mb-1">Buy $TBLAST</h4>
                                <p className="text-gray-400 text-sm">Purchase tokens on any DEX (Raydium, Jupiter) after bonding completes on pump.fun.</p>
                            </div>
                        </div>
                        
                        <div className="flex items-start gap-4 p-4 bg-gray-900/50 rounded-lg">
                            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-black font-bold text-lg shrink-0">2</div>
                            <div>
                                <h4 className="text-white font-bold mb-1">Hold for 2+ Hours</h4>
                                <p className="text-gray-400 text-sm">Your tokens must be held for at least 2 hours before eligibility. Don&apos;t sell. Don&apos;t transfer.</p>
                            </div>
                        </div>
                        
                        <div className="flex items-start gap-4 p-4 bg-gray-900/50 rounded-lg">
                            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-black font-bold text-lg shrink-0">3</div>
                            <div>
                                <h4 className="text-white font-bold mb-1">Watch &amp; Win</h4>
                                <p className="text-gray-400 text-sm">Check the <a href={`${APP_URL}/leaderboard`} target="_blank" rel="noopener noreferrer" className="text-green-400 underline">live leaderboard</a>. If you&apos;re top 3, tokens are sent automatically.</p>
                            </div>
                        </div>
                    </div>
                </>
            )
        },
        {
            title: "6.0 FAQ",
            content: (
                <>
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-white font-bold mb-2">How do I check my ranking?</h4>
                            <p className="text-gray-400">Visit the <a href={`${APP_URL}/leaderboard`} target="_blank" rel="noopener noreferrer" className="text-green-400 underline">live leaderboard</a>. All data is public—no wallet connection needed.</p>
                        </div>
                        <div>
                            <h4 className="text-white font-bold mb-2">Is this gambling?</h4>
                            <p className="text-gray-400">No. Payouts are deterministic based on your holdings and price. There&apos;s no randomness—it&apos;s a structured reward system for diamond hands.</p>
                        </div>
                        <div>
                            <h4 className="text-white font-bold mb-2">Can I win multiple times?</h4>
                            <p className="text-gray-400">Yes, but not consecutively. Winners sit out 1 cycle and their VWAP resets to current price.</p>
                        </div>
                        <div>
                            <h4 className="text-white font-bold mb-2">How big can payouts get?</h4>
                            <p className="text-gray-400">The pool grows with trading volume. More volume = more fees = bigger pool. Check current pool size on the <a href={`${APP_URL}/stats`} target="_blank" rel="noopener noreferrer" className="text-green-400 underline">stats page</a>.</p>
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
                    <div className="text-center mb-12">
                        <span className="inline-block px-4 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-400 text-sm font-medium mb-4">
                            DOCUMENTATION
                        </span>
                        <h2 className="text-4xl font-bold mb-4">Whitepaper <span className="text-green-500 text-sm align-top">v2.1</span></h2>
                        <p className="text-gray-400">Complete technical documentation of the Topblast protocol.</p>
                    </div>
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
        <footer className="py-12 border-t border-gray-900/50 bg-black/60 backdrop-blur-md relative z-10">
            <div className="max-w-7xl mx-auto px-4">
                {/* CTA Banner */}
                <motion.div 
                    className="glass-panel rounded-2xl p-8 mb-12 text-center border border-green-500/30 bg-gradient-to-r from-green-900/20 to-purple-900/20"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                >
                    <h3 className="text-3xl font-bold mb-4">Ready to Start Winning by Losing?</h3>
                    <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
                        Join the first protocol where your losses can become wins. Check the live leaderboard, see current rankings, and watch your position.
                    </p>
                    <a href={APP_URL} target="_blank" rel="noopener noreferrer">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="bg-gradient-to-r from-green-400 to-emerald-500 text-black px-10 py-4 rounded-lg font-bold text-lg shadow-[0_0_30px_rgba(20,241,149,0.4)] hover:shadow-[0_0_40px_rgba(20,241,149,0.6)] transition-all"
                        >
                            Launch App at topblastweb3.xyz →
                        </motion.button>
                    </a>
                </motion.div>

                {/* Links */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded overflow-hidden">
                            <Image src="/logo.jpg" alt="TopBlast" width={32} height={32} className="w-full h-full object-cover" />
                        </div>
                        <span className="font-bold text-white">TOPBLAST</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <a href={APP_URL} target="_blank" rel="noopener noreferrer" className="hover:text-green-400 transition-colors flex items-center gap-1">
                            App <Icons.ExternalLink />
                        </a>
                        <a href={`${APP_URL}/leaderboard`} target="_blank" rel="noopener noreferrer" className="hover:text-green-400 transition-colors">Leaderboard</a>
                        <a href={`${APP_URL}/history`} target="_blank" rel="noopener noreferrer" className="hover:text-green-400 transition-colors">History</a>
                        <a href={`${APP_URL}/stats`} target="_blank" rel="noopener noreferrer" className="hover:text-green-400 transition-colors">Stats</a>
                        {/* Social Links */}
                        <div className="flex items-center gap-4 border-l border-white/10 pl-4">
                            <a href={LINKS.twitter} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1" title="Follow on X">
                                <Icons.XTwitter /> 
                            </a>
                            <a href={LINKS.github} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1" title="GitHub">
                                <Icons.GitHub />
                            </a>
                        </div>
                    </div>
                    <p>&copy; 2025 Topblast Protocol. Built on Solana.</p>
                </div>
            </div>
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
                <WhyInvest />
                <Mechanism />
                <Tokenomics />
                <Whitepaper />
                <UpdateLog />
                <Roadmap />
                <Footer />
            </div>
            
            {/* Fixed Countdown (stays visible) */}
            <CountDown />
        </div>
    )
}
