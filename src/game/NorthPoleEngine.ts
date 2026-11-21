import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { WinterAudio } from './audio';
import {
  createArchObstacle,
  createCollectibleMesh,
  createCozyCabin,
  createHurdleObstacle,
  createPineObstacle,
  createSharedAssets,
  createSleighAndReindeer,
  createSnowballObstacle,
  type SharedAssets,
  type SleighRig,
} from './models';
import {
  createAuroraTexture,
  createCandyCaneTexture,
  createContactShadowTexture,
  createSnowTrackTexture,
  createWoodTexture,
} from './textures';
import {
  PACE_CONFIG,
  ZONES,
  type CameraMode,
  type CollectibleKind,
  type GameState,
  type HudSnapshot,
  type ObstacleKind,
  type PaceMode,
} from './types';

const LANES = [-3.1, 0, 3.1];
const TRACK_SEGMENT_LEN = 30;
const TRACK_SEGMENT_COUNT = 6;
const HIGH_SCORE_KEY = 'npr25_high_score';

// Pre-allocated scratch helpers to guarantee zero GC in render loop
const _dummy = new THREE.Object3D();
const _vec3 = new THREE.Vector3();
const _color = new THREE.Color();

interface SpawnedObstacle {
  id: number;
  kind: ObstacleKind;
  lane: number;
  z: number;
  mesh: THREE.Group;
  hit: boolean;
}

interface SpawnedCollectible {
  id: number;
  kind: CollectibleKind;
  lane: number;
  x: number;
  y: number;
  z: number;
  mesh: THREE.Group;
  collected: boolean;
  phase: number;
}

interface BurstParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  colorHex: number;
}

interface SideTree {
  x: number;
  z: number;
  scale: number;
  rotY: number;
  tint: number;
}

interface Flake {
  x: number;
  y: number;
  z: number;
  vy: number;
  vx: number;
  scale: number;
  phase: number;
}

export interface EngineCallbacks {
  onStateChange: (state: GameState) => void;
  onHudUpdate: (hud: HudSnapshot) => void;
  onWebGLError?: () => void;
}

export class NorthPoleEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  public audio = new WinterAudio();

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private isSoftwareGl = false;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private assets!: SharedAssets;
  private texturesToDispose: THREE.Texture[] = [];

  private sleigh!: SleighRig;
  private keyLight!: THREE.DirectionalLight;
  private trackSegments: THREE.Group[] = [];
  private trackTex!: THREE.CanvasTexture;
  private auroraMesh!: THREE.Mesh;
  private auroraTex!: THREE.CanvasTexture;

  private pineInstancedTrunk!: THREE.InstancedMesh;
  private pineInstancedLow!: THREE.InstancedMesh;
  private pineInstancedTop!: THREE.InstancedMesh;
  private sideTrees: SideTree[] = [];

  private cabins: THREE.Group[] = [];

  private snowInstanced!: THREE.InstancedMesh;
  private flakes: Flake[] = [];

  private burstInstanced!: THREE.InstancedMesh;
  private burstPool: BurstParticle[] = [];

  private obstacles: SpawnedObstacle[] = [];
  private collectibles: SpawnedCollectible[] = [];
  private nextEntityId = 1;

  // Game state
  private gameState: GameState = 'TITLE_MENU';
  private paceMode: PaceMode = 'standard';
  private cameraMode: CameraMode = 'oblique';
  private reducedMotion = false;

  private currentLane = 1; // 0, 1, 2
  private playerX = 0;
  private playerY = 0;
  private playerVy = 0;
  private isGrounded = true;
  private duckTimer = 0;
  private bufferedLaneDelta = 0;
  private bufferedJump = false;

  private speed = 22;
  private distance = 0;
  private score = 0;
  private presents = 0;
  private combo = 0;
  private maxCombo = 0;
  private comboDecayTimer = 0;
  private zoneIndex = 0;

  private shieldActive = false;
  private invulnTimer = 0;
  private magnetTimer = 0;
  private turboTimer = 0;
  private turboCharge = 0;
  private bannerText: string | null = null;
  private bannerTimer = 0;

  private highScore = 0;
  private isNewHighScore = false;
  private spawnZAccumulator = 0;
  private nextSpawnInterval = 28;
  private cameraShake = 0;
  private elapsed = 0;
  private lastHudPush = 0;

  private frameId = 0;
  private lastTime = 0;
  private disposed = false;
  private contextLost = false;

  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.highScore = this.loadHighScore();
    this.init();
  }

  private loadHighScore(): number {
    try {
      const raw = window.localStorage.getItem(HIGH_SCORE_KEY);
      const parsed = raw ? Number.parseInt(raw, 10) : 0;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private saveHighScore(val: number): void {
    try {
      window.localStorage.setItem(HIGH_SCORE_KEY, String(Math.floor(val)));
    } catch {
      // ignore storage failure
    }
  }

  private detectSoftwareGl(): boolean {
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private init(): void {
    this.isSoftwareGl = this.detectSoftwareGl();

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      this.callbacks.onWebGLError?.();
      return;
    }

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x091426);
    this.scene.fog = new THREE.FogExp2(0x0b182e, 0.0135);

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.2, 220);
    this.camera.position.set(2.4, 5.4, 9.6);
    this.camera.lookAt(0, 1.1, -9);

    // Procedural studio environment map for metallic gold & clearcoat sleigh reflections
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmremGenerator.dispose();

    // Warm/cool 3-point outdoor arctic lighting rig
    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x162947, 0.75);
    this.scene.add(hemi);

    this.keyLight = new THREE.DirectionalLight(0xfff1d6, 1.7);
    this.keyLight.position.set(14, 24, 12);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 65;
    const d = 22;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
    rimLight.position.set(-14, 10, -24);
    this.scene.add(rimLight);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.trackTex = createSnowTrackTexture(maxAniso);
    const candyTex = createCandyCaneTexture(maxAniso);
    const woodTex = createWoodTexture(maxAniso);
    const shadowTex = createContactShadowTexture();
    this.auroraTex = createAuroraTexture();
    this.texturesToDispose.push(this.trackTex, candyTex, woodTex, shadowTex, this.auroraTex);

    this.assets = createSharedAssets(candyTex, woodTex, shadowTex, this.isSoftwareGl);

    this.buildSkyAndMountains();
    this.buildTrackSegments();
    this.buildSideForestAndCabins();
    this.buildSnowAndBursts();

    this.sleigh = createSleighAndReindeer(this.assets);
    this.scene.add(this.sleigh.root);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    this.pushHud(true);
    this.lastTime = performance.now();
    this.tick();
  }

  private buildSkyAndMountains(): void {
    // Distant twilight stars
    const starCount = 260;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 220;
      starPos[i * 3 + 1] = 18 + Math.random() * 68;
      starPos[i * 3 + 2] = -70 - Math.random() * 110;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xe2e8f0,
      size: 0.45,
      sizeAttenuation: true,
      fog: false,
    });
    this.scene.add(new THREE.Points(starGeo, starMat));

    // Shimmering Aurora Borealis ribbon overhead
    const aurGeo = new THREE.PlaneGeometry(170, 32, 32, 4);
    const pos = aurGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setZ(i, Math.sin(x * 0.055) * 14 + Math.cos(y * 0.12) * 3);
    }
    aurGeo.computeVertexNormals();
    const aurMat = new THREE.MeshBasicMaterial({
      map: this.auroraTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      blending: THREE.AdditiveBlending,
    });
    this.auroraMesh = new THREE.Mesh(aurGeo, aurMat);
    this.auroraMesh.position.set(0, 34, -125);
    this.auroraMesh.rotation.x = 0.25;
    this.scene.add(this.auroraMesh);

    // Distant mountain ridge silhouettes framing the valley (no indoor box walls!)
    const ridgeMat = new THREE.MeshStandardMaterial({
      color: 0x162b4d,
      roughness: 0.92,
      metalness: 0.04,
      flatShading: true,
    });
    for (let i = -5; i <= 5; i++) {
      if (Math.abs(i) < 1) continue;
      const peakH = 26 + Math.abs(i) * 4 + (i % 2 === 0 ? 7 : 0);
      const peak = new THREE.Mesh(new THREE.ConeGeometry(22, peakH, 6), ridgeMat);
      peak.position.set(i * 22, peakH * 0.42 - 2, -135 - Math.abs(i) * 6);
      this.scene.add(peak);
    }
  }

  private buildTrackSegments(): void {
    const trackMat = new THREE.MeshStandardMaterial({
      map: this.trackTex,
      roughness: 0.72,
      metalness: 0.05,
    });
    const bankMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      roughness: 0.85,
      metalness: 0.02,
    });
    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0xcbdcf0,
      roughness: 0.9,
      metalness: 0.02,
    });
    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.6,
    });

    for (let s = 0; s < TRACK_SEGMENT_COUNT; s++) {
      const seg = new THREE.Group();

      // Main 3-lane track surface (width 11.4, length 30)
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(11.4, TRACK_SEGMENT_LEN),
        trackMat,
      );
      road.rotation.x = -Math.PI / 2;
      road.receiveShadow = true;
      seg.add(road);

      // Extended alpine snow plain flanking both sides so terrain never floats in a void
      const plainLeft = new THREE.Mesh(
        new THREE.PlaneGeometry(75, TRACK_SEGMENT_LEN),
        terrainMat,
      );
      plainLeft.rotation.x = -Math.PI / 2;
      plainLeft.position.set(-43.2, -0.05, 0);
      plainLeft.receiveShadow = true;
      seg.add(plainLeft);

      const plainRight = new THREE.Mesh(
        new THREE.PlaneGeometry(75, TRACK_SEGMENT_LEN),
        terrainMat,
      );
      plainRight.rotation.x = -Math.PI / 2;
      plainRight.position.set(43.2, -0.05, 0);
      plainRight.receiveShadow = true;
      seg.add(plainRight);

      // Raised snowbank curbs
      for (const side of [-5.85, 5.85]) {
        const curb = new THREE.Mesh(
          new THREE.BoxGeometry(0.95, 0.42, TRACK_SEGMENT_LEN),
          bankMat,
        );
        curb.position.set(side, 0.16, 0);
        curb.receiveShadow = true;
        seg.add(curb);
      }

      // Candy-cane mileposts + warm lanterns every 15 units
      for (const lz of [-7.5, 7.5]) {
        for (const side of [-5.55, 5.55]) {
          const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.11, 0.13, 1.55, 8),
            this.assets.candyMat,
          );
          post.position.set(side, 0.775, lz);
          post.castShadow = true;
          seg.add(post);

          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), lanternMat);
          lamp.position.set(side, 1.62, lz);
          seg.add(lamp);
        }
      }

      seg.position.z = 15 - s * TRACK_SEGMENT_LEN;
      this.scene.add(seg);
      this.trackSegments.push(seg);
    }
  }

  private buildSideForestAndCabins(): void {
    // 140 instanced snow-dusted pine trees flanking the valley
    const count = 140;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.2, 6);
    trunkGeo.translate(0, 0.6, 0);
    const lowGeo = new THREE.ConeGeometry(1.15, 2.2, 7);
    lowGeo.translate(0, 2.0, 0);
    const topGeo = new THREE.ConeGeometry(0.82, 1.7, 7);
    topGeo.translate(0, 3.1, 0);

    const snowTopMat = new THREE.MeshStandardMaterial({
      color: 0xe2eefc,
      roughness: 0.85,
    });

    this.pineInstancedTrunk = new THREE.InstancedMesh(trunkGeo, this.assets.pineWoodMat, count);
    this.pineInstancedLow = new THREE.InstancedMesh(lowGeo, this.assets.pineNeedleMat, count);
    this.pineInstancedTop = new THREE.InstancedMesh(topGeo, snowTopMat, count);

    this.pineInstancedTrunk.frustumCulled = false;
    this.pineInstancedLow.frustumCulled = false;
    this.pineInstancedTop.frustumCulled = false;

    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (8.4 + Math.random() * 28);
      const z = 18 - Math.random() * 155;
      const scale = 0.85 + Math.random() * 0.75;
      const rotY = Math.random() * Math.PI * 2;
      const tint = 0.82 + Math.random() * 0.34;
      this.sideTrees.push({ x, z, scale, rotY, tint });

      _color.setRGB(0.08 * tint, 0.36 * tint, 0.2 * tint);
      this.pineInstancedLow.setColorAt(i, _color);
    }
    if (this.pineInstancedLow.instanceColor) {
      this.pineInstancedLow.instanceColor.needsUpdate = true;
    }

    this.scene.add(this.pineInstancedTrunk);
    this.scene.add(this.pineInstancedLow);
    this.scene.add(this.pineInstancedTop);
    this.syncSideTrees();

    // 6 cozy glowing cabins scrolling gently along the outer valley
    for (let i = 0; i < 6; i++) {
      const cabin = createCozyCabin(this.assets);
      const side = i % 2 === 0 ? -1 : 1;
      cabin.position.set(side * (12.5 + (i % 3) * 3.5), 0, -15 - i * 28);
      cabin.rotation.y = side < 0 ? 0.35 : -0.35 + Math.PI;
      this.scene.add(cabin);
      this.cabins.push(cabin);
    }
  }

  private syncSideTrees(): void {
    for (let i = 0; i < this.sideTrees.length; i++) {
      const t = this.sideTrees[i];
      _dummy.position.set(t.x, 0, t.z);
      _dummy.rotation.set(0, t.rotY, 0);
      _dummy.scale.setScalar(t.scale);
      _dummy.updateMatrix();
      this.pineInstancedTrunk.setMatrixAt(i, _dummy.matrix);
      this.pineInstancedLow.setMatrixAt(i, _dummy.matrix);
      this.pineInstancedTop.setMatrixAt(i, _dummy.matrix);
    }
    this.pineInstancedTrunk.instanceMatrix.needsUpdate = true;
    this.pineInstancedLow.instanceMatrix.needsUpdate = true;
    this.pineInstancedTop.instanceMatrix.needsUpdate = true;
  }

  private buildSnowAndBursts(): void {
    // Instanced falling snow
    const flakeCount = this.reducedMotion ? 90 : 280;
    const flakeGeo = new THREE.OctahedronGeometry(0.075, 0);
    const flakeMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    this.snowInstanced = new THREE.InstancedMesh(flakeGeo, flakeMat, flakeCount);
    this.snowInstanced.frustumCulled = false;

    for (let i = 0; i < flakeCount; i++) {
      this.flakes.push({
        x: (Math.random() - 0.5) * 44,
        y: Math.random() * 18,
        z: 10 - Math.random() * 85,
        vy: 1.8 + Math.random() * 2.4,
        vx: (Math.random() - 0.5) * 0.9,
        scale: 0.6 + Math.random() * 0.9,
        phase: Math.random() * Math.PI * 2,
      });
    }
    this.scene.add(this.snowInstanced);

    // Pooled burst particles (snow spray, gift sparkles, shield shatter)
    const poolSize = 90;
    const partGeo = new THREE.OctahedronGeometry(0.11, 0);
    const partMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.burstInstanced = new THREE.InstancedMesh(partGeo, partMat, poolSize);
    this.burstInstanced.frustumCulled = false;

    for (let i = 0; i < poolSize; i++) {
      this.burstPool.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.5,
        scale: 1,
        colorHex: 0xffffff,
      });
      _color.setHex(0xffffff);
      this.burstInstanced.setColorAt(i, _color);
    }
    if (this.burstInstanced.instanceColor) {
      this.burstInstanced.instanceColor.needsUpdate = true;
    }
    this.scene.add(this.burstInstanced);
  }

  private emitBurst(
    x: number,
    y: number,
    z: number,
    count: number,
    colorHex: number,
    spread = 4.2,
    upBias = 3.2,
  ): void {
    let spawned = 0;
    for (let i = 0; i < this.burstPool.length && spawned < count; i++) {
      const p = this.burstPool[i];
      if (!p.active) {
        p.active = true;
        p.x = x + (Math.random() - 0.5) * 0.4;
        p.y = y + Math.random() * 0.35;
        p.z = z + (Math.random() - 0.5) * 0.4;
        p.vx = (Math.random() - 0.5) * spread;
        p.vy = upBias * (0.4 + Math.random() * 0.9);
        p.vz = (Math.random() - 0.5) * spread;
        p.life = 0;
        p.maxLife = 0.36 + Math.random() * 0.3;
        p.scale = 0.7 + Math.random() * 0.8;
        p.colorHex = colorHex;
        _color.setHex(colorHex);
        this.burstInstanced.setColorAt(i, _color);
        if (this.burstInstanced.instanceColor) {
          this.burstInstanced.instanceColor.needsUpdate = true;
        }
        spawned++;
      }
    }
  }

  // Public Controls
  public setPaceMode(mode: PaceMode): void {
    this.paceMode = mode;
    if (this.gameState === 'TITLE_MENU') {
      this.speed = PACE_CONFIG[mode].baseSpeed;
    }
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
  }

  public startRun(): void {
    this.audio.unlock();
    this.clearDynamicEntities();

    const cfg = PACE_CONFIG[this.paceMode];
    this.currentLane = 1;
    this.playerX = 0;
    this.playerY = 0;
    this.playerVy = 0;
    this.isGrounded = true;
    this.duckTimer = 0;
    this.bufferedLaneDelta = 0;
    this.bufferedJump = false;

    this.speed = cfg.baseSpeed;
    this.distance = 0;
    this.score = 0;
    this.presents = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboDecayTimer = 0;
    this.zoneIndex = 0;

    this.shieldActive = false;
    this.invulnTimer = 0;
    this.magnetTimer = 0;
    this.turboTimer = 0;
    this.turboCharge = 0;
    this.cameraShake = 0;
    this.isNewHighScore = false;
    this.spawnZAccumulator = 0;
    this.nextSpawnInterval = 24;

    this.sleigh.shieldDome.visible = false;
    this.sleigh.turboHalo.visible = false;

    this.showBanner('Candy Cane Outskirts', 2.2);
    this.setGameState('PLAYING');
    this.audio.playZoneAdvance();
    this.pushHud(true);
  }

  public togglePause(): void {
    if (this.gameState === 'PLAYING') {
      this.setGameState('PAUSED');
    } else if (this.gameState === 'PAUSED') {
      this.lastTime = performance.now();
      this.setGameState('PLAYING');
    }
  }

  public returnToTitle(): void {
    this.clearDynamicEntities();
    this.currentLane = 1;
    this.playerX = 0;
    this.playerY = 0;
    this.playerVy = 0;
    this.isGrounded = true;
    this.duckTimer = 0;
    this.shieldActive = false;
    this.magnetTimer = 0;
    this.turboTimer = 0;
    this.sleigh.shieldDome.visible = false;
    this.sleigh.turboHalo.visible = false;
    this.speed = PACE_CONFIG[this.paceMode].baseSpeed;
    this.setGameState('TITLE_MENU');
    this.pushHud(true);
  }

  public moveLane(delta: -1 | 1): void {
    if (this.gameState !== 'PLAYING') return;
    this.audio.unlock();
    const target = this.currentLane + delta;
    if (target >= 0 && target <= 2) {
      this.currentLane = target;
      this.audio.playLaneSwitch();
      this.emitBurst(this.playerX, 0.15, 0.8, 5, 0xe2e8f0, 2.8, 1.6);
    } else {
      this.bufferedLaneDelta = delta;
    }
  }

  public jump(): void {
    if (this.gameState !== 'PLAYING') return;
    this.audio.unlock();
    if (this.isGrounded) {
      this.duckTimer = 0;
      this.playerVy = 13.8;
      this.isGrounded = false;
      this.bufferedJump = false;
      this.audio.playJump();
      this.emitBurst(this.playerX, 0.12, 0.4, 8, 0xf8fafc, 3.2, 2.2);
    } else {
      this.bufferedJump = true;
    }
  }

  public duck(): void {
    if (this.gameState !== 'PLAYING') return;
    this.audio.unlock();
    if (!this.isGrounded) {
      // Snappy fast-fall into slide
      this.playerVy = Math.min(this.playerVy, -19);
      this.duckTimer = 0.72;
      this.audio.playDuck();
    } else {
      this.duckTimer = 0.72;
      this.audio.playDuck();
      this.emitBurst(this.playerX, 0.15, 0.7, 6, 0xdbeafe, 2.6, 1.4);
    }
  }

  private setGameState(next: GameState): void {
    this.gameState = next;
    this.callbacks.onStateChange(next);
  }

  private showBanner(text: string, duration = 2.0): void {
    this.bannerText = text;
    this.bannerTimer = duration;
  }

  private clearDynamicEntities(): void {
    for (const obs of this.obstacles) {
      this.scene.remove(obs.mesh);
    }
    for (const col of this.collectibles) {
      this.scene.remove(col.mesh);
    }
    this.obstacles = [];
    this.collectibles = [];
  }

  private spawnPattern(): void {
    const zBase = -118;
    const roll = Math.random();

    const pickPresentKind = (): CollectibleKind => {
      const r = Math.random();
      if (r < 0.52) return 'present_red';
      if (r < 0.82) return 'present_emerald';
      return 'present_gold';
    };

    const pickPowerUp = (): CollectibleKind => {
      const r = Math.random();
      if (r < 0.42) return 'cookie_turbo';
      if (r < 0.74) return 'aurora_magnet';
      return 'frost_shield';
    };

    if (roll < 0.25) {
      // Pattern 1: Two pine/snowball blockers leaving 1 safe lane lined with presents
      const safeLane = Math.floor(Math.random() * 3);
      for (let lane = 0; lane < 3; lane++) {
        if (lane !== safeLane) {
          const kind: ObstacleKind = Math.random() < 0.32 ? 'snowball' : 'pine';
          this.addObstacle(kind, lane, zBase);
        } else {
          for (let k = 0; k < 3; k++) {
            this.addCollectible(pickPresentKind(), lane, zBase - k * 3.8, 0);
          }
        }
      }
      this.nextSpawnInterval = 24;
    } else if (roll < 0.48) {
      // Pattern 2: Jumpable Candy-Cane Hurdle with arc of presents above it + side lane option
      const hurdleLane = Math.floor(Math.random() * 3);
      const otherBlocked = (hurdleLane + (Math.random() < 0.5 ? 1 : 2)) % 3;
      this.addObstacle('hurdle', hurdleLane, zBase);
      this.addObstacle('pine', otherBlocked, zBase);
      // High reward arc over the hurdle
      this.addCollectible('present_gold', hurdleLane, zBase, 1.55);
      this.addCollectible(pickPresentKind(), hurdleLane, zBase - 3.6, 0.7);
      this.nextSpawnInterval = 25;
    } else if (roll < 0.72) {
      // Pattern 3: Duckable Ice Archway with gifts underneath + neighboring pine
      const archLane = Math.floor(Math.random() * 3);
      const blockedLane = (archLane + 1) % 3;
      this.addObstacle('arch', archLane, zBase);
      this.addObstacle('pine', blockedLane, zBase);
      this.addCollectible('present_gold', archLane, zBase - 0.5, 0);
      this.addCollectible(pickPresentKind(), archLane, zBase - 4.2, 0);
      if (Math.random() < 0.35) {
        const freeLane = (archLane + 2) % 3;
        this.addCollectible(pickPowerUp(), freeLane, zBase - 2.5, 0.2);
      }
      this.nextSpawnInterval = 26;
    } else if (roll < 0.88) {
      // Pattern 4: Slalom ribbon of presents + staggered hurdle
      const startLane = Math.floor(Math.random() * 3);
      const midLane = startLane === 1 ? (Math.random() < 0.5 ? 0 : 2) : 1;
      this.addCollectible(pickPresentKind(), startLane, zBase, 0);
      this.addCollectible(pickPresentKind(), midLane, zBase - 4.5, 0);
      this.addCollectible(
        Math.random() < 0.35 ? pickPowerUp() : 'present_gold',
        midLane,
        zBase - 9.0,
        0,
      );
      this.addObstacle('hurdle', startLane, zBase - 7.0);
      this.nextSpawnInterval = 27;
    } else {
      // Pattern 5: Double Hurdle + single Arch across the 3 lanes (always solvable!)
      const archLane = Math.floor(Math.random() * 3);
      for (let lane = 0; lane < 3; lane++) {
        this.addObstacle(lane === archLane ? 'arch' : 'hurdle', lane, zBase);
      }
      this.addCollectible(pickPowerUp(), archLane, zBase - 3.5, 0);
      this.nextSpawnInterval = 28;
    }
  }

  private addObstacle(kind: ObstacleKind, lane: number, z: number): void {
    let mesh: THREE.Group;
    if (kind === 'pine') mesh = createPineObstacle(this.assets);
    else if (kind === 'hurdle') mesh = createHurdleObstacle(this.assets);
    else if (kind === 'arch') mesh = createArchObstacle(this.assets);
    else mesh = createSnowballObstacle(this.assets);

    mesh.position.set(LANES[lane], 0, z);
    this.scene.add(mesh);
    this.obstacles.push({
      id: this.nextEntityId++,
      kind,
      lane,
      z,
      mesh,
      hit: false,
    });
  }

  private addCollectible(kind: CollectibleKind, lane: number, z: number, yOffset: number): void {
    const mesh = createCollectibleMesh(kind, this.assets);
    const x = LANES[lane];
    mesh.position.set(x, yOffset, z);
    this.scene.add(mesh);
    this.collectibles.push({
      id: this.nextEntityId++,
      kind,
      lane,
      x,
      y: yOffset,
      z,
      mesh,
      collected: false,
      phase: Math.random() * Math.PI * 2,
    });
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));

    if (!this.contextLost) {
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    if (!sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        gl.deleteSync(sync);
        return;
      }
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private update(dt: number): void {
    const isPlaying = this.gameState === 'PLAYING';
    const isAttract = this.gameState === 'TITLE_MENU';
    const activeMotion = isPlaying || isAttract;

    if (activeMotion) {
      this.elapsed += dt;
    }

    // Aurora drift
    if (this.auroraTex && !this.reducedMotion) {
      this.auroraTex.offset.x += dt * 0.025;
    }

    const cfg = PACE_CONFIG[this.paceMode];

    if (isPlaying) {
      // Ramp speed smoothly
      const targetSpeed = Math.min(
        cfg.maxSpeed,
        cfg.baseSpeed + this.distance * cfg.accel * 0.028,
      );
      const effectiveTarget = this.turboTimer > 0 ? targetSpeed * 1.38 : targetSpeed;
      this.speed = THREE.MathUtils.damp(this.speed, effectiveTarget, 4.5, dt);

      const moveDist = this.speed * dt;
      this.distance += moveDist * 0.55;
      const mult = this.getMultiplier();
      this.score += moveDist * 1.8 * mult * cfg.scoreScale;

      if (this.score > this.highScore) {
        this.highScore = Math.floor(this.score);
        if (!this.isNewHighScore && this.highScore > 100) {
          this.isNewHighScore = true;
        }
      }

      // Zone progression check
      for (let zi = ZONES.length - 1; zi >= 0; zi--) {
        if (this.distance >= ZONES[zi].minDistance) {
          if (zi > this.zoneIndex) {
            this.zoneIndex = zi;
            this.showBanner(ZONES[zi].name, 2.4);
            this.audio.playZoneAdvance();
          }
          break;
        }
      }

      // Timers
      if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
      if (this.magnetTimer > 0) this.magnetTimer = Math.max(0, this.magnetTimer - dt);
      if (this.turboTimer > 0) {
        this.turboTimer = Math.max(0, this.turboTimer - dt);
        if (this.turboTimer === 0) {
          this.sleigh.turboHalo.visible = false;
        }
      }
      if (this.combo > 0) {
        this.comboDecayTimer -= dt;
        if (this.comboDecayTimer <= 0) {
          this.combo = 0;
        }
      }
      if (this.bannerTimer > 0) {
        this.bannerTimer -= dt;
        if (this.bannerTimer <= 0) this.bannerText = null;
      }

      // Player physics & damped lane carving
      const targetX = LANES[this.currentLane];
      const prevX = this.playerX;
      this.playerX = THREE.MathUtils.damp(this.playerX, targetX, 16, dt);
      const lateralVel = (this.playerX - prevX) / dt;

      if (!this.isGrounded) {
        this.playerVy -= 36 * dt;
        this.playerY += this.playerVy * dt;
        if (this.playerY <= 0) {
          this.playerY = 0;
          this.playerVy = 0;
          this.isGrounded = true;
          this.audio.playLand();
          this.emitBurst(this.playerX, 0.1, 0.5, 7, 0xf1f5f9, 3.0, 1.5);
          if (this.bufferedJump) {
            this.bufferedJump = false;
            this.jump();
          }
        }
      }

      if (this.bufferedLaneDelta !== 0 && Math.abs(this.playerX - targetX) < 0.35) {
        const d = this.bufferedLaneDelta as -1 | 1;
        this.bufferedLaneDelta = 0;
        this.moveLane(d);
      }

      if (this.duckTimer > 0) {
        this.duckTimer = Math.max(0, this.duckTimer - dt);
      }

      // Apply transforms to sleigh rig
      this.sleigh.root.position.set(this.playerX, this.playerY, 0);
      const bankAngle = THREE.MathUtils.clamp(-lateralVel * 0.032, -0.34, 0.34);
      this.sleigh.bodyGroup.rotation.z = THREE.MathUtils.damp(
        this.sleigh.bodyGroup.rotation.z,
        bankAngle,
        14,
        dt,
      );
      const targetPitch = !this.isGrounded
        ? THREE.MathUtils.clamp(this.playerVy * 0.022, -0.25, 0.28)
        : this.duckTimer > 0
          ? -0.09
          : 0;
      this.sleigh.bodyGroup.rotation.x = THREE.MathUtils.damp(
        this.sleigh.bodyGroup.rotation.x,
        targetPitch,
        12,
        dt,
      );

      // Ducking posture for Santa & sleigh suspension
      const duckSquash = this.duckTimer > 0 ? 0.62 : 1.0;
      this.sleigh.santaGroup.scale.y = THREE.MathUtils.damp(
        this.sleigh.santaGroup.scale.y,
        duckSquash,
        18,
        dt,
      );
      this.sleigh.santaGroup.position.y = THREE.MathUtils.damp(
        this.sleigh.santaGroup.position.y,
        this.duckTimer > 0 ? 0.72 : 0.95,
        18,
        dt,
      );

      // Shadow plane stays grounded
      this.sleigh.shadowPlane.position.y = 0.025 - this.playerY;
      const shadowScale = Math.max(0.45, 1 - this.playerY * 0.14);
      this.sleigh.shadowPlane.scale.setScalar(shadowScale);

      // Shield & Turbo visual cues
      this.sleigh.shieldDome.visible = this.shieldActive;
      if (this.shieldActive) {
        this.sleigh.shieldDome.rotation.y += dt * 1.4;
      }
      this.sleigh.turboHalo.visible = this.turboTimer > 0;
      if (this.turboTimer > 0) {
        this.sleigh.turboHalo.rotation.z += dt * 5.2;
      }

      // Occasional runner snow spray
      if (this.isGrounded && Math.random() < (this.turboTimer > 0 ? 0.75 : 0.35)) {
        this.emitBurst(
          this.playerX + (Math.random() < 0.5 ? -0.52 : 0.52),
          0.08,
          1.35,
          1,
          this.turboTimer > 0 ? 0xfde047 : 0xe2e8f0,
          1.5,
          1.2,
        );
      }

      // Spawn & update obstacles/collectibles
      this.spawnZAccumulator += moveDist;
      if (this.spawnZAccumulator >= this.nextSpawnInterval) {
        this.spawnZAccumulator = 0;
        this.spawnPattern();
      }
      this.updateEntities(dt, moveDist);
    } else if (isAttract) {
      // Gentle attract glide on Title Screen
      this.speed = 16;
      const swayX = Math.sin(this.elapsed * 0.65) * 2.2;
      this.sleigh.root.position.set(swayX, 0, 0);
      this.sleigh.bodyGroup.rotation.z = -Math.cos(this.elapsed * 0.65) * 0.1;
      this.sleigh.bodyGroup.rotation.x = 0;
      this.sleigh.santaGroup.scale.y = 1;
      this.sleigh.santaGroup.position.y = 0.95;
      this.sleigh.shadowPlane.position.y = 0.025;
      this.sleigh.shadowPlane.scale.setScalar(1);
    }

    if (activeMotion) {
      // Animate reindeer gallop
      const gallopRate = this.speed * 0.45;
      const gTime = this.elapsed * gallopRate;
      this.sleigh.reindeerGroup.position.y = Math.abs(Math.sin(gTime)) * 0.14;
      this.sleigh.reindeerGroup.rotation.x = Math.cos(gTime) * 0.07;
      for (let i = 0; i < this.sleigh.legs.length; i++) {
        const phase = i < 2 ? 0 : Math.PI;
        this.sleigh.legs[i].rotation.x = Math.sin(gTime + phase + (i % 2) * 0.35) * 0.65;
      }

      // Scroll track, trees, cabins
      const scrollDist = this.speed * dt;
      for (const seg of this.trackSegments) {
        seg.position.z += scrollDist;
        if (seg.position.z > 30) {
          seg.position.z -= TRACK_SEGMENT_COUNT * TRACK_SEGMENT_LEN;
        }
      }

      for (const t of this.sideTrees) {
        t.z += scrollDist;
        if (t.z > 20) {
          t.z -= 158;
          const side = t.x < 0 ? -1 : 1;
          t.x = side * (8.4 + Math.random() * 28);
        }
      }
      this.syncSideTrees();

      for (const cabin of this.cabins) {
        cabin.position.z += scrollDist;
        if (cabin.position.z > 22) {
          cabin.position.z -= 168;
        }
      }
    }

    // Update falling snow & bursts (even slightly on pause, slowed)
    this.updateSnowAndBursts(dt, isPlaying ? this.speed : isAttract ? 14 : 2);

    // Smooth camera choreography (2.5D Oblique vs Chase + FOV boost on Turbo)
    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 3.2);
    }
    const shakeX = this.cameraShake > 0 ? (Math.random() - 0.5) * this.cameraShake * 0.45 : 0;
    const shakeY = this.cameraShake > 0 ? (Math.random() - 0.5) * this.cameraShake * 0.35 : 0;

    const targetCamX =
      this.cameraMode === 'oblique' ? this.playerX * 0.58 + 2.3 : this.playerX * 0.72;
    const targetCamY = this.cameraMode === 'oblique' ? 5.25 + this.playerY * 0.35 : 4.1 + this.playerY * 0.45;
    const targetCamZ = this.cameraMode === 'oblique' ? 9.6 : 8.1;

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 7.5, dt) + shakeX;
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamY, 7.5, dt) + shakeY;
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetCamZ, 7.5, dt);

    _vec3.set(this.playerX * 0.45, 1.05 + this.playerY * 0.3, -9.5);
    this.camera.lookAt(_vec3);

    const targetFov = this.turboTimer > 0 ? 50 : this.cameraMode === 'oblique' ? 42 : 46;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, dt);
      this.camera.updateProjectionMatrix();
    }

    if (isPlaying && performance.now() - this.lastHudPush > 75) {
      this.pushHud(false);
    }
  }

  private updateEntities(dt: number, moveDist: number): void {
    const isDucking = this.duckTimer > 0;
    const isTurbo = this.turboTimer > 0;

    // Obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      const dz = obs.kind === 'snowball' ? moveDist * 1.24 : moveDist;
      obs.z += dz;
      obs.mesh.position.z = obs.z;

      if (obs.kind === 'snowball') {
        const spinner = obs.mesh.getObjectByName('spinner');
        if (spinner) spinner.rotation.x += dz * 0.95;
      }

      // Collision check against sleigh/reindeer footprint
      if (!obs.hit && obs.z > -1.85 && obs.z < 0.85) {
        const obsX = LANES[obs.lane];
        const dx = Math.abs(this.playerX - obsX);
        if (dx < 1.12) {
          let collided = true;
          if (obs.kind === 'hurdle' && this.playerY > 0.88) {
            collided = false; // Cleared by jumping!
          } else if (obs.kind === 'arch' && isDucking && this.playerY < 0.45) {
            collided = false; // Cleared by ducking!
          }

          if (collided) {
            obs.hit = true;
            if (isTurbo) {
              // Turbo blasts obstacle into golden snow confetti!
              this.emitBurst(obsX, 1.1, obs.z, 18, 0xfbbf24, 7.5, 5.5);
              this.scene.remove(obs.mesh);
              this.obstacles.splice(i, 1);
              this.score += 120;
              this.cameraShake = 0.35;
              this.audio.playShieldBreak();
              continue;
            } else if (this.invulnTimer > 0) {
              // Grace period after shield break
            } else if (this.shieldActive) {
              this.shieldActive = false;
              this.sleigh.shieldDome.visible = false;
              this.invulnTimer = 1.4;
              this.cameraShake = 0.7;
              this.audio.playShieldBreak();
              this.emitBurst(this.playerX, 1.0, 0, 22, 0x38bdf8, 7.5, 5.2);
              this.showBanner('Frost Shield Absorbed Hit', 1.6);
              this.pushHud(true);
            } else {
              // Game over
              this.cameraShake = 1.0;
              this.audio.playCrash();
              this.emitBurst(this.playerX, 0.9, -0.4, 24, 0xfef08a, 8, 5);
              this.saveHighScore(this.highScore);
              this.setGameState('GAME_OVER');
              this.pushHud(true);
              return;
            }
          }
        }
      }

      if (obs.z > 16) {
        this.scene.remove(obs.mesh);
        this.obstacles.splice(i, 1);
      }
    }

    // Collectibles
    const magnetRange = this.magnetTimer > 0 || isTurbo ? 14 : 0;
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const col = this.collectibles[i];
      col.z += moveDist;

      if (magnetRange > 0 && !col.collected && col.z > -magnetRange && col.z < 2.2) {
        col.x = THREE.MathUtils.damp(col.x, this.playerX, 11, dt);
        col.y = THREE.MathUtils.damp(col.y, this.playerY + 0.45, 11, dt);
      }

      col.mesh.position.set(col.x, col.y, col.z);
      const inner = col.mesh.getObjectByName('item');
      if (inner) {
        inner.rotation.y += dt * 2.6;
        inner.position.y = 0.75 + Math.sin(this.elapsed * 3.8 + col.phase) * 0.14;
      }

      if (!col.collected && col.z > -2.1 && col.z < 1.25) {
        const dx = Math.abs(this.playerX - col.x);
        const dy = Math.abs(this.playerY + 0.5 - (col.y + 0.65));
        if (dx < 1.35 && dy < 1.45) {
          col.collected = true;
          this.handlePickup(col);
          this.scene.remove(col.mesh);
          this.collectibles.splice(i, 1);
          continue;
        }
      }

      if (col.z > 16) {
        this.scene.remove(col.mesh);
        this.collectibles.splice(i, 1);
      }
    }
  }

  private handlePickup(col: SpawnedCollectible): void {
    if (
      col.kind === 'present_red' ||
      col.kind === 'present_gold' ||
      col.kind === 'present_emerald'
    ) {
      this.presents += 1;
      this.combo += 1;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.comboDecayTimer = 3.6;

      const basePts = col.kind === 'present_gold' ? 50 : 25;
      const mult = this.getMultiplier();
      this.score += basePts * mult * PACE_CONFIG[this.paceMode].scoreScale;
      if (this.score > this.highScore) {
        this.highScore = Math.floor(this.score);
        if (!this.isNewHighScore && this.highScore > 100) {
          this.isNewHighScore = true;
        }
      }

      this.turboCharge = Math.min(100, this.turboCharge + (col.kind === 'present_gold' ? 9 : 5));
      if (this.turboCharge >= 100 && this.turboTimer <= 0) {
        this.activateTurbo();
      }

      this.audio.playCollectPresent(this.combo);
      const burstColor =
        col.kind === 'present_gold'
          ? 0xfbbf24
          : col.kind === 'present_emerald'
            ? 0x10b981
            : 0xef4444;
      this.emitBurst(col.x, col.y + 0.7, col.z, 10, burstColor, 4.6, 3.6);
    } else if (col.kind === 'cookie_turbo') {
      this.turboCharge = 100;
      this.activateTurbo();
      this.emitBurst(col.x, col.y + 0.7, col.z, 16, 0xfbbf24, 5.8, 4.4);
    } else if (col.kind === 'aurora_magnet') {
      this.magnetTimer = 8.5;
      this.audio.playPowerUp('magnet');
      this.showBanner('Aurora Magnet Active', 1.7);
      this.emitBurst(col.x, col.y + 0.7, col.z, 14, 0x22d3ee, 5.2, 4.0);
    } else {
      this.shieldActive = true;
      this.sleigh.shieldDome.visible = true;
      this.audio.playPowerUp('shield');
      this.showBanner('Frost Shield Ready', 1.7);
      this.emitBurst(col.x, col.y + 0.7, col.z, 14, 0x38bdf8, 5.2, 4.0);
    }
    this.pushHud(true);
  }

  private activateTurbo(): void {
    this.turboCharge = 0;
    this.turboTimer = 5.2;
    this.sleigh.turboHalo.visible = true;
    this.audio.playPowerUp('turbo');
    this.showBanner('Starlight Overdrive', 2.0);
  }

  private updateSnowAndBursts(dt: number, windSpeed: number): void {
    // Snowfall
    for (let i = 0; i < this.flakes.length; i++) {
      const f = this.flakes[i];
      f.y -= f.vy * dt;
      f.z += windSpeed * 0.68 * dt;
      f.x += (f.vx + Math.sin(this.elapsed * 1.4 + f.phase) * 0.45) * dt;
      if (f.y < 0 || f.z > 14) {
        f.y = 14 + Math.random() * 5;
        f.z = -75 + Math.random() * 65;
        f.x = (Math.random() - 0.5) * 44;
      }
      _dummy.position.set(f.x, f.y, f.z);
      _dummy.rotation.set(this.elapsed + f.phase, this.elapsed * 0.7, 0);
      _dummy.scale.setScalar(f.scale);
      _dummy.updateMatrix();
      this.snowInstanced.setMatrixAt(i, _dummy.matrix);
    }
    this.snowInstanced.instanceMatrix.needsUpdate = true;

    // Bursts
    for (let i = 0; i < this.burstPool.length; i++) {
      const p = this.burstPool[i];
      if (!p.active) {
        _dummy.position.set(0, -100, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.burstInstanced.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      p.vy -= 14 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = 1 - p.life / p.maxLife;
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.life * 6, p.life * 4, 0);
      _dummy.scale.setScalar(p.scale * t);
      _dummy.updateMatrix();
      this.burstInstanced.setMatrixAt(i, _dummy.matrix);
    }
    this.burstInstanced.instanceMatrix.needsUpdate = true;
  }

  private getMultiplier(): number {
    if (this.combo >= 24) return 5;
    if (this.combo >= 16) return 4;
    if (this.combo >= 9) return 3;
    if (this.combo >= 4) return 2;
    return 1;
  }

  private pushHud(force: boolean): void {
    const now = performance.now();
    if (!force && now - this.lastHudPush < 70) return;
    this.lastHudPush = now;
    this.callbacks.onHudUpdate({
      score: Math.floor(this.score),
      distance: Math.floor(this.distance),
      presents: this.presents,
      combo: this.combo,
      maxCombo: this.maxCombo,
      multiplier: this.getMultiplier(),
      speedKmh: Math.round(this.speed * 3.1),
      zoneName: ZONES[this.zoneIndex]?.name ?? ZONES[0].name,
      shieldActive: this.shieldActive,
      magnetTimer: this.magnetTimer,
      turboTimer: this.turboTimer,
      turboCharge: Math.round(this.turboCharge),
      highScore: Math.floor(this.highScore),
      isNewHighScore: this.isNewHighScore,
      bannerText: this.bannerText,
    });
  }

  private handleResize = (): void => {
    if (this.disposed || !this.renderer || !this.camera) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
    if (this.gameState === 'PLAYING') {
      this.togglePause();
    }
  };

  private handleContextRestored = (): void => {
    this.contextLost = false;
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    this.resizeObserver?.disconnect();
    this.audio.dispose();

    if (this.renderer) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
      this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
    }

    this.scene?.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      }
    });

    this.assets?.dispose();
    this.texturesToDispose.forEach((t) => t.dispose());
    this.envRT?.dispose();
    this.renderer?.dispose();
    if (this.renderer?.domElement?.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
