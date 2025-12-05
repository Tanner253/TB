<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Infinite Bull Market Animation</title>
    <style>
        body {
            margin: 0;
            overflow: hidden;
            background-color: #0e1117; /* Dark trading background */
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        #canvas-container {
            width: 100vw;
            height: 100vh;
            display: block;
        }
        #ui {
            position: absolute;
            top: 20px;
            left: 20px;
            color: rgba(255, 255, 255, 0.7);
            pointer-events: none;
            z-index: 10;
        }
        h1 {
            font-size: 1.2rem;
            margin: 0;
            font-weight: 600;
            letter-spacing: 1px;
            text-transform: uppercase;
        }
        .live-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            background-color: #00c853;
            border-radius: 50%;
            margin-right: 8px;
            box-shadow: 0 0 8px #00c853;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.8); }
            100% { opacity: 1; transform: scale(1); }
        }

        .payout-toast {
            position: absolute;
            bottom: 40px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: rgba(0, 200, 83, 0.15);
            border: 1px solid #00c853;
            color: #00c853;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 1.5rem;
            font-weight: 800;
            text-transform: uppercase;
            box-shadow: 0 0 20px rgba(0, 200, 83, 0.4);
            opacity: 0;
            transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            text-align: center;
            backdrop-filter: blur(4px);
            pointer-events: none;
        }

        .payout-toast.show {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    </style>
</head>
<body>
    <div id="ui">
        <h1><span class="live-indicator"></span>Live Market Action</h1>
    </div>
    
    <!-- Container for dynamic toasts -->
    <div id="toast-container"></div>
    
    <div id="canvas-container"></div>

    <!-- Load Three.js from CDN -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>

    <script>
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
            cameraYOffset: 10 // UPDATED: Lowered by 50% (was 20)
        };

        let scene, camera, renderer;
        let candles = [];
        let lastCandleData = { close: 0, x: 0 };
        let cameraTarget = new THREE.Vector3(0, 0, 0);
        let gridHelper;
        
        // --- Initialization ---
        function init() {
            const container = document.getElementById('canvas-container');

            // 1. Scene
            scene = new THREE.Scene();
            scene.background = new THREE.Color(CONFIG.bgColor);
            scene.fog = new THREE.FogExp2(CONFIG.bgColor, 0.008); 

            // 2. Camera
            camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
            // Initial position 
            camera.position.set(-20, 10, CONFIG.cameraZ);

            // 3. Renderer
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
            container.appendChild(renderer.domElement);

            // 4. Lighting
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            scene.add(ambientLight);

            const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight.position.set(20, 40, 20); 
            dirLight.castShadow = true;
            dirLight.shadow.mapSize.width = 2048;
            dirLight.shadow.mapSize.height = 2048;
            dirLight.shadow.camera.near = 0.5;
            dirLight.shadow.camera.far = 150; 
            dirLight.shadow.camera.left = -50;
            dirLight.shadow.camera.right = 50;
            dirLight.shadow.camera.top = 50;
            dirLight.shadow.camera.bottom = -50;
            scene.add(dirLight);

            const rimLight = new THREE.PointLight(0x4455ff, 0.5);
            rimLight.position.set(-10, 5, -10);
            scene.add(rimLight);

            // 5. Grid
            gridHelper = new THREE.GridHelper(400, 100, CONFIG.gridColor, CONFIG.gridColor);
            gridHelper.position.y = -10; 
            scene.add(gridHelper);

            // 6. Initial Candles
            lastCandleData = { close: 0, x: 0 };
            for(let i = 0; i < 60; i++) { // Generate even more initial candles to fill the wider/forward view
                addCandle();
            }

            // 7. Event Listeners
            window.addEventListener('resize', onWindowResize, false);
            
            // Start Loop
            animate();

            // Start Message Loop (Every 30 seconds)
            setInterval(showPayoutMessage, 30000);
            
            // Show one immediately 
            setTimeout(showPayoutMessage, 2000);
        }

        // --- Logic: Payout Message ---
        function showPayoutMessage() {
            const container = document.getElementById('toast-container');
            
            const toast = document.createElement('div');
            toast.className = 'payout-toast';
            toast.innerText = 'Topblasters Paid!';
            
            container.appendChild(toast);

            requestAnimationFrame(() => {
                toast.classList.add('show');
            });

            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (container.contains(toast)) {
                        container.removeChild(toast);
                    }
                }, 500); 
            }, 4000);
        }

        // --- Logic: Generate Candle Data ---
        function generateNextCandleData(prev) {
            const isBullishBias = Math.random() < CONFIG.trendStrength;
            const move = Math.random() * CONFIG.volatility;
            
            let open = prev.close;
            let close;
            if (isBullishBias) {
                close = open + move;
            } else {
                close = open - (move * 0.5);
            }

            let high = Math.max(open, close) + Math.random() * (CONFIG.volatility * 0.5);
            let low = Math.min(open, close) - Math.random() * (CONFIG.volatility * 0.5);

            return {
                x: prev.x + CONFIG.candleSpacing,
                open, close, high, low
            };
        }

        // --- Logic: Create 3D Mesh ---
        function addCandle() {
            const data = generateNextCandleData(lastCandleData);
            lastCandleData = data; 

            const isGreen = data.close >= data.open;
            const color = isGreen ? CONFIG.bullColor : CONFIG.bearColor;
            
            const material = new THREE.MeshStandardMaterial({ 
                color: color, 
                roughness: 0.3, 
                metalness: 0.2 
            });

            const group = new THREE.Group();
            group.position.x = data.x;

            const bodyHeight = Math.abs(data.close - data.open);
            const displayBodyHeight = Math.max(bodyHeight, 0.05); 
            const bodyY = (data.close + data.open) / 2;

            const bodyGeo = new THREE.BoxGeometry(CONFIG.candleWidth, displayBodyHeight, CONFIG.candleWidth);
            const bodyMesh = new THREE.Mesh(bodyGeo, material);
            bodyMesh.position.y = bodyY;
            bodyMesh.castShadow = true;
            bodyMesh.receiveShadow = true;
            group.add(bodyMesh);

            const wickHeight = data.high - data.low;
            const wickY = (data.high + data.low) / 2;
            
            const wickGeo = new THREE.CylinderGeometry(CONFIG.wickRadius, CONFIG.wickRadius, wickHeight, 8);
            const wickMesh = new THREE.Mesh(wickGeo, material);
            wickMesh.position.y = wickY;
            wickMesh.castShadow = true;
            group.add(wickMesh);

            scene.add(group);
            candles.push({ mesh: group, data: data });

            // Cleanup
            if (candles.length > 100) { // Keep more history
                const oldCandle = candles.shift();
                scene.remove(oldCandle.mesh);
                oldCandle.mesh.children.forEach(c => {
                    if(c.geometry) c.geometry.dispose();
                });
            }
        }

        // --- Animation Loop ---
        function animate() {
            requestAnimationFrame(animate);

            // 1. Procedural Generation
            const lastCandle = candles[candles.length - 1];
            // UPDATED: Generate much further ahead because we are looking further ahead
            if (lastCandle.data.x < camera.position.x + 90) { 
                addCandle();
            }

            // 2. Camera Movement
            camera.position.x += CONFIG.cameraSpeed;

            // Target Logic
            const targetY = lastCandle.data.close;
            // UPDATED: Look significantly further ahead (+35 instead of +10)
            // This pushes the camera view forward (X + 50%)
            cameraTarget.x = camera.position.x + 35; 
            cameraTarget.y += (targetY - cameraTarget.y) * 0.02; 
            
            // Look ahead
            camera.lookAt(cameraTarget.x, cameraTarget.y, 0);

            // Soft Follow Y & Hard Set Z
            const desiredCamY = cameraTarget.y + CONFIG.cameraYOffset; 
            camera.position.y += (desiredCamY - camera.position.y) * 0.05;
            camera.position.z = CONFIG.cameraZ; 

            // Infinite Grid Logic
            if(gridHelper) {
                gridHelper.position.x = camera.position.x;
            }

            // 3. Render
            renderer.render(scene, camera);
        }

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        window.onload = init;

    </script>
</body>
</html>