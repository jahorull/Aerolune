import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AstronomicalPhase,
  CityLocation,
  GraphicsQuality,
  HourlyTimelinePoint,
  Viewport3DMode,
} from '../types/weather';

interface Aerolune3DViewportProps {
  mode: Viewport3DMode;
  city: CityLocation;
  point: HourlyTimelinePoint;
  phase: AstronomicalPhase;
  quality: GraphicsQuality;
  isLowEndMode: boolean;
  storyStep: number; // 0 to 3 for Weather Story Generator
  selectedWardId: string;
  onSelectWard?: (wardId: string) => void;
}

// Pre-allocated scratch math helpers outside the animation loop (Zero GC in render loop)
const _scratchVec = new THREE.Vector3();
const _scratchColor = new THREE.Color();
const _dummyObj = new THREE.Object3D();

function createProceduralEarthTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep ocean gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, 512);
  oceanGrad.addColorStop(0, '#07162c');
  oceanGrad.addColorStop(0.5, '#0a2246');
  oceanGrad.addColorStop(1, '#061428');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, 1024, 512);

  // Subtle lat/lon telemetry graticule
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.14)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= 1024; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // Stylized landmass silhouettes (Eurasia, South Asia / Bengal Delta, Africa, Americas, Australia)
  ctx.fillStyle = '#143832';
  ctx.strokeStyle = '#2dd4bf';
  ctx.lineWidth = 1.5;

  const drawLandPolygon = (pts: [number, number][]) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  // North America
  drawLandPolygon([
    [120, 90], [260, 80], [290, 170], [230, 230], [160, 210], [110, 140],
  ]);
  // South America
  drawLandPolygon([
    [250, 250], [320, 270], [340, 360], [290, 440], [260, 350],
  ]);
  // Africa
  drawLandPolygon([
    [470, 190], [570, 195], [610, 270], [575, 390], [520, 395], [495, 290], [455, 240],
  ]);
  // Europe & Asia (with distinct India & Bangladesh Bengal Delta notch around x=768, y=190)
  drawLandPolygon([
    [470, 95], [620, 75], [840, 85], [910, 150], [855, 230], [810, 245],
    [775, 205], [762, 192], [745, 240], [720, 200], [665, 215], [610, 185], [480, 165],
  ]);
  // Australia
  drawLandPolygon([
    [800, 320], [895, 325], [905, 395], [815, 390],
  ]);

  // Highlight Bengal Delta / Bangladesh synoptic zone
  const bdGrad = ctx.createRadialGradient(768, 190, 3, 768, 190, 38);
  bdGrad.addColorStop(0, 'rgba(6, 182, 212, 0.85)');
  bdGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.35)');
  bdGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
  ctx.fillStyle = bdGrad;
  ctx.beginPath();
  ctx.arc(768, 190, 38, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createProceduralCloudTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 256);

  for (let i = 0; i < 95; i++) {
    const x = (Math.sin(i * 12.9898) * 0.5 + 0.5) * 512;
    const y = (Math.cos(i * 78.233) * 0.5 + 0.5) * 200 + 28;
    const r = 14 + (i % 28);
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, 'rgba(248, 250, 252, 0.55)');
    g.addColorStop(0.6, 'rgba(203, 213, 225, 0.22)');
    g.addColorStop(1, 'rgba(203, 213, 225, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const Aerolune3DViewport: React.FC<Aerolune3DViewportProps> = ({
  mode,
  city,
  point,
  phase,
  quality,
  isLowEndMode,
  storyStep,
  selectedWardId,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  // Store latest props in ref so WebGL loop reads live state without tearing down canvas
  const stateRef = useRef({
    mode,
    city,
    point,
    phase,
    quality,
    isLowEndMode,
    storyStep,
    selectedWardId,
  });

  useEffect(() => {
    stateRef.current = {
      mode,
      city,
      point,
      phase,
      quality,
      isLowEndMode,
      storyStep,
      selectedWardId,
    };
  }, [mode, city, point, phase, quality, isLowEndMode, storyStep, selectedWardId]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software WebGL Guard (per Three.js & Ultra-Mode skills)
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 540;
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090e);
    scene.fog = new THREE.FogExp2(0x07090e, 0.018);

    // Mandatory Studio PBR Environment Map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 250);
    camera.position.set(0, 8.2, 16.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.6, 0);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxDistance = 36;
    controls.minDistance = 5;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.update();

    // 3-Point Warm/Cool Studio & Astronomical Rig
    const hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x1e293b, 1.35);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
    keyLight.position.set(12, 18, 12);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 50;
    const d = 14;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x22d3ee, 1.4);
    rimLight.position.set(-12, 10, -10);
    scene.add(rimLight);

    // =========================================================================
    // GROUP 1: 3D WEATHER GLOBE (Composite Multi-Layer Planetary Group)
    // =========================================================================
    const globeGroup = new THREE.Group();
    globeGroup.position.y = 1.65;
    scene.add(globeGroup);

    const earthTex = createProceduralEarthTexture();
    earthTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.18,
    });
    const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(3.6, 48, 48), earthMat);
    globeGroup.add(earthMesh);

    // Cloud shell
    const cloudTex = createProceduralCloudTexture();
    const cloudMat = new THREE.MeshStandardMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      roughness: 0.9,
    });
    const cloudShell = new THREE.Mesh(new THREE.SphereGeometry(3.72, 40, 40), cloudMat);
    cloudShell.renderOrder = 2;
    globeGroup.add(cloudShell);

    // Orbital Meteorological Satellite Ring + Synoptic Radar Band
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.6,
      roughness: 0.25,
      metalness: 0.8,
    });
    const orbitalRing = new THREE.Mesh(new THREE.TorusGeometry(4.65, 0.035, 12, 96), ringMat);
    orbitalRing.rotation.x = Math.PI * 0.38;
    globeGroup.add(orbitalRing);

    // City Beacon Pin on Globe (Composite 3-part beacon)
    const cityPinGroup = new THREE.Group();
    const pinStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.65, 12),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 })
    );
    pinStem.position.y = 0.325;
    const pinHead = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18, 0),
      new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.9,
        roughness: 0.15,
      })
    );
    pinHead.position.y = 0.74;
    const pinPulseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.32, 24),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide })
    );
    pinPulseRing.rotation.x = Math.PI / 2;
    pinPulseRing.position.y = 0.05;
    cityPinGroup.add(pinStem, pinHead, pinPulseRing);
    globeGroup.add(cityPinGroup);

    // =========================================================================
    // GROUP 2: LIVING WEATHER CITY DIORAMA & STORY / RADAR STAGE
    // =========================================================================
    const cityGroup = new THREE.Group();
    cityGroup.position.y = 0.85;
    scene.add(cityGroup);

    // Ground Terrain Base + Telemetry Bevel Rim
    const basePlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(7.8, 8.3, 0.6, 48),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.25 })
    );
    basePlinth.position.y = -0.32;
    basePlinth.receiveShadow = true;
    cityGroup.add(basePlinth);

    const rimTorus = new THREE.Mesh(
      new THREE.TorusGeometry(7.85, 0.06, 12, 64),
      new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0891b2,
        emissiveIntensity: 0.65,
        roughness: 0.2,
        metalness: 0.8,
      })
    );
    rimTorus.rotation.x = Math.PI / 2;
    rimTorus.position.y = 0.02;
    cityGroup.add(rimTorus);

    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x26354d,
      roughness: 0.35,
      metalness: 0.3,
    });
    const roadSurface = new THREE.Mesh(new THREE.CircleGeometry(7.7, 48), roadMat);
    roadSurface.rotation.x = -Math.PI / 2;
    roadSurface.position.y = 0.01;
    roadSurface.receiveShadow = true;
    cityGroup.add(roadSurface);

    // River / Puddle Specular Water Plane
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0369a1,
      emissiveIntensity: 0.35,
      roughness: 0.08,
      metalness: 0.75,
      transparent: true,
      opacity: 0.9,
    });
    const riverStrip = new THREE.Mesh(new THREE.PlaneGeometry(13.5, 2.3), waterMat);
    riverStrip.rotation.x = -Math.PI / 2;
    riverStrip.position.set(0, 0.03, 1.8);
    cityGroup.add(riverStrip);

    // Composite Architectural Towers (8 multi-part buildings with podium, tower, roof spire, and window strips)
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.85,
      roughness: 0.15,
      metalness: 0.5,
    });

    const towerSpecs = [
      { x: -3.2, z: -2.0, w: 1.25, h: 3.6, d: 1.25, color: 0x334155 },
      { x: -1.2, z: -2.4, w: 1.45, h: 4.9, d: 1.35, color: 0x475569 },
      { x: 1.1, z: -2.2, w: 1.35, h: 4.3, d: 1.25, color: 0x334155 },
      { x: 3.2, z: -1.8, w: 1.2, h: 3.3, d: 1.2, color: 0x475569 },
      { x: -3.8, z: 0.0, w: 1.1, h: 2.6, d: 1.1, color: 0x64748b },
      { x: 3.6, z: 0.1, w: 1.15, h: 2.9, d: 1.15, color: 0x475569 },
      { x: -1.8, z: 3.7, w: 1.3, h: 2.4, d: 1.2, color: 0x334155 },
      { x: 1.8, z: 3.8, w: 1.25, h: 2.8, d: 1.2, color: 0x475569 },
    ];

    towerSpecs.forEach((spec) => {
      const bldg = new THREE.Group();
      bldg.position.set(spec.x, 0, spec.z);

      // 1. Primary Podium
      const podium = new THREE.Mesh(
        new THREE.BoxGeometry(spec.w * 1.18, 0.4, spec.d * 1.18),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.25 })
      );
      podium.position.y = 0.2;
      podium.castShadow = !isSoftwareGl;
      podium.receiveShadow = true;

      // 2. Main Structural Shaft
      const shaft = new THREE.Mesh(
        new THREE.BoxGeometry(spec.w, spec.h, spec.d),
        new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.35, metalness: 0.45 })
      );
      shaft.position.y = 0.4 + spec.h / 2;
      shaft.castShadow = !isSoftwareGl;
      shaft.receiveShadow = true;

      // 3. Illuminated Window Banding
      const winBand = new THREE.Mesh(
        new THREE.BoxGeometry(spec.w * 1.03, spec.h * 0.76, spec.d * 0.84),
        windowMat
      );
      winBand.position.y = 0.4 + spec.h * 0.5;

      // 4. Rooftop Crown & Meteorological Mast
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(spec.w * 0.25, spec.w * 0.42, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.8 })
      );
      crown.position.y = 0.4 + spec.h + 0.2;

      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.035, 0.75, 6),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.9 })
      );
      mast.position.y = 0.4 + spec.h + 0.75;

      bldg.add(podium, shaft, winBand, crown, mast);
      cityGroup.add(bldg);
    });

    // Padma / Meghna Stylized Truss Bridge Span across the river
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(0, 0, 1.8);
    const bridgeDeck = new THREE.Mesh(
      new THREE.BoxGeometry(10.5, 0.18, 0.85),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.65 })
    );
    bridgeDeck.position.y = 0.95;
    bridgeGroup.add(bridgeDeck);
    for (let px = -3.5; px <= 3.5; px += 3.5) {
      const pylon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.18, 2.2, 12),
        new THREE.MeshStandardMaterial({
          color: 0xe2e8f0,
          emissive: 0x06b6d4,
          emissiveIntensity: 0.25,
          roughness: 0.3,
          metalness: 0.7,
        })
      );
      pylon.position.set(px, 1.1, 0);
      bridgeGroup.add(pylon);
    }
    cityGroup.add(bridgeGroup);

    // Wind-Reactive Trees (Composite trunk + multi-tier canopy)
    const treeGroups: THREE.Group[] = [];
    const treeCoords = [
      [-4.6, -1.6], [-4.2, 0.7], [4.5, -1.3], [4.3, 0.9],
      [-0.4, -0.8], [0.7, -0.7], [-3.0, 3.4], [3.1, 3.3],
    ];
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x047857,
      emissiveIntensity: 0.2,
      roughness: 0.55,
    });

    treeCoords.forEach(([tx, tz]) => {
      const tree = new THREE.Group();
      tree.position.set(tx, 0, tz);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.65, 8), trunkMat);
      trunk.position.y = 0.325;
      const lowerCanopy = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.95, 10), leafMat);
      lowerCanopy.position.y = 0.85;
      const upperCanopy = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 10), leafMat);
      upperCanopy.position.y = 1.35;
      tree.add(trunk, lowerCanopy, upperCanopy);
      cityGroup.add(tree);
      treeGroups.push(tree);
    });

    // Volumetric 3D Cloud Clusters above the City / Story Stage
    const cloudPuffGroup = new THREE.Group();
    cloudPuffGroup.position.y = 5.4;
    const puffMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      emissive: 0x334155,
      emissiveIntensity: 0.25,
      roughness: 0.85,
      metalness: 0.05,
      transparent: true,
      opacity: 0.88,
    });
    for (let c = 0; c < 14; c++) {
      const cluster = new THREE.Group();
      cluster.position.set(
        (Math.sin(c * 4.1) * 0.5) * 9.5,
        (c % 3) * 0.3,
        (Math.cos(c * 2.7) * 0.5) * 7.5
      );
      for (let p = 0; p < 3; p++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.6 - p * 0.1, 16, 16), puffMat);
        puff.position.set((p - 1) * 0.5, (p % 2) * 0.15, 0);
        puff.scale.y = 0.62;
        cluster.add(puff);
      }
      cloudPuffGroup.add(cluster);
    }
    cityGroup.add(cloudPuffGroup);

    // Ward Microclimate 3D Radar Columns (Visible in 'radar' mode)
    const radarGroup = new THREE.Group();
    cityGroup.add(radarGroup);
    const radarPillars: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const pillarMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0891b2,
        emissiveIntensity: 0.55,
        transparent: true,
        opacity: 0.85,
        roughness: 0.2,
      });
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1, 20), pillarMat);
      const angle = (i / 5) * Math.PI * 2;
      pillar.position.set(Math.cos(angle) * 2.8, 0.5, Math.sin(angle) * 2.8);
      radarGroup.add(pillar);
      radarPillars.push(pillar);
    }

    // Rain Streak InstancedMesh (Zero-GC High-FPS precipitation particles)
    const rainCount = 260;
    const rainGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.65, 4);
    const rainMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.72,
    });
    const rainInstanced = new THREE.InstancedMesh(rainGeo, rainMat, rainCount);
    rainInstanced.frustumCulled = false;
    const rainOffsets: { x: number; y: number; z: number; speed: number }[] = [];
    for (let i = 0; i < rainCount; i++) {
      const rx = (Math.random() - 0.5) * 12;
      const ry = Math.random() * 5.5;
      const rz = (Math.random() - 0.5) * 12;
      rainOffsets.push({ x: rx, y: ry, z: rz, speed: 7 + Math.random() * 5 });
      _dummyObj.position.set(rx, ry, rz);
      _dummyObj.updateMatrix();
      rainInstanced.setMatrixAt(i, _dummyObj.matrix);
    }
    rainInstanced.instanceMatrix.needsUpdate = true;
    cityGroup.add(rainInstanced);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Resize listener
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 960;
      const h = container.clientHeight || 540;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.render(scene, camera);
    };
    window.addEventListener('resize', handleResize);

    // Software-WebGL Paced Animation Loop (`afterDraw`) with zero-warning high-res timer
    let lastTimeMs = performance.now();
    let elapsed = 0;
    let frameId = 0;
    let isDisposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (isDisposed) return;
      const nowMs = performance.now();
      const dt = Math.min((nowMs - lastTimeMs) / 1000, 0.1);
      lastTimeMs = nowMs;
      elapsed += dt;
      const st = stateRef.current;

      // 1. Astronomical Lighting & Sky Transitions
      if (st.phase === 'dawn') {
        _scratchColor.setHex(0x1e1b4b);
        keyLight.color.setHex(0xfdba74);
        keyLight.intensity = 1.8;
        windowMat.emissiveIntensity = 0.55;
      } else if (st.phase === 'noon') {
        _scratchColor.setHex(0x0c192c);
        keyLight.color.setHex(0xffffff);
        keyLight.intensity = 2.3;
        windowMat.emissiveIntensity = 0.45;
      } else if (st.phase === 'evening') {
        _scratchColor.setHex(0x1f122b);
        keyLight.color.setHex(0xf97316);
        keyLight.intensity = 1.7;
        windowMat.emissiveIntensity = 0.85;
      } else {
        _scratchColor.setHex(0x07090e);
        keyLight.color.setHex(0x38bdf8);
        keyLight.intensity = 1.1;
        windowMat.emissiveIntensity = 1.1;
      }

      // Lightning flash in thunderstorm
      if (st.point.conditionCode === 'thunderstorm' && Math.sin(elapsed * 7.3) > 0.96) {
        keyLight.intensity = 3.8;
      }

      (scene.background as THREE.Color).lerp(_scratchColor, 0.08);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(scene.background as THREE.Color);
      }

      // 2. Toggle Active 3D Scene Group (Globe vs Living City / Story / Radar)
      const isGlobe = st.mode === 'globe';
      globeGroup.visible = isGlobe;
      cityGroup.visible = !isGlobe;
      radarGroup.visible = st.mode === 'radar';

      if (isGlobe) {
        earthMesh.rotation.y += dt * 0.08;
        cloudShell.rotation.y += dt * (0.11 + st.point.windSpeedKmh * 0.002);
        cloudMat.opacity = THREE.MathUtils.clamp(0.25 + (st.point.cloudCover / 100) * 0.65, 0.2, 0.9);

        // Position pin on globe using lat/lon
        const latRad = THREE.MathUtils.degToRad(st.city.lat);
        const lonRad = THREE.MathUtils.degToRad(-st.city.lon) + earthMesh.rotation.y;
        const r = 3.62;
        _scratchVec.set(
          r * Math.cos(latRad) * Math.cos(lonRad),
          r * Math.sin(latRad),
          r * Math.cos(latRad) * Math.sin(lonRad)
        );
        cityPinGroup.position.copy(_scratchVec);
        cityPinGroup.lookAt(0, 0, 0);
        cityPinGroup.rotateX(-Math.PI / 2);
      } else {
        // Living City / Story / Radar updates
        const windFactor = st.point.windSpeedKmh / 25;
        const windRad = THREE.MathUtils.degToRad(st.point.windDirectionDeg);

        // Bend trees proportionally to live wind speed
        treeGroups.forEach((tree, idx) => {
          const sway = Math.sin(elapsed * (2.5 + windFactor) + idx) * 0.06 * windFactor;
          tree.rotation.z = THREE.MathUtils.clamp(windFactor * 0.14 + sway, -0.45, 0.45);
          tree.rotation.x = Math.cos(windRad) * 0.06 * windFactor;
        });

        // Wet specular road reflections during rain
        const isWet = st.point.rainProb >= 45;
        roadMat.roughness = isWet ? 0.12 : 0.55;
        roadMat.metalness = isWet ? 0.65 : 0.2;

        // Cloud density & drift
        const activeClouds = Math.max(1, Math.round((st.point.cloudCover / 100) * cloudPuffGroup.children.length));
        cloudPuffGroup.children.forEach((cluster, idx) => {
          cluster.visible = idx < activeClouds;
          cluster.position.x = ((cluster.position.x + dt * windFactor * 1.4 + 5) % 10) - 5;
        });
        puffMat.color.setHex(st.point.rainProb > 65 ? 0x94a3b8 : 0xf1f5f9);

        // Rain particles update
        const showRain = st.point.rainProb >= 40 && !st.isLowEndMode;
        rainInstanced.visible = showRain;
        if (showRain) {
          const activeDrops = st.quality === 'high' ? rainCount : 110;
          rainInstanced.count = activeDrops;
          for (let i = 0; i < activeDrops; i++) {
            const item = rainOffsets[i];
            item.y -= dt * item.speed * (1 + windFactor * 0.3);
            if (item.y < 0) item.y = 5.4;
            _dummyObj.position.set(item.x, item.y, item.z);
            _dummyObj.rotation.z = windFactor * 0.18;
            _dummyObj.updateMatrix();
            rainInstanced.setMatrixAt(i, _dummyObj.matrix);
          }
          rainInstanced.instanceMatrix.needsUpdate = true;
        }

        // Radar mode ward pillars
        if (st.mode === 'radar') {
          radarPillars.forEach((pillar, idx) => {
            const ward = st.city.wards[idx % st.city.wards.length];
            const wardRain = Math.max(10, Math.min(100, st.point.rainProb + (ward?.rainProbDelta || 0)));
            const h = 0.6 + (wardRain / 100) * 3.4;
            pillar.scale.y = THREE.MathUtils.damp(pillar.scale.y, h, 6, dt);
            pillar.position.y = pillar.scale.y / 2;
            const mat = pillar.material as THREE.MeshStandardMaterial;
            if (ward && ward.id === st.selectedWardId) {
              mat.color.setHex(0xf59e0b);
              mat.emissive.setHex(0xd97706);
            } else {
              mat.color.setHex(0x06b6d4);
              mat.emissive.setHex(0x0891b2);
            }
          });
        }

        // Story mode smooth camera choreography
        if (st.mode === 'story') {
          const storyAngles = [0.2, 0.9, -0.7, 0.0];
          const storyHeights = [7.5, 9.5, 6.2, 8.2];
          const targetAngle = storyAngles[st.storyStep % 4];
          cityGroup.rotation.y = THREE.MathUtils.damp(cityGroup.rotation.y, targetAngle, 3.5, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, storyHeights[st.storyStep % 4], 3.5, dt);
        } else {
          cityGroup.rotation.y = THREE.MathUtils.damp(cityGroup.rotation.y, 0.28, 3, dt);
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      earthTex.dispose();
      cloudTex.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={canvasMountRef}
      data-testid="aerolune-3d-viewport"
      data-mode={mode}
      data-phase={phase}
      className="w-full h-full relative overflow-hidden bg-[#07090E]"
    />
  );
};
