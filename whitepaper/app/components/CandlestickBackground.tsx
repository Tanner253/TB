'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// --- Configuration ---
const CONFIG = {
    candleWidth: 0.8,
    candleSpacing: 1.5,
    wickRadius: 0.1,
    bullColor: 0x089981, // TradingView Green
    bearColor: 0xf23645, // TradingView Red
    bgColor: 0x0e1117,
    gridColor: 0x2a2e39,
    cameraSpeed: 0.12,
    volatility: 5.5,
    trendStrength: 0.55,
    cameraZ: 60,
    cameraYOffset: 10
}

interface CandleData {
    x: number
    open: number
    close: number
    high: number
    low: number
}

interface Candle {
    mesh: THREE.Group
    data: CandleData
}

export default function CandlestickBackground() {
    const containerRef = useRef<HTMLDivElement>(null)
    const sceneRef = useRef<THREE.Scene | null>(null)
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
    const candlesRef = useRef<Candle[]>([])
    const lastCandleDataRef = useRef<{ close: number; x: number }>({ close: 0, x: 0 })
    const cameraTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0))
    const gridHelperRef = useRef<THREE.GridHelper | null>(null)
    const animationIdRef = useRef<number | null>(null)

    useEffect(() => {
        if (!containerRef.current) return

        const container = containerRef.current

        // 1. Scene
        const scene = new THREE.Scene()
        scene.background = new THREE.Color(CONFIG.bgColor)
        scene.fog = new THREE.FogExp2(CONFIG.bgColor, 0.008)
        sceneRef.current = scene

        // 2. Camera
        const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000)
        camera.position.set(-20, 10, CONFIG.cameraZ)
        cameraRef.current = camera

        // 3. Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setSize(window.innerWidth, window.innerHeight)
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        container.appendChild(renderer.domElement)
        rendererRef.current = renderer

        // 4. Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
        scene.add(ambientLight)

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
        dirLight.position.set(20, 40, 20)
        dirLight.castShadow = true
        dirLight.shadow.mapSize.width = 2048
        dirLight.shadow.mapSize.height = 2048
        dirLight.shadow.camera.near = 0.5
        dirLight.shadow.camera.far = 150
        dirLight.shadow.camera.left = -50
        dirLight.shadow.camera.right = 50
        dirLight.shadow.camera.top = 50
        dirLight.shadow.camera.bottom = -50
        scene.add(dirLight)

        const rimLight = new THREE.PointLight(0x4455ff, 0.5)
        rimLight.position.set(-10, 5, -10)
        scene.add(rimLight)

        // 5. Grid
        const gridHelper = new THREE.GridHelper(400, 100, CONFIG.gridColor, CONFIG.gridColor)
        gridHelper.position.y = -10
        scene.add(gridHelper)
        gridHelperRef.current = gridHelper

        // 6. Initial Candles
        lastCandleDataRef.current = { close: 0, x: 0 }
        for (let i = 0; i < 60; i++) {
            addCandle()
        }

        // 7. Event Listeners
        const onWindowResize = () => {
            if (!cameraRef.current || !rendererRef.current) return
            cameraRef.current.aspect = window.innerWidth / window.innerHeight
            cameraRef.current.updateProjectionMatrix()
            rendererRef.current.setSize(window.innerWidth, window.innerHeight)
        }
        window.addEventListener('resize', onWindowResize)

        // Start Loop
        animate()

        // Cleanup
        return () => {
            window.removeEventListener('resize', onWindowResize)
            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current)
            }
            if (rendererRef.current && container.contains(rendererRef.current.domElement)) {
                container.removeChild(rendererRef.current.domElement)
            }
            rendererRef.current?.dispose()
        }
    }, [])

    function generateNextCandleData(prev: { close: number; x: number }): CandleData {
        const isBullishBias = Math.random() < CONFIG.trendStrength
        const move = Math.random() * CONFIG.volatility

        const open = prev.close
        let close: number
        if (isBullishBias) {
            close = open + move
        } else {
            close = open - (move * 0.5)
        }

        const high = Math.max(open, close) + Math.random() * (CONFIG.volatility * 0.5)
        const low = Math.min(open, close) - Math.random() * (CONFIG.volatility * 0.5)

        return {
            x: prev.x + CONFIG.candleSpacing,
            open,
            close,
            high,
            low
        }
    }

    function addCandle() {
        if (!sceneRef.current) return

        const data = generateNextCandleData(lastCandleDataRef.current)
        lastCandleDataRef.current = { close: data.close, x: data.x }

        const isGreen = data.close >= data.open
        const color = isGreen ? CONFIG.bullColor : CONFIG.bearColor

        const material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.3,
            metalness: 0.2
        })

        const group = new THREE.Group()
        group.position.x = data.x

        const bodyHeight = Math.abs(data.close - data.open)
        const displayBodyHeight = Math.max(bodyHeight, 0.05)
        const bodyY = (data.close + data.open) / 2

        const bodyGeo = new THREE.BoxGeometry(CONFIG.candleWidth, displayBodyHeight, CONFIG.candleWidth)
        const bodyMesh = new THREE.Mesh(bodyGeo, material)
        bodyMesh.position.y = bodyY
        bodyMesh.castShadow = true
        bodyMesh.receiveShadow = true
        group.add(bodyMesh)

        const wickHeight = data.high - data.low
        const wickY = (data.high + data.low) / 2

        const wickGeo = new THREE.CylinderGeometry(CONFIG.wickRadius, CONFIG.wickRadius, wickHeight, 8)
        const wickMesh = new THREE.Mesh(wickGeo, material)
        wickMesh.position.y = wickY
        wickMesh.castShadow = true
        group.add(wickMesh)

        sceneRef.current.add(group)
        candlesRef.current.push({ mesh: group, data: data })

        // Cleanup old candles
        if (candlesRef.current.length > 100) {
            const oldCandle = candlesRef.current.shift()
            if (oldCandle && sceneRef.current) {
                sceneRef.current.remove(oldCandle.mesh)
                oldCandle.mesh.children.forEach(c => {
                    if (c instanceof THREE.Mesh && c.geometry) {
                        c.geometry.dispose()
                    }
                })
            }
        }
    }

    function animate() {
        animationIdRef.current = requestAnimationFrame(animate)

        if (!cameraRef.current || !rendererRef.current || !sceneRef.current) return
        if (candlesRef.current.length === 0) return

        // 1. Procedural Generation
        const lastCandle = candlesRef.current[candlesRef.current.length - 1]
        if (lastCandle.data.x < cameraRef.current.position.x + 90) {
            addCandle()
        }

        // 2. Camera Movement
        cameraRef.current.position.x += CONFIG.cameraSpeed

        // Target Logic
        const targetY = lastCandle.data.close
        cameraTargetRef.current.x = cameraRef.current.position.x + 35
        cameraTargetRef.current.y += (targetY - cameraTargetRef.current.y) * 0.02

        // Look ahead
        cameraRef.current.lookAt(cameraTargetRef.current.x, cameraTargetRef.current.y, 0)

        // Soft Follow Y & Hard Set Z
        const desiredCamY = cameraTargetRef.current.y + CONFIG.cameraYOffset
        cameraRef.current.position.y += (desiredCamY - cameraRef.current.position.y) * 0.05
        cameraRef.current.position.z = CONFIG.cameraZ

        // Infinite Grid Logic
        if (gridHelperRef.current) {
            gridHelperRef.current.position.x = cameraRef.current.position.x
        }

        // 3. Render
        rendererRef.current.render(sceneRef.current, cameraRef.current)
    }

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 w-full h-full z-0"
            style={{ pointerEvents: 'none' }}
        />
    )
}

