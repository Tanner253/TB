'use client'

/**
 * BLAST OFF — the TopBlast waiting-room game.
 *
 * Blasty bought the top. Charge the blast and launch them out of the water —
 * every meter flown is a dollar "recovered". Collect SOL coins mid-air and
 * spend them on upgrades that launch you further. Progress lives in
 * localStorage; sounds ride the existing WebAudio synth.
 *
 * Canvas 2D + requestAnimationFrame, pointer events — works on mobile.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { AppHeader } from '@/components/platform/AppHeader'
import {
  WHALE_HAPPY_SVG,
  WHALE_IDLE_SVG,
  WHALE_ROCKET_SVG,
  loadSprite,
} from '@/lib/game/whaleSprites'
import { playPop, playPayoutFanfare, playWhaleCall, playTick } from '@/hooks/useSoundEffects'

const STORE_KEY = 'tb-game-v1'

interface Upgrades {
  rocket: number
  fins: number
  spout: number
  hands: number
}

interface GameStore {
  coins: number
  best: number
  up: Upgrades
}

const DEFAULT_STORE: GameStore = { coins: 0, best: 0, up: { rocket: 0, fins: 0, spout: 0, hands: 0 } }

const UPGRADE_DEFS: {
  key: keyof Upgrades
  emoji: string
  name: string
  blurb: string
  max: number
}[] = [
  { key: 'rocket', emoji: '🚀', name: 'Rocket Booster', blurb: 'Launch harder. Way harder.', max: 8 },
  { key: 'fins', emoji: '🐬', name: 'Slippery Fins', blurb: 'Cut through the air with less drag.', max: 8 },
  { key: 'spout', emoji: '💦', name: 'Spout Cannon', blurb: '+1 mid-air boost per level. Tap while flying!', max: 5 },
  { key: 'hands', emoji: '💎', name: 'Diamond Hands', blurb: 'Bounce off the water instead of sinking.', max: 5 },
]

function upgradeCost(level: number): number {
  return Math.round(10 * Math.pow(2.1, level))
}

function loadStore(): GameStore {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return DEFAULT_STORE
    const parsed = JSON.parse(raw) as Partial<GameStore>
    return {
      coins: parsed.coins ?? 0,
      best: parsed.best ?? 0,
      up: { ...DEFAULT_STORE.up, ...(parsed.up ?? {}) },
    }
  } catch {
    return DEFAULT_STORE
  }
}

function saveStore(s: GameStore) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s))
  } catch {
    /* non-persistent */
  }
}

type Phase = 'loading' | 'ready' | 'charging' | 'flying' | 'done'

/**
 * Mid-air pickups (mechanics ported from bball.fun's layered spawner):
 *  coin    — +1 ◎, tiny lift
 *  ring    — violet boost ring (low sky): forward + up
 *  jet     — golden jetstream ring (mid sky): bigger kick
 *  balloon — party balloon (mid sky): big vertical pop
 *  sat     — satellite (space band): mega boost + bonus coins
 *  bear    — bear-market cloud (mid sky hazard): kills momentum
 *  pump    — green candle buoy on the water: vertical relaunch
 *  red     — red candle buoy on the water: momentum killer
 *  wick    — rare white god candle: vertical moonshot
 */
type PickupType = 'coin' | 'ring' | 'jet' | 'balloon' | 'sat' | 'bear' | 'pump' | 'red' | 'wick'

interface Pickup {
  type: PickupType
  x: number
  y: number
  taken: boolean
  wobble: number
}

const PICKUP_REACH: Record<PickupType, number> = {
  coin: 46,
  ring: 58,
  jet: 64,
  balloon: 58,
  sat: 70,
  bear: 80,
  pump: 60,
  red: 60,
  wick: 66,
}

/** Water-surface buoys bob on the waves instead of holding a fixed y. */
const BUOYS = new Set<PickupType>(['pump', 'red', 'wick'])
const HAZARDS = new Set<PickupType>(['bear', 'red'])

/** Distance milestones ($ = meters) with announcer lines. */
const MILESTONES: { at: number; text: string }[] = [
  { at: 150, text: '$150 — WARMING UP' },
  { at: 300, text: '$300 — CRUISING' },
  { at: 600, text: '$600 — SENDING IT' },
  { at: 1000, text: '$1K RECOVERED!!' },
  { at: 2000, text: '$2K — GENERATIONAL RECOVERY' },
  { at: 4000, text: '$4K — WHALE HISTORY' },
]

interface RunResult {
  distance: number
  coins: number
  newBest: boolean
}

export default function BlastOffPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [store, setStore] = useState<GameStore>(DEFAULT_STORE)
  const [phase, setPhase] = useState<Phase>('loading')
  const [power, setPower] = useState(0)
  const [hud, setHud] = useState({ distance: 0, coins: 0, spout: 0 })
  const [result, setResult] = useState<RunResult | null>(null)

  // refs the game loop reads without re-rendering
  const storeRef = useRef(store)
  const phaseRef = useRef<Phase>('loading')
  // bumping this key remounts the canvas and re-runs the engine effect
  const [runKey, setRunKey] = useState(0)

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }, [])

  useEffect(() => {
    const s = loadStore()
    setStore(s)
    storeRef.current = s
  }, [])

  useEffect(() => {
    storeRef.current = store
  }, [store])

  const buyUpgrade = (key: keyof Upgrades) => {
    setStore(prev => {
      const level = prev.up[key]
      const def = UPGRADE_DEFS.find(d => d.key === key)
      if (!def || level >= def.max) return prev
      const cost = upgradeCost(level)
      if (prev.coins < cost) return prev
      playPop()
      const next: GameStore = {
        ...prev,
        coins: prev.coins - cost,
        up: { ...prev.up, [key]: level + 1 },
      }
      saveStore(next)
      return next
    })
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let disposed = false
    let W = 0
    let H = 0
    let dpr = 1

    // sprites
    let idleImg: HTMLImageElement | null = null
    let happyImg: HTMLImageElement | null = null
    let rocketImg: HTMLImageElement | null = null

    // world
    const START_X = 130
    const PX_PER_M = 10
    let waterY = 0
    const whale = { x: START_X, y: 0, vx: 0, vy: 0, r: 34, angle: 0 }
    let camX = 0
    let camY = 0
    let t = 0
    let chargeT = 0
    let bounces = 0
    let spoutCharges = 0
    let runCoins = 0
    let pickups: Pickup[] = []
    let genFrontier = 0
    let splashes: { x: number; y: number; vx: number; vy: number; life: number }[] = []
    let settleFrames = 0
    // announcer flash + screen shake (frames)
    let flashText = ''
    let flashT = 0
    let shakeT = 0
    let milestoneIdx = 0
    let nearMissed: Set<Pickup> = new Set()

    function announce(text: string, shake = 0) {
      flashText = text
      flashT = 110
      shakeT = Math.max(shakeT, shake)
    }

    function resize() {
      if (!canvas) return
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (!rect) return
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = Math.floor(rect.width)
      H = Math.floor(Math.min(Math.max(window.innerHeight * 0.58, 380), 620))
      canvas.width = W * dpr
      canvas.height = H * dpr
      canvas.style.height = `${H}px`
      waterY = H - 64
    }

    function resetRun() {
      whale.x = START_X
      whale.y = waterY - 14
      whale.vx = 0
      whale.vy = 0
      whale.angle = 0
      camX = 0
      camY = 0
      bounces = 0
      runCoins = 0
      spoutCharges = storeRef.current.up.spout
      pickups = []
      genFrontier = 500
      splashes = []
      settleFrames = 0
      flashText = ''
      flashT = 0
      shakeT = 0
      milestoneIdx = 0
      nearMissed = new Set()
      setHud({ distance: 0, coins: 0, spout: storeRef.current.up.spout })
    }

    function isDark() {
      return document.documentElement.classList.contains('dark')
    }

    function rngFor(i: number, salt: number) {
      const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
      return x - Math.floor(x)
    }

    function addPickup(type: PickupType, x: number, y: number) {
      pickups.push({ type, x, y, taken: false, wobble: Math.random() * Math.PI * 2 })
    }

    /** Coin pattern at a base altitude: arc, line, or rising stair. */
    function spawnCoinPattern(x: number, baseY: number) {
      const kind = Math.floor(Math.random() * 3)
      const n = 4 + Math.floor(Math.random() * 5)
      for (let j = 0; j < n; j++) {
        const y =
          kind === 0
            ? baseY - Math.sin((j / (n - 1)) * Math.PI) * 55 // arc
            : kind === 1
              ? baseY // line
              : baseY - j * 26 // rising stair
        addPickup('coin', x + j * 42, y)
      }
    }

    /**
     * Layered spawner (bball.fun style) — every slot rolls each altitude band
     * independently so the surface, low sky, mid sky and space stay populated.
     */
    function spawnAhead() {
      while (genFrontier < whale.x + W * 2) {
        const x = genFrontier

        // --- Surface lane (buoys riding the water) — kept sparse on purpose
        const sr = Math.random()
        let th = 0
        if (x > 2500 && sr < (th += 0.012)) {
          addPickup('wick', x, waterY) // rare god candle — moonshot
        } else if (x > 1200 && sr < (th += 0.09)) {
          addPickup('red', x, waterY) // momentum killer
        } else if (x > 800 && sr < (th += 0.07)) {
          addPickup('pump', x, waterY) // green candle — number go up
        }

        // --- Low sky: bread-and-butter coins and boost rings
        if (Math.random() < 0.3) {
          spawnCoinPattern(x, waterY - 100 - Math.random() * 160)
        }
        if (Math.random() < 0.15) {
          addPickup('ring', x + 60, waterY - 110 - Math.random() * 170)
        }

        // --- Mid sky: jets, balloons, bear clouds, more coins
        if (x > 900) {
          if (Math.random() < 0.17) {
            spawnCoinPattern(x + 50, waterY - 280 - Math.random() * 220)
          }
          const mr = Math.random()
          if (mr < 0.1) {
            addPickup('jet', x + 30, waterY - 280 - Math.random() * 230)
          } else if (mr < 0.19) {
            addPickup('balloon', x + 90, waterY - 260 - Math.random() * 240)
          } else if (mr < 0.27 && x > 1600) {
            addPickup('bear', x + 50, waterY - 260 - Math.random() * 260)
          }
        }

        // --- Space band: satellites and star coins
        if (x > 2200) {
          if (Math.random() < 0.16) {
            spawnCoinPattern(x + 60, waterY - 580 - Math.random() * 320)
          }
          if (Math.random() < 0.12) {
            addPickup('sat', x + 40, waterY - 600 - Math.random() * 320)
          }
        }

        genFrontier += 150 + Math.random() * 140
      }
      if (pickups.length > 400) {
        pickups = pickups.filter(p => !p.taken && p.x > camX - 200)
      }
    }

    function launch(powerNow: number) {
      const up = storeRef.current.up
      const speed = 12.5 + powerNow * 16 + up.rocket * 2.7
      const angle = (52 * Math.PI) / 180
      whale.vx = Math.cos(angle) * speed
      whale.vy = -Math.sin(angle) * speed
      bounces = 0
      playPayoutFanfare()
      setPhaseBoth('flying')
    }

    function spoutBoost() {
      if (spoutCharges <= 0) return
      spoutCharges -= 1
      // strong vertical kick — cancel any fall, then punch upward
      whale.vy = Math.min(whale.vy, 0) - 11
      whale.vx += 2.5
      playWhaleCall()
      for (let i = 0; i < 8; i++) {
        splashes.push({
          x: whale.x,
          y: whale.y + 20,
          vx: (Math.random() - 0.5) * 4,
          vy: 2 + Math.random() * 3,
          life: 26,
        })
      }
      setHud(h => ({ ...h, spout: spoutCharges }))
    }

    /** Wave-riding y for surface buoys. */
    function buoyY(p: Pickup) {
      return waterY - 20 + Math.sin((p.x + t * 2.5) * 0.02 + p.wobble) * 4
    }

    function splashBurst(x: number, y: number, n: number) {
      for (let i = 0; i < n; i++) {
        splashes.push({
          x: x + (Math.random() - 0.5) * 40,
          y,
          vx: (Math.random() - 0.5) * 5,
          vy: -(2 + Math.random() * 5),
          life: 30,
        })
      }
    }

    function collectPickups() {
      for (const p of pickups) {
        if (p.taken) continue
        const py = BUOYS.has(p.type) ? buoyY(p) : p.y
        const dx = p.x - whale.x
        const dy = py - whale.y
        const reach = PICKUP_REACH[p.type]
        if (dx * dx + dy * dy > reach * reach) continue
        p.taken = true
        switch (p.type) {
          case 'coin':
            runCoins += 1
            whale.vy -= 0.5
            playPop()
            setHud(h => ({ ...h, coins: runCoins }))
            break
          case 'ring':
            whale.vx += 3
            whale.vy = Math.min(whale.vy, 0) - 7
            playPop()
            splashBurst(p.x, py, 6)
            break
          case 'jet':
            whale.vx += 5
            whale.vy = Math.min(whale.vy, 0) - 9
            announce('JETSTREAM! 🚀', 10)
            playWhaleCall()
            splashBurst(p.x, py, 8)
            break
          case 'balloon':
            whale.vy = Math.min(whale.vy, 0) - 12
            whale.vx += 1.5
            announce('POP! 🎈', 8)
            playPop()
            break
          case 'sat':
            runCoins += 5
            whale.vx += 8
            whale.vy -= 4
            announce('SATELLITE SLING! 🛰️ +5◎', 26)
            playPayoutFanfare()
            setHud(h => ({ ...h, coins: runCoins }))
            break
          case 'pump':
            whale.vy = Math.min(whale.vy, 0) - 13
            whale.vx += 1
            announce('GREEN CANDLE! 📈', 14)
            playWhaleCall()
            splashBurst(p.x, waterY, 12)
            break
          case 'wick':
            whale.vy = Math.min(whale.vy, 0) - 18
            whale.vx += 1
            announce('GOD CANDLE! 🕯️', 34)
            playPayoutFanfare()
            splashBurst(p.x, waterY, 16)
            break
          case 'bear':
            whale.vx *= 0.62
            whale.vy *= 0.7
            announce('BEAR MARKET 🐻', 18)
            playTick()
            break
          case 'red':
            whale.vx *= 0.68
            announce('RUGGED 📉', 14)
            playTick()
            splashBurst(p.x, waterY, 8)
            break
        }
      }
    }

    /** Shaving past a hazard at speed grants a small boost + CLOSE CALL. */
    function checkNearMisses() {
      if (Math.hypot(whale.vx, whale.vy) < 9) return
      for (const p of pickups) {
        if (p.taken || !HAZARDS.has(p.type) || nearMissed.has(p)) continue
        if (whale.x < p.x + 10 || whale.x > p.x + 140) continue
        const py = BUOYS.has(p.type) ? buoyY(p) : p.y
        const d = Math.hypot(whale.x - p.x, whale.y - py)
        const reach = PICKUP_REACH[p.type]
        if (d > reach && d <= reach + 38) {
          nearMissed.add(p)
          whale.vx *= 1.05
          announce('CLOSE CALL!', 6)
          playPop()
        }
      }
    }

    function endRun() {
      if (phaseRef.current === 'done') return
      setPhaseBoth('done')
      const distance = Math.max(0, Math.round((whale.x - START_X) / PX_PER_M))
      const earned = runCoins
      setStore(prev => {
        const next: GameStore = {
          ...prev,
          coins: prev.coins + earned,
          best: Math.max(prev.best, distance),
        }
        saveStore(next)
        return next
      })
      setResult({ distance, coins: earned, newBest: distance > storeRef.current.best })
    }

    function step() {
      t += 1
      const up = storeRef.current.up

      if (phaseRef.current === 'charging') {
        chargeT += 1
        const p = (Math.sin(chargeT * 0.052 - Math.PI / 2) + 1) / 2
        setPower(p)
      }

      if (phaseRef.current === 'flying') {
        whale.vy = Math.min(13, whale.vy + 0.32)
        whale.vx *= 0.9985 + up.fins * 0.00035
        whale.x += whale.vx
        whale.y += whale.vy
        whale.angle = Math.atan2(whale.vy, Math.max(6, whale.vx)) * 0.6

        spawnAhead()
        collectPickups()
        checkNearMisses()

        // Distance milestones — announcer flash + screen shake
        const meters = Math.round((whale.x - START_X) / PX_PER_M)
        const nextMs = MILESTONES[milestoneIdx]
        if (nextMs && meters >= nextMs.at) {
          milestoneIdx += 1
          announce(nextMs.text, 30)
          playWhaleCall()
        }

        if (whale.y >= waterY - 12) {
          whale.y = waterY - 12
          for (let i = 0; i < 12; i++) {
            splashes.push({
              x: whale.x + (Math.random() - 0.5) * 40,
              y: waterY,
              vx: (Math.random() - 0.5) * 5,
              vy: -(2 + Math.random() * 5),
              life: 30,
            })
          }
          const canBounce = bounces < up.hands && Math.abs(whale.vy) > 2.5
          if (canBounce) {
            bounces += 1
            whale.vy = -Math.max(Math.abs(whale.vy) * (0.62 + up.hands * 0.05), 7)
            whale.vx *= 0.9
            playWhaleCall()
          } else {
            whale.vy = 0
            whale.vx *= 0.82
            settleFrames += 1
            if (Math.abs(whale.vx) < 0.6 || settleFrames > 90) {
              endRun()
            }
          }
        }

        camX = Math.max(0, whale.x - W * 0.34)
        camY = Math.min(0, whale.y - H * 0.42)
        setHud(h => ({
          ...h,
          distance: Math.max(h.distance, Math.round((whale.x - START_X) / PX_PER_M)),
        }))
      }

      for (const s of splashes) {
        s.x += s.vx
        s.y += s.vy
        s.vy += 0.3
        s.life -= 1
      }
      splashes = splashes.filter(s => s.life > 0)
      flashT = Math.max(0, flashT - 1)
      shakeT = Math.max(0, shakeT - 1)
    }

    function draw() {
      if (!ctx) return
      const dark = isDark()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // screen shake for big moments (rendered only — physics untouched)
      const shakeAmt = Math.min(1, shakeT / 20) * 7
      const camX0 = camX
      const camY0 = camY
      camX = camX0 + (Math.random() - 0.5) * shakeAmt
      camY = camY0 + (Math.random() - 0.5) * shakeAmt

      // sky
      const sky = ctx.createLinearGradient(0, 0, 0, H)
      if (dark) {
        sky.addColorStop(0, '#0b0518')
        sky.addColorStop(1, '#1c0f38')
      } else {
        sky.addColorStop(0, '#fdf3e3')
        sky.addColorStop(1, '#efdcf5')
      }
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, H)

      // stars / sparkles (parallax, hash-scattered so they never form lines)
      ctx.fillStyle = dark ? 'rgba(255,255,255,0.5)' : 'rgba(153,69,255,0.25)'
      const starSpan = W + 40
      for (let i = 0; i < 40; i++) {
        let sx = (rngFor(i, 11) * starSpan - camX * 0.15) % starSpan
        if (sx < 0) sx += starSpan
        sx -= 20
        const sy = rngFor(i, 17) * (H - 140) + 10 - camY * 0.1
        const tw = 0.5 + Math.abs(Math.sin(t * 0.02 + i)) * 1.4
        ctx.fillRect(sx, sy, tw, tw)
      }

      // distant candlestick skyline (parallax 0.5)
      for (let i = Math.floor(camX * 0.5 / 90) - 1; i < (camX * 0.5 + W) / 90 + 1; i++) {
        const bx = i * 90 - camX * 0.5
        const hgt = 50 + rngFor(i, 3) * 150
        const green = rngFor(i, 5) > 0.42
        const by = waterY - hgt - camY * 0.5
        ctx.fillStyle = green
          ? dark
            ? 'rgba(8,153,129,0.33)'
            : 'rgba(8,153,129,0.28)'
          : dark
            ? 'rgba(242,54,69,0.30)'
            : 'rgba(242,54,69,0.24)'
        ctx.fillRect(bx, by, 26, hgt)
        ctx.fillRect(bx + 11, by - 22, 4, hgt + 44)
      }

      // pickups
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const p of pickups) {
        if (p.taken) continue
        const px = p.x - camX
        if (px < -60 || px > W + 60) continue
        const py = (BUOYS.has(p.type) ? buoyY(p) : p.y + Math.sin(t * 0.06 + p.wobble) * 5) - camY
        switch (p.type) {
          case 'coin': {
            ctx.beginPath()
            ctx.arc(px, py, 13, 0, Math.PI * 2)
            ctx.fillStyle = '#fbbf24'
            ctx.fill()
            ctx.lineWidth = 3
            ctx.strokeStyle = '#b45309'
            ctx.stroke()
            ctx.fillStyle = '#b45309'
            ctx.font = 'bold 13px monospace'
            ctx.fillText('◎', px, py + 1)
            break
          }
          case 'ring':
          case 'jet': {
            const gold = p.type === 'jet'
            const r = gold ? 30 : 24
            const spin = t * 0.05 + p.wobble
            ctx.save()
            ctx.translate(px, py)
            ctx.rotate(spin)
            ctx.lineWidth = 6
            ctx.strokeStyle = gold ? '#fbbf24' : '#a78bfa'
            ctx.shadowColor = gold ? '#fbbf24' : '#a78bfa'
            ctx.shadowBlur = 14
            ctx.beginPath()
            ctx.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2)
            ctx.stroke()
            ctx.restore()
            break
          }
          case 'balloon': {
            ctx.font = '30px serif'
            ctx.fillText('🎈', px, py)
            break
          }
          case 'sat': {
            ctx.font = '30px serif'
            ctx.fillText('🛰️', px, py)
            break
          }
          case 'bear': {
            ctx.fillStyle = dark ? 'rgba(120,120,140,0.5)' : 'rgba(120,120,140,0.4)'
            ctx.beginPath()
            ctx.ellipse(px, py + 6, 42, 20, 0, 0, Math.PI * 2)
            ctx.ellipse(px - 20, py, 26, 16, 0, 0, Math.PI * 2)
            ctx.ellipse(px + 20, py, 26, 16, 0, 0, Math.PI * 2)
            ctx.fill()
            ctx.font = '24px serif'
            ctx.fillText('🐻', px, py - 2)
            break
          }
          case 'pump':
          case 'red':
          case 'wick': {
            // candle buoy riding the water
            const color = p.type === 'pump' ? '#089981' : p.type === 'red' ? '#f23645' : '#f8fafc'
            const h = p.type === 'wick' ? 46 : 34
            ctx.strokeStyle = color
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.moveTo(px, py - h / 2 - 12)
            ctx.lineTo(px, py + h / 2 + 12)
            ctx.stroke()
            ctx.fillStyle = color
            if (p.type === 'wick') {
              ctx.shadowColor = '#f8fafc'
              ctx.shadowBlur = 16
            }
            ctx.fillRect(px - 8, py - h / 2, 16, h)
            ctx.shadowBlur = 0
            break
          }
        }
      }

      // water
      const wy = waterY - camY
      const water = ctx.createLinearGradient(0, wy, 0, H)
      water.addColorStop(0, dark ? 'rgba(76,29,149,0.75)' : 'rgba(124,58,237,0.35)')
      water.addColorStop(1, dark ? 'rgba(30,10,70,0.95)' : 'rgba(124,58,237,0.55)')
      ctx.fillStyle = water
      ctx.beginPath()
      ctx.moveTo(0, H)
      ctx.lineTo(0, wy + 6)
      for (let x = 0; x <= W; x += 14) {
        ctx.lineTo(x, wy + Math.sin((x + camX) * 0.02 + t * 0.05) * 4)
      }
      ctx.lineTo(W, H)
      ctx.closePath()
      ctx.fill()

      // splashes
      ctx.fillStyle = '#7dd3fc'
      for (const s of splashes) {
        ctx.globalAlpha = Math.max(0, s.life / 30)
        ctx.beginPath()
        ctx.arc(s.x - camX, s.y - camY, 3.2, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // whale
      const img =
        phaseRef.current === 'flying'
          ? whale.vy < -2 && spoutCharges !== storeRef.current.up.spout
            ? rocketImg ?? happyImg
            : happyImg
          : idleImg
      if (img) {
        const sw = 96
        const sh = (sw * 250) / 320
        const bob = phaseRef.current === 'flying' ? 0 : Math.sin(t * 0.05) * 4
        ctx.save()
        ctx.translate(whale.x - camX, whale.y - camY + bob)
        ctx.rotate(phaseRef.current === 'flying' ? whale.angle : 0)
        // sprite faces left; flip so Blasty flies to the right
        ctx.scale(-1, 1)
        ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh)
        ctx.restore()
      }

      // launch pad hint
      if (phaseRef.current === 'ready' || phaseRef.current === 'charging') {
        ctx.fillStyle = dark ? 'rgba(255,255,255,0.55)' : 'rgba(28,25,23,0.55)'
        ctx.font = '600 14px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(
          phaseRef.current === 'ready' ? 'HOLD to charge · release to BLAST' : 'release!',
          whale.x - camX,
          waterY - 96 - camY
        )
      }

      // announcer flash (milestones, god candles, close calls)
      if (flashT > 0 && flashText) {
        const a = Math.min(1, flashT / 30)
        const punch = 1 + Math.max(0, flashT - 95) * 0.02
        ctx.save()
        ctx.globalAlpha = a
        ctx.translate(W / 2, H * 0.22)
        ctx.scale(punch, punch)
        ctx.font = '800 26px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineWidth = 6
        ctx.strokeStyle = dark ? 'rgba(11,5,24,0.85)' : 'rgba(255,253,248,0.9)'
        ctx.strokeText(flashText, 0, 0)
        ctx.fillStyle = dark ? '#fde047' : '#7c3aed'
        ctx.fillText(flashText, 0, 0)
        ctx.restore()
        ctx.globalAlpha = 1
      }

      // undo the render-only shake offset
      camX = camX0
      camY = camY0
    }

    // Fixed 60Hz timestep — physics stay identical on 60/120/144Hz displays
    const STEP_MS = 1000 / 60
    let lastTime = 0
    let acc = 0
    function loop(now: number) {
      if (disposed) return
      if (!lastTime) lastTime = now
      acc += Math.min(120, now - lastTime)
      lastTime = now
      while (acc >= STEP_MS) {
        step()
        acc -= STEP_MS
      }
      draw()
      raf = requestAnimationFrame(loop)
    }

    function onDown(e: PointerEvent) {
      e.preventDefault()
      if (phaseRef.current === 'ready') {
        chargeT = 0
        setPhaseBoth('charging')
      } else if (phaseRef.current === 'flying') {
        spoutBoost()
      }
    }

    function onUp() {
      if (phaseRef.current === 'charging') {
        const p = (Math.sin(chargeT * 0.052 - Math.PI / 2) + 1) / 2
        launch(p)
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      e.preventDefault()
      if (phaseRef.current === 'ready') {
        chargeT = 0
        setPhaseBoth('charging')
      } else if (phaseRef.current === 'flying') {
        spoutBoost()
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') onUp()
    }

    resize()
    resetRun()
    window.addEventListener('resize', resize)
    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)

    Promise.all([loadSprite(WHALE_IDLE_SVG), loadSprite(WHALE_HAPPY_SVG), loadSprite(WHALE_ROCKET_SVG)])
      .then(([a, b, c]) => {
        idleImg = a
        happyImg = b
        rocketImg = c
        if (phaseRef.current === 'loading') setPhaseBoth('ready')
      })
      .catch(() => {
        if (phaseRef.current === 'loading') setPhaseBoth('ready')
      })

    raf = requestAnimationFrame(loop)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setPhaseBoth, runKey])

  const launchAgain = () => {
    setResult(null)
    setPower(0)
    setRunKey(k => k + 1)
    setPhaseBoth('loading')
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <AppHeader active="game" />
      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-8">
        <div className="mb-6 text-center">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-sol-purple mb-2">
            The waiting-room game
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            BLAST <span className="gradient-text-accent">OFF</span>
          </h1>
          <p className="mt-2 text-sm sm:text-base text-ink-2 max-w-xl mx-auto">
            Blasty bought the top. Charge the blast, launch them out of the water, and recover the
            drawdown — every meter is a dollar. Grab <span className="text-gold font-semibold">◎ coins</span> for upgrades.
          </p>
        </div>

        {/* HUD */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-3 text-sm font-semibold tabular-nums">
          <span>
            📏 <span className="text-ink">{hud.distance}m</span>{' '}
            <span className="text-ink-3 font-normal">recovered</span>
          </span>
          <span>
            ◎ <span className="text-gold">{hud.coins}</span>{' '}
            <span className="text-ink-3 font-normal">this run</span>
          </span>
          <span>
            💦 <span className="text-sky-700 dark:text-sky-300">{hud.spout}</span>{' '}
            <span className="text-ink-3 font-normal">boosts</span>
          </span>
          <span>
            🏆 <span className="text-sol-purple">{store.best}m</span>{' '}
            <span className="text-ink-3 font-normal">best</span>
          </span>
          <span>
            💰 <span className="text-gold">{store.coins}</span>{' '}
            <span className="text-ink-3 font-normal">bank</span>
          </span>
        </div>

        <div key={runKey} className="relative rounded-2xl border border-line overflow-hidden shadow-card select-none touch-none">
          <canvas ref={canvasRef} className="block w-full cursor-pointer" style={{ touchAction: 'none' }} />

          {/* power bar */}
          {phase === 'charging' ? (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-4 w-56 pointer-events-none">
              <div className="h-3 rounded-full bg-ink/15 overflow-hidden border border-line">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500"
                  style={{ width: `${Math.round(power * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-center text-[0.65rem] font-bold uppercase tracking-widest text-ink-2">
                Power
              </p>
            </div>
          ) : null}

          {/* results */}
          {phase === 'done' && result ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex items-center justify-center bg-paper/70 backdrop-blur-sm"
            >
              <div className="rounded-2xl border border-line bg-card p-6 sm:p-8 text-center shadow-card max-w-xs w-[88%]">
                <p className="text-3xl mb-1">{result.newBest ? '🏆' : '🌊'}</p>
                <p className="text-2xl font-extrabold">
                  ${result.distance} <span className="text-ink-2 text-base font-semibold">recovered</span>
                </p>
                {result.newBest ? (
                  <p className="text-sol-purple text-sm font-bold mt-1">NEW BEST!</p>
                ) : (
                  <p className="text-ink-3 text-sm mt-1">Best: ${store.best}</p>
                )}
                <p className="mt-2 text-sm text-ink-2">
                  ◎ {result.coins} coin{result.coins === 1 ? '' : 's'} banked
                </p>
                <button
                  type="button"
                  onClick={launchAgain}
                  className="mt-5 w-full rounded-xl bg-sol-purple px-4 py-3 text-sm font-bold text-white hover:bg-sol-purple-dark transition-colors"
                >
                  🚀 LAUNCH AGAIN
                </button>
              </div>
            </motion.div>
          ) : null}

          {phase === 'loading' ? (
            <div className="absolute inset-0 flex items-center justify-center bg-paper/60">
              <p className="text-sm font-semibold text-ink-2 animate-pulse">Waking up Blasty…</p>
            </div>
          ) : null}
        </div>

        <p className="mt-3 text-center text-xs text-ink-3">
          Hold (or spacebar) to charge · release to launch · tap mid-air to fire the Spout Cannon
        </p>
        <p className="mt-1 text-center text-xs text-ink-3">
          Fly through <span className="text-sol-purple font-semibold">rings</span>, 🎈 balloons and 🛰️
          satellites for boosts · bounce off <span className="text-emerald-600 dark:text-emerald-400 font-semibold">green candles</span> ·
          dodge 🐻 bear clouds and <span className="text-red-600 dark:text-red-400 font-semibold">red candles</span>
        </p>

        {/* shop */}
        <section className="mt-8">
          <h2 className="text-lg font-extrabold tracking-tight mb-4 text-center">
            Upgrade shop <span className="text-gold font-bold">· ◎ {store.coins}</span>
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {UPGRADE_DEFS.map(def => {
              const level = store.up[def.key]
              const maxed = level >= def.max
              const cost = upgradeCost(level)
              const affordable = store.coins >= cost
              return (
                <motion.div
                  key={def.key}
                  whileHover={{ y: -2 }}
                  className="rounded-2xl border border-line bg-card p-4 flex flex-col shadow-card"
                >
                  <div className="text-2xl mb-1">{def.emoji}</div>
                  <p className="font-bold text-sm">{def.name}</p>
                  <p className="text-xs text-ink-2 mt-0.5 mb-2 leading-snug flex-1">{def.blurb}</p>
                  <div className="flex items-center gap-1 mb-2" aria-label={`Level ${level} of ${def.max}`}>
                    {Array.from({ length: def.max }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 flex-1 rounded-full ${i < level ? 'bg-sol-purple' : 'bg-ink/10'}`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={maxed || !affordable}
                    onClick={() => buyUpgrade(def.key)}
                    className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                      maxed
                        ? 'bg-ink/[0.06] text-ink-3 cursor-default'
                        : affordable
                          ? 'bg-sol-purple text-white hover:bg-sol-purple-dark'
                          : 'bg-ink/[0.06] text-ink-3 cursor-not-allowed'
                    }`}
                  >
                    {maxed ? 'MAXED' : `◎ ${cost}`}
                  </button>
                </motion.div>
              )
            })}
          </div>
          <p className="mt-4 text-center text-xs text-ink-3">
            Progress saves in your browser. No wallet, no gas — just vibes while the payout timer runs.
          </p>
        </section>
      </main>
    </div>
  )
}
