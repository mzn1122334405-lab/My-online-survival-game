import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import {
  EYE,
  HOTBAR,
  INV_SIZE,
  ISLAND_R,
  ITEM,
  OUTFITS,
  RECIPES,
  WATER_Y,
  WORLD_SIZE,
  type ItemId,
  type QuestId,
  type Slot,
  type Station,
} from "./data";
import { GameAudio } from "./audio";
import { Input } from "./input";
import { loadSettings, type GameSettings } from "./settings";
import { freshInventory, t, useGameStore, type Overlay } from "./store";

const SEG = 120;
const SIZE = WORLD_SIZE;
const GRID = SEG + 1;
const SAVE = "tribals-save-v1";
const FIXED = 1 / 60;

type PropKind = "tree" | "rock" | "bush";
type InstProps = {
  mesh: THREE.InstancedMesh;
  kind: PropKind;
  hp: Float32Array;
  max: Float32Array;
  drop: ItemId[];
  extra?: ItemId[];
  alive: Uint8Array;
  x: Float32Array;
  z: Float32Array;
  r: Float32Array;
  vis?: THREE.Object3D[];
};

type Creature = {
  id: number;
  mesh: THREE.Object3D;
  kind: "deer" | "boar" | "wolf" | "bear" | "goat" | "basic" | "armed" | "sniper" | "boss";
  hp: number;
  max: number;
  speed: number;
  aggro: number;
  melee: number;
  dmg: number;
  flee: boolean;
  ranged: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  state: "wander" | "chase" | "flee" | "attack";
  cd: number;
  wanderT: number;
  target: THREE.Vector3;
  alive: boolean;
  radius: number;
  provoked: boolean;
};

type Build = {
  id: number;
  type: ItemId;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  rot: number;
  open?: boolean;
  hx?: number;
  hz?: number;
};

type RemotePawn = {
  id: string;
  mesh: THREE.Group;
  pos: THREE.Vector3;
  yaw: number;
  name: string;
  hp: number;
  radius: number;
};

type Drop = { mesh: THREE.Mesh; id: ItemId; n: number; life: number };
type Bullet = {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  dmg: number;
  splash: number;
};

function mulberry(a: number) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addItem(inv: Slot[], id: ItemId, n: number) {
  const stack = ITEM[id].stack;
  let left = n;
  for (const s of inv) {
    if (s && s.id === id && s.count < stack) {
      const room = stack - s.count;
      const take = Math.min(room, left);
      s.count += take;
      left -= take;
      if (!left) return true;
    }
  }
  for (let i = 0; i < inv.length; i++) {
    if (!inv[i]) {
      const take = Math.min(stack, left);
      inv[i] = { id, count: take };
      left -= take;
      if (!left) return true;
    }
  }
  return left < n;
}

function countItem(inv: Slot[], id: ItemId) {
  return inv.reduce((a, s) => a + (s && s.id === id ? s.count : 0), 0);
}

function takeItem(inv: Slot[], id: ItemId, n: number) {
  if (countItem(inv, id) < n) return false;
  let left = n;
  for (const s of inv) {
    if (!s || s.id !== id) continue;
    const take = Math.min(s.count, left);
    s.count -= take;
    left -= take;
    if (!left) break;
  }
  for (let i = 0; i < inv.length; i++) {
    if (inv[i] && inv[i]!.count <= 0) inv[i] = null;
  }
  return true;
}

function hotItem(inv: Slot[], idx: number): Slot {
  return inv[INV_SIZE + idx] ?? null;
}

export class TribalsEngine {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(78, 1, 0.08, 420);
  wscene = new THREE.Scene();
  wcam = new THREE.PerspectiveCamera(55, 1, 0.05, 8);
  input: Input;
  audio = new GameAudio();
  noise2D: (x: number, y: number) => number;
  rng: () => number;
  heights = new Float32Array(GRID * GRID);
  pos = new THREE.Vector3(0, 2, 78);
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = -0.08;
  onGround = true;
  eye = EYE;
  stamina = 100;
  health = 100;
  hunger = 100;
  thirst = 100;
  armor = 0;
  temp = 58;
  settings: GameSettings = loadSettings();
  time = 0.3;
  raining = false;
  rainT = 40;
  bob = 0;
  swing = 0;
  fireCd = 0;
  stepT = 0;
  harvestT = 0;
  hurtT = 0;
  session = 0;
  fps = 60;
  fpsA = 0;
  fpsN = 0;
  kills = 0;
  score = 0;
  quests: Record<QuestId, number> = { wood: 0, axe: 0, tree: 0, hunt: 0, base: 0, raid: 0 };
  gathered: Partial<Record<ItemId, number>> = {};
  training = false;
  outfit = 0;
  seed = 1;
  locked = false;
  overlay: Overlay = "none";
  dead = false;
  paused = false;
  running = false;
  remotes = new Map<string, RemotePawn>();
  isAdmin = false;
  godmode = false;
  staffmode = false;
  dodgeT = 0;
  dodgeCd = 0;
  blocking = false;
  combo = 0;
  comboT = 0;
  nameColor = "#ffffff";
  netName = "";
  hitMark = 0;
  private combatSend: ((msg: { t: "hit"; to: string; dmg: number; head: boolean }) => void) | null = null;
  typing = false;
  acc = 0;
  last = 0;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  water: THREE.Mesh;
  terrainMat: THREE.ShaderMaterial;
  weapon: THREE.Group;
  ghost: THREE.Mesh;
  inst: InstProps[] = [];
  creatures: Creature[] = [];
  builds: Build[] = [];
  drops: Drop[] = [];
  bullets: Bullet[] = [];
  rain: THREE.Points;
  tracers: { mesh: THREE.Line; t: number }[] = [];
  tmp = new THREE.Vector3();
  tmp2 = new THREE.Vector3();
  tmp3 = new THREE.Vector3();
  fwd = new THREE.Vector3();
  right = new THREE.Vector3();
  ray = new THREE.Raycaster();
  mat = new THREE.Matrix4();
  dummy = new THREE.Object3D();
  prevKeys = new Set<string>();
  hudT = 0;
  mapT = 0;
  mapCanvas: HTMLCanvasElement;
  saveT = 0;
  nearStation: Station = "hand";
  buildId = 1;
  creatId = 1;
  woodMat: THREE.MeshStandardMaterial;
  leafMat: THREE.MeshStandardMaterial;
  rockMat: THREE.MeshStandardMaterial;
  armMat: THREE.MeshStandardMaterial;
  disposed = false;
  textures: THREE.Texture[] = [];
  texMaps: Record<string, THREE.Texture> = {};
  spriteTex: Record<string, THREE.Texture> = {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.rng = mulberry(1337);
    this.noise2D = createNoise2D(this.rng);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
    this.renderer.setClearColor(0x87b8d4);
    this.renderer.shadowMap.enabled = false;
    this.renderer.autoClear = false;
    this.scene.fog = new THREE.Fog(0x87b8d4, 48, 210);
    this.applySettings(this.settings);
    this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3a4a28, 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe6b8, 1.4);
    this.sun.position.set(40, 70, 20);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.input = new Input(
      canvas,
      () => {
        this.locked = true;
        useGameStore.getState().patch({ locked: true });
      },
      () => {
        this.locked = false;
        useGameStore.getState().patch({ locked: false });
      },
    );
    this.woodMat = new THREE.MeshStandardMaterial({ color: 0x8b6239, roughness: 0.9 });
    this.leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6a38, roughness: 0.85 });
    this.rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8680, roughness: 1, flatShading: true });
    this.armMat = new THREE.MeshStandardMaterial({ color: 0x6b7a4a, roughness: 0.7 });
    this.terrainMat = new THREE.ShaderMaterial({
      uniforms: {
        tGrass: { value: null },
        tSand: { value: null },
        tRock: { value: null },
        sunDir: { value: new THREE.Vector3(0.35, 0.85, 0.25) },
        ambient: { value: new THREE.Color(0x4d6280) },
        sunCol: { value: new THREE.Color(0xffe2b0) },
      },
      vertexShader: `
        varying vec3 vW; varying vec3 vN;
        void main(){
          vec4 w = modelMatrix * vec4(position,1.0);
          vW = w.xyz;
          vN = normalize(mat3(modelMatrix)*normal);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `
        uniform sampler2D tGrass,tSand,tRock;
        uniform vec3 sunDir,ambient,sunCol;
        varying vec3 vW; varying vec3 vN;
        void main(){
          vec2 uv = vW.xz * 0.11;
          vec3 g = texture2D(tGrass, uv).rgb;
          vec3 s = texture2D(tSand, uv*1.15).rgb;
          vec3 r = texture2D(tRock, uv*0.55).rgb;
          float h = vW.y;
          float sandF = 1.0 - smoothstep(0.25, 2.1, h);
          float rockF = smoothstep(6.4, 11.5, h);
          vec3 col = mix(g,s,sandF);
          col = mix(col,r,rockF);
          float ndl = max(dot(normalize(vN), normalize(sunDir)), 0.0);
          col *= ambient + sunCol * ndl;
          gl_FragColor = vec4(col,1.0);
        }`,
    });
    this.water = new THREE.Mesh();
    this.weapon = new THREE.Group();
    this.ghost = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.35, 1.5),
      new THREE.MeshBasicMaterial({ color: 0x6db56d, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    this.ghost.visible = false;
    this.scene.add(this.ghost);
    this.rain = new THREE.Points();
    this.mapCanvas = document.createElement("canvas");
    this.mapCanvas.width = 160;
    this.mapCanvas.height = 160;
    this.wcam.position.set(0, 0, 0);
    this.wscene.add(this.wcam);
    this.weapon.position.set(0.32, -0.28, -0.55);
    this.wcam.add(this.weapon);
  }

  async start(opts: { training: boolean; outfit: number; load: boolean }) {
    this.training = opts.training;
    this.outfit = opts.outfit;
    this.armMat.color.set(OUTFITS[opts.outfit]?.arm ?? "#6b7a4a");
    await this.loadTextures();
    try {
      this.buildWorld();
    } catch (err) {
      console.error("buildWorld", err);
      throw err;
    }
    this.buildWeapon("knife");
    this.resize();
    window.addEventListener("resize", this.resize);
    this.input.attach();
    this.audio.unlock();
    if (opts.load && !this.loadSave()) this.resetPlayer(true);
    else if (!opts.load) this.resetPlayer(true);
    this.wireControlsTest();
    this.running = true;
    this.last = performance.now();
    this.renderer.setAnimationLoop(this.loop);
    useGameStore.getState().patch({ screen: "playing", training: this.training, overlay: "none" });
  }

  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
    this.input.detach();
    window.removeEventListener("resize", this.resize);
    this.save();
    this.dispose();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.textures.forEach((t) => t.dispose());
    this.renderer.dispose();
  }

  private async loadTextures() {
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    const names = ["grass", "sand", "rock", "bark", "leaves", "water", "planks", "dirt"] as const;
    const maps: Record<string, THREE.Texture> = {};
    await Promise.all(
      names.map(async (n) => {
        try {
          const tex = await loader.loadAsync(`/textures/${n}.jpg`);
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 4;
          maps[n] = tex;
          this.textures.push(tex);
        } catch (err) {
          console.warn("texture fail", n, err);
          const data = new Uint8Array([120, 140, 80]);
          const tex = new THREE.DataTexture(data, 1, 1);
          tex.needsUpdate = true;
          maps[n] = tex;
        }
      }),
    );
    this.terrainMat.uniforms.tGrass.value = maps.grass;
    this.terrainMat.uniforms.tSand.value = maps.sand;
    this.terrainMat.uniforms.tRock.value = maps.rock;
    this.woodMat.map = maps.bark;
    this.woodMat.color.set(0xffffff);
    this.leafMat.map = maps.leaves;
    this.leafMat.color.set(0xffffff);
    this.rockMat.map = maps.rock;
    this.rockMat.color.set(0xffffff);
    this.texMaps = maps;
    const spriteNames = [
      "palm",
      "oak",
      "pine",
      "dead",
      "rock_s",
      "rock_m",
      "rock_l",
      "rock_gold",
      "deer",
      "boar",
      "wolf",
      "bear",
      "basic",
      "armed",
      "sniper",
      "boss",
      "scout",
    ];
    await Promise.all(
      spriteNames.map(async (n) => {
        try {
          const tex = await loader.loadAsync(`/sprites/${n}.png`);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 4;
          this.spriteTex[n] = tex;
          this.textures.push(tex);
        } catch (err) {
          console.warn("sprite fail", n, err);
        }
      }),
    );
  }

  private hgt(x: number, z: number) {
    const n1 = this.noise2D(x * 0.012, z * 0.012);
    const n2 = this.noise2D(x * 0.04 + 20, z * 0.04);
    const n3 = this.noise2D(x * 0.1, z * 0.1);
    const d = Math.hypot(x, z) / ISLAND_R;
    if (d > 1.18) return -8;
    const shore = 1 - Math.min(1, d * d);
    let h = shore * 9.5 + n1 * 4.2 + n2 * 1.6 + n3 * 0.35 - 1.1;
    if (d < 0.12) h -= 2.2;
    if (d > 0.92) h = THREE.MathUtils.lerp(h, -2.5, (d - 0.92) / 0.26);
    return h;
  }

  sample(x: number, z: number) {
    const u = ((x + SIZE / 2) / SIZE) * SEG;
    const v = ((z + SIZE / 2) / SIZE) * SEG;
    const x0 = Math.floor(u);
    const z0 = Math.floor(v);
    if (x0 < 0 || z0 < 0 || x0 >= SEG || z0 >= SEG) return -8;
    const fx = u - x0;
    const fz = v - z0;
    const i = z0 * GRID + x0;
    const a = this.heights[i];
    const b = this.heights[i + 1];
    const c = this.heights[i + GRID];
    const d = this.heights[i + GRID + 1];
    return a * (1 - fx) * (1 - fz) + b * fx * (1 - fz) + c * (1 - fx) * fz + d * fx * fz;
  }

  private buildWorld() {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    for (let iz = 0; iz <= SEG; iz++) {
      for (let ix = 0; ix <= SEG; ix++) {
        const x = (ix / SEG) * SIZE - SIZE / 2;
        const z = (iz / SEG) * SIZE - SIZE / 2;
        this.heights[iz * GRID + ix] = this.hgt(x, z);
      }
    }
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, this.sample(x, z));
    }
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo, this.terrainMat);
    terrain.receiveShadow = true;
    this.scene.add(terrain);

    const wgeo = new THREE.PlaneGeometry(SIZE * 1.6, SIZE * 1.6, 1, 1);
    const wmat = new THREE.MeshStandardMaterial({
      map: this.texMaps.water,
      color: 0x6ec4d4,
      transparent: true,
      opacity: 0.72,
      roughness: 0.15,
      metalness: 0.1,
      depthWrite: false,
    });
    if (wmat.map) wmat.map.repeat.set(18, 18);
    this.water = new THREE.Mesh(wgeo, wmat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = WATER_Y;
    this.scene.add(this.water);

    this.scatter();
    this.spawnFauna();
    this.makeCamps();
    this.makeRain();
  }

  private makeInst(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    n: number,
    kind: PropKind,
    place: (i: number, dummy: THREE.Object3D) => { hp: number; drop: ItemId; extra?: ItemId; x: number; z: number; r: number } | null,
  ): InstProps {
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.frustumCulled = false;
    const hp = new Float32Array(n);
    const max = new Float32Array(n);
    const drop: ItemId[] = [];
    const extra: ItemId[] = [];
    const alive = new Uint8Array(n);
    const xs = new Float32Array(n);
    const zs = new Float32Array(n);
    const rs = new Float32Array(n);
    let k = 0;
    for (let i = 0; i < n * 8 && k < n; i++) {
      this.dummy.position.set(0, 0, 0);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      const p = place(k, this.dummy);
      if (!p) continue;
      this.dummy.updateMatrix();
      mesh.setMatrixAt(k, this.dummy.matrix);
      hp[k] = p.hp;
      max[k] = p.hp;
      drop[k] = p.drop;
      extra[k] = p.extra ?? p.drop;
      alive[k] = 1;
      xs[k] = p.x;
      zs[k] = p.z;
      rs[k] = p.r;
      k++;
    }
    mesh.count = k;
    this.scene.add(mesh);
    const rec: InstProps = { mesh, kind, hp, max, drop, extra, alive, x: xs, z: zs, r: rs };
    this.inst.push(rec);
    return rec;
  }

  private makeBills(
    texName: string,
    n: number,
    kind: PropKind,
    w: number,
    h: number,
    place: () => { hp: number; drop: ItemId; extra?: ItemId; x: number; z: number; r: number } | null,
  ): InstProps {
    const tex = this.spriteTex[texName];
    const mat = tex
      ? new THREE.MeshStandardMaterial({
          map: tex,
          transparent: true,
          alphaTest: 0.35,
          side: THREE.DoubleSide,
          roughness: 0.86,
          metalness: 0,
        })
      : new THREE.MeshStandardMaterial({ color: 0x3a7a38 });
    const geo = new THREE.PlaneGeometry(1, 1);
    const dummyGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    const mesh = new THREE.InstancedMesh(dummyGeo, this.woodMat, n);
    mesh.visible = false;
    mesh.frustumCulled = false;
    const hp = new Float32Array(n);
    const max = new Float32Array(n);
    const drop: ItemId[] = [];
    const extra: ItemId[] = [];
    const alive = new Uint8Array(n);
    const xs = new Float32Array(n);
    const zs = new Float32Array(n);
    const rs = new Float32Array(n);
    const vis: THREE.Object3D[] = [];
    let k = 0;
    for (let i = 0; i < n * 10 && k < n; i++) {
      const p = place();
      if (!p) continue;
      const group = new THREE.Group();
      const jitter = 0.85 + this.rng() * 0.35;
      group.scale.set(w * jitter, h * jitter, w * jitter);
      for (let a = 0; a < 3; a++) {
        const card = new THREE.Mesh(geo, mat);
        card.position.y = 0.5;
        card.rotation.y = (a * Math.PI) / 3;
        group.add(card);
      }
      if (kind === "tree") {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.05, 0.42, 6),
          this.woodMat,
        );
        trunk.position.y = 0.2;
        group.add(trunk);
      }
      group.position.set(p.x, this.sample(p.x, p.z), p.z);
      group.rotation.y = this.rng() * Math.PI;
      this.scene.add(group);
      vis[k] = group;
      hp[k] = p.hp;
      max[k] = p.hp;
      drop[k] = p.drop;
      extra[k] = p.extra ?? p.drop;
      alive[k] = 1;
      xs[k] = p.x;
      zs[k] = p.z;
      rs[k] = p.r;
      k++;
    }
    mesh.count = k;
    const rec: InstProps = { mesh, kind, hp, max, drop, extra, alive, x: xs, z: zs, r: rs, vis };
    this.inst.push(rec);
    return rec;
  }

  private scatter() {
    const tryPlace = (minH: number, maxH: number, minD: number, maxD: number) => {
      const a = this.rng() * Math.PI * 2;
      const d = minD + this.rng() * (maxD - minD);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      const y = this.sample(x, z);
      if (y < minH || y > maxH) return null;
      if (x * x + (z - 86) * (z - 86) < 14 * 14) return null;
      return { x, z, y };
    };

    this.makeBills("palm", 36, "tree", 6.6, 10.4, () => {
      const p = tryPlace(0.35, 3.4, 52, 94);
      if (!p) return null;
      return { hp: 75, drop: "wood" as ItemId, extra: "fiber", x: p.x, z: p.z, r: 0.55 };
    });
    this.makeBills("oak", 48, "tree", 7.2, 8.6, () => {
      const p = tryPlace(1.4, 8.2, 8, 72);
      if (!p) return null;
      return { hp: 95, drop: "wood" as ItemId, extra: "fiber", x: p.x, z: p.z, r: 0.7 };
    });
    this.makeBills("pine", 32, "tree", 5.4, 9.8, () => {
      const p = tryPlace(6.2, 14, 4, 44);
      if (!p) return null;
      return { hp: 85, drop: "wood" as ItemId, extra: "coal", x: p.x, z: p.z, r: 0.55 };
    });
    this.makeBills("dead", 14, "tree", 4.8, 8.0, () => {
      const p = tryPlace(4, 12, 10, 80);
      if (!p) return null;
      return { hp: 50, drop: "wood" as ItemId, extra: "coal", x: p.x, z: p.z, r: 0.4 };
    });
    this.makeBills("rock_s", 28, "rock", 1.9, 1.45, () => {
      const p = tryPlace(0.3, 12, 8, 94);
      if (!p) return null;
      return { hp: 40, drop: "stone" as ItemId, extra: "coal", x: p.x, z: p.z, r: 0.55 };
    });
    this.makeBills("rock_m", 22, "rock", 2.7, 2.1, () => {
      const p = tryPlace(0.4, 11, 10, 90);
      if (!p) return null;
      return { hp: 70, drop: "stone" as ItemId, extra: "iron", x: p.x, z: p.z, r: 0.75 };
    });
    this.makeBills("rock_l", 16, "rock", 3.4, 2.6, () => {
      const p = tryPlace(1.0, 12, 12, 86);
      if (!p) return null;
      return { hp: 95, drop: "stone" as ItemId, extra: "iron", x: p.x, z: p.z, r: 0.95 };
    });
    this.makeBills("rock_gold", 10, "rock", 2.4, 1.9, () => {
      const p = tryPlace(5.5, 14, 6, 50);
      if (!p) return null;
      return { hp: 80, drop: "gold" as ItemId, extra: "sulfur", x: p.x, z: p.z, r: 0.65 };
    });
    this.makeBills("oak", 34, "bush", 1.6, 1.35, () => {
      const p = tryPlace(0.6, 5.2, 18, 88);
      if (!p) return null;
      const roll = this.rng();
      const drop: ItemId = roll > 0.55 ? "berries" : roll > 0.25 ? "fiber" : "herbs";
      return { hp: 16, drop, x: p.x, z: p.z, r: 0.45 };
    });
  }

  private body(kind: Creature["kind"]) {
    return this.makeRig(kind);
  }

  private playerPawn() {
    return this.makeRig("scout");
  }

  private makeRig(kind: string) {
    const quad = kind === "deer" || kind === "goat" || kind === "boar" || kind === "wolf" || kind === "bear";
    const key = kind === "goat" ? "deer" : kind === "scout" ? "scout" : kind;
    const tex = this.spriteTex[key] ?? this.spriteTex.scout;
    const tint =
      kind === "wolf" ? 0x8d8882 : kind === "bear" ? 0x5a4030 : kind === "boar" ? 0x7a5340 : kind === "deer" || kind === "goat" ? 0xa07848 : 0x6e5848;
    const mat = new THREE.MeshStandardMaterial({
      map: tex ?? null,
      color: 0xffffff,
      roughness: 0.78,
      metalness: 0.02,
    });
    const skin = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.84 });
    const g = new THREE.Group();
    const legs: THREE.Object3D[] = [];
    const s = kind === "bear" ? 1.28 : kind === "boar" ? 1.05 : kind === "goat" ? 0.82 : kind === "wolf" ? 0.95 : 1;
    if (quad) {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2 * s, 0.62 * s, 3, 7), mat);
      body.rotation.x = Math.PI / 2;
      body.position.y = 0.78 * s;
      body.castShadow = false;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 8, 6), mat);
      head.position.set(0, 0.98 * s, 0.42 * s);
      g.add(head);
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 0.08 * s, 0.16 * s), skin);
      snout.position.set(0, 0.9 * s, 0.56 * s);
      g.add(snout);
      for (const [x, z] of [
        [-0.14, 0.24],
        [0.14, 0.24],
        [-0.14, -0.22],
        [0.14, -0.22],
      ] as const) {
        const pivot = new THREE.Group();
        pivot.position.set(x * s, 0.72 * s, z * s);
        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.045 * s, 0.36 * s, 2, 5), skin);
        leg.position.y = -0.24 * s;
        pivot.add(leg);
        g.add(pivot);
        legs.push(pivot);
      }
      g.userData.body = body;
      g.userData.bodyY = body.position.y;
    } else {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.46, 3, 7), mat);
      body.position.y = 1.05;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), mat);
      head.position.y = 1.55;
      g.add(head);
      for (const x of [-0.11, 0.11]) {
        const pivot = new THREE.Group();
        pivot.position.set(x, 0.9, 0);
        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.4, 2, 5), skin);
        leg.position.y = -0.3;
        pivot.add(leg);
        g.add(pivot);
        legs.push(pivot);
      }
      for (const x of [-0.26, 0.26]) {
        const pivot = new THREE.Group();
        pivot.position.set(x, 1.28, 0);
        const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.3, 2, 5), skin);
        arm.position.y = -0.2;
        pivot.add(arm);
        g.add(pivot);
        legs.push(pivot);
      }
      g.userData.body = body;
      g.userData.bodyY = 1.05;
    }
    g.userData.legs = legs;
    g.userData.phase = Math.random() * 6;
    return g;
  }

  private stepRig(mesh: THREE.Object3D, dt: number, moving: boolean) {
    const legs = mesh.userData.legs as THREE.Object3D[] | undefined;
    if (!legs) return;
    let phase = (mesh.userData.phase as number) ?? 0;
    phase += dt * (moving ? 8.5 : 1.4);
    mesh.userData.phase = phase;
    const amp = moving ? 0.62 : 0.06;
    legs.forEach((leg, i) => {
      leg.rotation.x = Math.sin(phase + (i % 2) * Math.PI) * amp;
    });
    const body = mesh.userData.body as THREE.Object3D | undefined;
    const base = mesh.userData.bodyY as number | undefined;
    if (body && typeof base === "number") body.position.y = base + Math.sin(phase * 2) * (moving ? 0.035 : 0.008);
  }

  private spawnFauna() {
    const kinds: Creature["kind"][] = [
      "deer",
      "deer",
      "deer",
      "deer",
      "deer",
      "deer",
      "deer",
      "deer",
      "goat",
      "goat",
      "goat",
      "goat",
      "goat",
      "boar",
      "boar",
      "boar",
      "boar",
      "boar",
      "wolf",
      "wolf",
      "wolf",
      "wolf",
      "wolf",
      "bear",
      "bear",
      "bear",
    ];
    if (this.training) {
      kinds.splice(0, kinds.length, "deer", "deer", "deer", "boar", "wolf");
    }
    const stats: Record<Creature["kind"], Partial<Creature>> = {
      deer: { hp: 40, speed: 5.5, aggro: 14, melee: 1.6, dmg: 6, flee: true, ranged: 0, radius: 0.55 },
      goat: { hp: 35, speed: 5.0, aggro: 10, melee: 1.4, dmg: 5, flee: true, ranged: 0, radius: 0.5 },
      boar: { hp: 70, speed: 4.6, aggro: 10, melee: 1.7, dmg: 14, flee: false, ranged: 0, radius: 0.6 },
      wolf: { hp: 55, speed: 6.2, aggro: 18, melee: 1.5, dmg: 12, flee: false, ranged: 0, radius: 0.5 },
      bear: { hp: 150, speed: 4.2, aggro: 12, melee: 2.0, dmg: 22, flee: false, ranged: 0, radius: 0.85 },
      basic: { hp: 55, speed: 3.6, aggro: 16, melee: 1.8, dmg: 10, flee: false, ranged: 0, radius: 0.5 },
      armed: { hp: 80, speed: 3.4, aggro: 22, melee: 1.8, dmg: 12, flee: false, ranged: 18, radius: 0.5 },
      sniper: { hp: 60, speed: 2.8, aggro: 40, melee: 1.6, dmg: 18, flee: false, ranged: 38, radius: 0.5 },
      boss: { hp: 240, speed: 3.5, aggro: 28, melee: 2.2, dmg: 24, flee: false, ranged: 16, radius: 0.9 },
    };
    for (const kind of kinds) {
      let x = 0;
      let z = 0;
      let y = -1;
      for (let t = 0; t < 20; t++) {
        const a = this.rng() * Math.PI * 2;
        const d = 18 + this.rng() * 70;
        x = Math.cos(a) * d;
        z = Math.sin(a) * d;
        y = this.sample(x, z);
        if (y > 0.8) break;
      }
      if (kind === "bear") {
        x = 18;
        z = -24;
        y = this.sample(x, z);
      }
      const mesh = this.body(kind);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      const s = stats[kind];
      this.creatures.push({
        id: this.creatId++,
        mesh,
        kind,
        hp: s.hp!,
        max: s.hp!,
        speed: s.speed!,
        aggro: s.aggro!,
        melee: s.melee!,
        dmg: s.dmg!,
        flee: !!s.flee,
        ranged: s.ranged!,
        pos: new THREE.Vector3(x, y, z),
        vel: new THREE.Vector3(),
        yaw: this.rng() * 6,
        state: "wander",
        cd: 0,
        wanderT: 0,
        target: new THREE.Vector3(x, y, z),
        alive: true,
        radius: s.radius!,
        provoked: false,
      });
    }
  }

  private makeCamps() {
    const plank = this.texMaps.planks;
    const mat = new THREE.MeshStandardMaterial({ map: plank, roughness: 0.82 });
    const barrelMat = new THREE.MeshStandardMaterial({ map: this.texMaps.bark, color: 0x8a6238, roughness: 0.7 });
    const spots = [
      [48, -20],
      [-40, 30],
      [20, -50],
      [-22, -38],
      [55, 18],
    ];
    for (const [x, z] of spots) {
      const y = Math.max(this.sample(x, z), 0.4);
      const floor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.28, 6), mat);
      floor.position.set(x, y + 0.14, z);
      this.scene.add(floor);
      this.builds.push({
        id: this.buildId++,
        type: "foundation",
        mesh: floor,
        pos: new THREE.Vector3(x, y, z),
        rot: 0,
        hx: 3,
        hz: 3,
      });
      for (const [dx, dz, ry] of [
        [0, -3, 0],
        [0, 3, 0],
        [-3, 0, Math.PI / 2],
      ]) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(6, 2.35, 0.22), mat);
        w.position.set(x + (dx as number), y + 1.28, z + (dz as number));
        w.rotation.y = ry as number;
        this.scene.add(w);
        this.builds.push({
          id: this.buildId++,
          type: "wall",
          mesh: w,
          pos: new THREE.Vector3(x + (dx as number), y, z + (dz as number)),
          rot: ry as number,
          hx: 3,
          hz: 0.2,
        });
      }
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.35, 0.7, 10), barrelMat);
      barrel.position.set(x + 1.4, y + 0.5, z + 1.1);
      this.scene.add(barrel);
      this.builds.push({
        id: this.buildId++,
        type: "crate",
        mesh: barrel,
        pos: barrel.position.clone(),
        rot: 0,
        hx: 0.38,
        hz: 0.38,
      });
    }
  }

  private makeRain() {
    const n = 420;
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (this.rng() - 0.5) * 70;
      arr[i * 3 + 1] = this.rng() * 28;
      arr[i * 3 + 2] = (this.rng() - 0.5) * 70;
    }
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    const m = new THREE.PointsMaterial({ color: 0xa8c8e0, size: 0.08, transparent: true, opacity: 0.0 });
    this.rain = new THREE.Points(g, m);
    this.scene.add(this.rain);
  }

  private findSpawn() {
    const spots: [number, number][] = [
      [0, 88],
      [6, 86],
      [-6, 86],
      [10, 84],
      [-10, 84],
      [0, 92],
      [14, 80],
      [-14, 80],
      [0, 78],
    ];
    for (const [x, z] of spots) {
      const y = this.sample(x, z);
      if (y < WATER_Y + 0.2 || y > 3.4) continue;
      let ok = true;
      for (const rec of this.inst) {
        const n = rec.mesh.count;
        for (let i = 0; i < n; i++) {
          if (!rec.alive[i]) continue;
          const dx = rec.x[i] - x;
          const dz = rec.z[i] - z;
          if (dx * dx + dz * dz < 25) {
            ok = false;
            break;
          }
        }
        if (!ok) break;
      }
      if (ok) return { x, y, z };
    }
    const y = Math.max(this.sample(0, 90), WATER_Y + 0.4);
    return { x: 0, y, z: 90 };
  }

  private resetPlayer(giveItems: boolean) {
    const spawn = this.findSpawn();
    this.pos.set(spawn.x, spawn.y, spawn.z);
    this.vel.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0.08;
    this.health = 100;
    this.hunger = 100;
    this.thirst = 100;
    this.stamina = 100;
    this.armor = 0;
    this.temp = 58;
    this.dead = false;
    this.time = 0.28;
    if (giveItems) {
      useGameStore.getState().patch({ inventory: freshInventory(this.training) });
    }
  }

  private buildWeapon(id: ItemId | "fists") {
    this.weapon.clear();
    const wood = new THREE.MeshStandardMaterial({ color: 0x8b6239, roughness: 0.8 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.6, roughness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x222, roughness: 0.5 });
    const skin = this.armMat;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.42), skin);
    arm.position.set(-0.18, -0.06, 0.12);
    this.weapon.add(arm);
    const arm2 = arm.clone();
    arm2.position.set(0.08, -0.08, 0.18);
    this.weapon.add(arm2);
    const add = (mesh: THREE.Mesh, x: number, y: number, z: number) => {
      mesh.position.set(x, y, z);
      this.weapon.add(mesh);
    };
    if (id === "axe") {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.7, 6), wood);
      h.rotation.z = 0.5;
      add(h, 0.05, -0.05, -0.15);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.16), metal);
      add(head, 0.22, 0.22, -0.38);
    } else if (id === "pickaxe") {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.7, 6), wood);
      h.rotation.z = 0.45;
      add(h, 0.05, -0.05, -0.15);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.08), metal);
      add(head, 0.22, 0.22, -0.38);
    } else if (id === "hammer") {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 6), wood);
      add(h, 0.12, 0.0, -0.2);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.1), metal), 0.12, 0.28, -0.38);
    } else if (id === "knife") {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.18), wood), 0.16, -0.04, -0.22);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.28), metal), 0.16, -0.02, -0.42);
    } else if (id === "spear") {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.15, 6), wood);
      h.rotation.x = Math.PI / 2;
      add(h, 0.1, -0.04, -0.35);
      add(new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 5), metal), 0.1, -0.04, -0.95);
    } else if (id === "bow") {
      const b = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.018, 5, 10, Math.PI), wood);
      b.rotation.y = Math.PI / 2;
      add(b, 0.12, 0.0, -0.35);
    } else if (id === "pistol") {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.28), dark), 0.14, -0.02, -0.32);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.08), dark), 0.14, -0.12, -0.18);
    } else if (id === "rifle") {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.72), dark), 0.12, -0.02, -0.45);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.08), wood), 0.12, -0.12, -0.12);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 6), metal), 0.12, 0.0, -0.85);
    } else if (id === "grenade") {
      add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3a6a32 })), 0.16, -0.02, -0.28);
    }
  }

  private held(): Slot {
    return hotItem(useGameStore.getState().inventory, useGameStore.getState().hotIndex);
  }

  private resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.cam.aspect = w / Math.max(1, h);
    this.cam.updateProjectionMatrix();
    this.wcam.aspect = this.cam.aspect;
    this.wcam.updateProjectionMatrix();
  };

  private loop = (now: number) => {
    if (!this.running) return;
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    this.acc += dt;
    while (this.acc >= FIXED) {
      this.fixed(FIXED);
      this.acc -= FIXED;
    }
    this.draw(dt);
    this.fpsA += dt;
    this.fpsN++;
    if (this.fpsA >= 0.4) {
      this.fps = Math.round(this.fpsN / this.fpsA);
      this.fpsA = 0;
      this.fpsN = 0;
    }
  };

  private pressed(code: string) {
    const src = this.input.injected ?? this.input.keys;
    return src.has(code) && !this.prevKeys.has(code);
  }

  private fixed(dt: number) {
    const st = useGameStore.getState();
    if (st.screen !== "playing" || this.dead) {
      this.prevKeys = new Set(this.input.injected ?? this.input.keys);
      return;
    }
    this.session += dt;
    this.handleUiKeys();
    if (this.typing) this.input.flush();
    const blocked = this.overlay !== "none";
    const act = this.input.sample();
    if (!blocked) this.simulate(dt, act);
    this.prevKeys = new Set(this.input.injected ?? this.input.keys);
    this.hudT += dt;
    if (this.hudT > 0.12) {
      this.hudT = 0;
      this.pushHud();
    }
    this.saveT += dt;
    if (this.saveT > 12) {
      this.saveT = 0;
      this.save();
    }
  }

  private handleUiKeys() {
    if (this.typing) return;
    if (this.pressed("Escape")) {
      if (this.overlay !== "none") this.setOverlay("none");
      else {
        const paused = useGameStore.getState().screen === "paused";
        useGameStore.getState().setScreen(paused ? "playing" : "paused");
        if (!paused && document.pointerLockElement) document.exitPointerLock();
      }
      return;
    }
    if (this.pressed("Tab") || this.pressed("KeyI")) {
      this.setOverlay(this.overlay === "inventory" ? "none" : "inventory");
    }
    if (this.pressed("KeyC")) this.setOverlay(this.overlay === "craft" ? "none" : "craft");
    if (this.pressed("KeyB")) this.setOverlay(this.overlay === "craft" ? "none" : "craft");
    if (this.pressed("KeyM")) this.setOverlay(this.overlay === "map" ? "none" : "map");
    for (let i = 1; i <= 8; i++) {
      if (this.pressed(`Digit${i}`)) useGameStore.getState().patch({ hotIndex: i - 1 });
    }
    const slot = this.held();
    const id = slot?.id ?? "fists";
    if (this.weapon.userData.id !== id) {
      this.weapon.userData.id = id;
      this.buildWeapon(id === "fists" ? "fists" : id);
    }
  }

  setOverlay(o: Overlay) {
    this.overlay = o;
    useGameStore.getState().setOverlay(o);
    if (o !== "none" && document.pointerLockElement) document.exitPointerLock();
  }

  applySettings(s: GameSettings) {
    this.settings = s;
    this.cam.fov = s.fov;
    this.cam.updateProjectionMatrix();
    const fog = this.scene.fog as THREE.Fog;
    fog.near = s.view * 0.28;
    fog.far = s.view;
    const cap = s.quality === "low" ? 0.75 : s.quality === "high" ? 1.35 : 1;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, cap));
  }

  setNetName(name: string) {
    this.netName = name;
  }

  setNameColor(color: string) {
    this.nameColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#ffffff";
  }

  setCombatSend(fn: ((msg: { t: "hit"; to: string; dmg: number; head: boolean }) => void) | null) {
    this.combatSend = fn;
  }

  applyIncoming(n: number, head: boolean) {
    const dmg = Math.max(1, Math.min(90, n));
    this.damage(dmg, true);
    if (head) useGameStore.getState().toast(t().headshot);
  }

  setTyping(v: boolean) {
    this.typing = v;
    if (v) {
      this.input.flush();
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }

  setAdmin(v: boolean) {
    this.isAdmin = v;
  }

  toggleGod() {
    if (!this.isAdmin) return false;
    this.godmode = !this.godmode;
    if (this.godmode) {
      this.health = 100;
      this.hunger = 100;
      this.thirst = 100;
      this.stamina = 100;
      this.dead = false;
    }
    return this.godmode;
  }

  toggleStaff() {
    if (!this.isAdmin) return false;
    this.staffmode = !this.staffmode;
    return this.staffmode;
  }

  netSnapshot() {
    if (this.staffmode) return null;
    return {
      t: "p" as const,
      x: this.pos.x,
      y: this.pos.y,
      z: this.pos.z,
      yaw: this.yaw,
      hp: this.health,
      name: this.netName,
      color: this.nameColor,
    };
  }

  giveItems(id: ItemId, n: number) {
    const inv = useGameStore.getState().inventory.slice();
    addItem(inv, id, n);
    useGameStore.getState().patch({ inventory: inv });
    useGameStore.getState().toast(`+${n}`);
  }

  syncRemote(
    id: string,
    s: { x: number; y: number; z: number; yaw: number; hp: number; name: string; color?: string },
  ) {
    let r = this.remotes.get(id);
    const color = s.color && /^#[0-9a-fA-F]{6}$/.test(s.color) ? s.color : "#ffffff";
    if (!r) {
      const mesh = this.playerPawn();
      mesh.add(this.makeNameTag(s.name || id, color));
      mesh.userData.color = color;
      this.scene.add(mesh);
      r = {
        id,
        mesh,
        pos: new THREE.Vector3(s.x, s.y, s.z),
        yaw: s.yaw,
        name: s.name,
        hp: s.hp,
        radius: 0.45,
      };
      this.remotes.set(id, r);
    } else if (r.name !== s.name || r.mesh.userData.color !== color) {
      const old = r.mesh.children.find((c) => c.userData.tag);
      if (old) r.mesh.remove(old);
      r.mesh.add(this.makeNameTag(s.name || id, color));
      r.mesh.userData.color = color;
      r.name = s.name;
    }
    r.pos.set(s.x, s.y, s.z);
    r.yaw = s.yaw;
    r.hp = s.hp;
    r.mesh.position.lerp(r.pos, 0.45);
    r.mesh.position.y = s.y;
    r.mesh.rotation.y = s.yaw;
    this.stepRig(r.mesh, 0.07, true);
  }

  dropRemote(id: string) {
    const r = this.remotes.get(id);
    if (!r) return;
    this.scene.remove(r.mesh);
    this.remotes.delete(id);
  }

  keepRemotes(ids: string[]) {
    const set = new Set(ids);
    for (const id of [...this.remotes.keys()]) {
      if (!set.has(id)) this.dropRemote(id);
    }
  }

  private makeNameTag(name: string, color = "#ffffff") {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, 256, 64);
      ctx.fillStyle = color;
      ctx.font = "700 28px Cairo, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(name.slice(0, 16), 128, 42);
    }
    const tex = new THREE.CanvasTexture(c);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    spr.scale.set(1.5, 0.38, 1);
    spr.position.y = 2.15;
    spr.userData.tag = true;
    spr.userData.color = color;
    return spr;
  }

  private simulate(dt: number, act: ReturnType<Input["sample"]>) {
    const sens = 0.0022 * this.settings.sens;
    this.yaw -= act.lookX * sens;
    this.pitch -= act.lookY * sens;
    const lim = Math.PI / 2 - 0.02;
    if (this.pitch > lim) this.pitch = lim;
    if (this.pitch < -lim) this.pitch = -lim;

    this.fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const sprint = act.sprint && this.stamina > 4 && act.moveY > 0;
    const speed = sprint ? 7.4 : 4.35;
    this.blocking = act.block && this.dodgeT <= 0 && this.stamina > 4;
    if (sprint) this.stamina = Math.max(0, this.stamina - 18 * dt);
    else if (!this.blocking) this.stamina = Math.min(100, this.stamina + 22 * dt);
    if (this.blocking) this.stamina = Math.max(0, this.stamina - 12 * dt);

    const wish = this.tmp.set(0, 0, 0);
    wish.addScaledVector(this.fwd, act.moveY);
    wish.addScaledVector(this.right, act.moveX);
    if (wish.lengthSq() > 1) wish.normalize();
    if (this.blocking) wish.multiplyScalar(0.45);
    if (act.dodge && this.dodgeCd <= 0 && this.stamina > 14 && this.dodgeT <= 0) {
      this.dodgeT = 0.38;
      this.dodgeCd = 0.95;
      this.stamina = Math.max(0, this.stamina - 14);
      let dx = this.fwd.x * act.moveY + this.right.x * act.moveX;
      let dz = this.fwd.z * act.moveY + this.right.z * act.moveX;
      if (Math.hypot(dx, dz) < 0.2) {
        dx = this.fwd.x;
        dz = this.fwd.z;
      }
      const len = Math.hypot(dx, dz) || 1;
      this.vel.x = (dx / len) * 16;
      this.vel.z = (dz / len) * 16;
      this.audio.swing();
    }
    this.dodgeT = Math.max(0, this.dodgeT - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT <= 0) this.combo = 0;
    this.hitMark = Math.max(0, this.hitMark - dt * 3);

    const h = this.sample(this.pos.x, this.pos.z);
    const inWater = h < WATER_Y - 0.05;
    const targetY = Math.max(h, inWater ? WATER_Y - 0.9 : h);
    if (this.pos.y <= targetY + 0.08) {
      this.onGround = true;
      this.pos.y = targetY;
      this.vel.y = 0;
      if (act.jump && this.stamina > 8) {
        this.vel.y = inWater ? 4.2 : 6.6;
        this.onGround = false;
        this.stamina -= 8;
      }
    } else {
      this.onGround = false;
      this.vel.y -= (inWater ? 8 : 21) * dt;
    }

    const accel = this.onGround ? 38 : 12;
    const max = inWater ? speed * 0.55 : speed;
    const vx = wish.x * max;
    const vz = wish.z * max;
    this.vel.x += (vx - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (vz - this.vel.z) * Math.min(1, accel * dt);

    const travel = Math.hypot(this.vel.x, this.vel.z, this.vel.y) * dt;
    const steps = Math.max(1, Math.min(6, Math.ceil(travel / 0.2)));
    const sdt = dt / steps;
    for (let s = 0; s < steps; s++) {
      const ox = this.pos.x;
      const oz = this.pos.z;
      this.pos.x += this.vel.x * sdt;
      this.pos.z += this.vel.z * sdt;
      this.pos.y += this.vel.y * sdt;
      this.collideProps();
      this.collideBuilds();
      this.collideMobs(0.4);
      this.collideRemotes(0.4);
      const ground = this.sample(this.pos.x, this.pos.z);
      if (ground > this.pos.y + 0.95) {
        this.pos.x = ox;
        this.pos.z = oz;
      }
    }

    const moving = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && moving > 1.2) {
      this.bob += dt * (sprint ? 12 : 8);
      this.stepT += dt;
      if (this.stepT > (sprint ? 0.32 : 0.46)) {
        this.stepT = 0;
        this.audio.step();
      }
    }

    this.time = (this.time + dt / 240) % 1;
    this.rainT -= dt;
    if (this.rainT < 0) {
      this.raining = !this.raining;
      this.rainT = this.raining ? 28 + this.rng() * 18 : 50 + this.rng() * 40;
      this.audio.setRain(this.raining);
      if (this.raining) useGameStore.getState().toast(t().rain);
    }
    const night = this.time < 0.22 || this.time > 0.78;
    this.audio.setNight(night);

    if (this.godmode) {
      this.health = 100;
      this.hunger = 100;
      this.thirst = 100;
      this.stamina = 100;
      this.armor = 100;
      this.temp = 58;
      this.dead = false;
    } else if (!this.training) {
      this.hunger = Math.max(0, this.hunger - dt * 0.55);
      this.thirst = Math.max(0, this.thirst - dt * 0.72);
      if (this.raining) this.thirst = Math.min(100, this.thirst + dt * 0.35);
      if (this.hunger <= 0.1) this.damage(dt * 3.5, false);
      if (this.thirst <= 0.1) this.damage(dt * 4.2, false);
      if (this.hunger > 50 && this.thirst > 50 && this.health < 100) this.health = Math.min(100, this.health + dt * 2.2);
      const night = this.time < 0.22 || this.time > 0.78;
      const nearFire = this.nearStation === "fire" || this.nearStation === "furnace";
      const target = nearFire ? 72 : night || this.raining ? 28 : 56;
      this.temp += (target - this.temp) * Math.min(1, dt * 0.35);
      if (this.temp < 18) this.damage(dt * 2.2, false);
      if (this.temp > 88) this.damage(dt * 1.6, false);
    }

    this.fireCd = Math.max(0, this.fireCd - dt);
    this.swing = Math.max(0, this.swing - dt * 3.5);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.updateCreatures(dt);
    this.updateDrops(dt);
    this.updateBullets(dt);
    this.harvestAndUse(act, dt);
    this.updateStations();

    if (this.health <= 0 && !this.dead) {
      this.dead = true;
      useGameStore.getState().setScreen("dead");
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }

  private collideProps() {
    const pr = 0.38;
    for (const rec of this.inst) {
      if (rec.kind === "bush") continue;
      const n = rec.mesh.count;
      for (let i = 0; i < n; i++) {
        if (!rec.alive[i]) continue;
        const dx = this.pos.x - rec.x[i];
        const dz = this.pos.z - rec.z[i];
        const rad = rec.r[i] + pr;
        const d2 = dx * dx + dz * dz;
        if (d2 < rad * rad && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const k = (rad - d) / d;
          this.pos.x += dx * k;
          this.pos.z += dz * k;
        }
      }
    }
  }

  private collideBuilds() {
    const pr = 0.4;
    for (const b of this.builds) {
      if (b.type === "door" && b.open) continue;
      const hx = b.hx ?? (b.type === "foundation" || b.type === "roof" ? 0.85 : 0.25);
      const hz = b.hz ?? (b.type === "wall" || b.type === "window" || b.type === "door" ? 0.2 : 0.85);
      const dx = this.pos.x - b.pos.x;
      const dz = this.pos.z - b.pos.z;
      const ca = Math.cos(-b.rot);
      const sa = Math.sin(-b.rot);
      const lx = dx * ca - dz * sa;
      const lz = dx * sa + dz * ca;
      const px = Math.max(-hx, Math.min(hx, lx));
      const pz = Math.max(-hz, Math.min(hz, lz));
      const ox = lx - px;
      const oz = lz - pz;
      if (ox * ox + oz * oz < pr * pr) {
        const d = Math.max(0.001, Math.hypot(ox, oz));
        const nx = ox / d;
        const nz = oz / d;
        const wx = nx * ca + nz * sa;
        const wz = -nx * sa + nz * ca;
        this.pos.x += wx * (pr - d);
        this.pos.z += wz * (pr - d);
      }
    }
  }

  private collideMobs(pr: number) {
    for (const c of this.creatures) {
      if (!c.alive) continue;
      const dx = this.pos.x - c.pos.x;
      const dz = this.pos.z - c.pos.z;
      const rad = c.radius + pr;
      const d2 = dx * dx + dz * dz;
      if (d2 < rad * rad && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const k = (rad - d) / d;
        this.pos.x += dx * k * 0.65;
        this.pos.z += dz * k * 0.65;
        c.pos.x -= dx * k * 0.35;
        c.pos.z -= dz * k * 0.35;
      }
    }
  }

  private collideRemotes(pr: number) {
    for (const r of this.remotes.values()) {
      const dx = this.pos.x - r.pos.x;
      const dz = this.pos.z - r.pos.z;
      const rad = r.radius + pr;
      const d2 = dx * dx + dz * dz;
      if (d2 < rad * rad && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const k = (rad - d) / d;
        this.pos.x += dx * k;
        this.pos.z += dz * k;
      }
    }
  }

  private updateCreatures(dt: number) {
    const night = this.time < 0.22 || this.time > 0.78;
    for (const c of this.creatures) {
      if (!c.alive) {
        c.mesh.visible = false;
        continue;
      }
      c.cd = Math.max(0, c.cd - dt);
      const toP = this.tmp.copy(this.pos).sub(c.pos);
      toP.y = 0;
      const dist = toP.length();
      const aggro = c.aggro * (night && (c.kind === "wolf" || c.kind === "bear") ? 1.45 : 1);
      const wildlife = c.kind === "deer" || c.kind === "goat" || c.kind === "boar" || c.kind === "wolf" || c.kind === "bear";
      if (wildlife && !c.provoked) {
        c.wanderT -= dt;
        if (c.wanderT <= 0) {
          c.wanderT = 2 + this.rng() * 4;
          const a = this.rng() * Math.PI * 2;
          c.target.set(c.pos.x + Math.cos(a) * 8, 0, c.pos.z + Math.sin(a) * 8);
        }
        c.state = "wander";
      } else if (c.flee && (c.provoked || dist < aggro)) {
        c.state = "flee";
      } else if (!c.flee && dist < aggro && (!wildlife || c.provoked)) {
        c.state = dist < c.melee ? "attack" : "chase";
      } else {
        c.wanderT -= dt;
        if (c.wanderT <= 0) {
          c.wanderT = 2 + this.rng() * 4;
          const a = this.rng() * Math.PI * 2;
          c.target.set(c.pos.x + Math.cos(a) * 8, 0, c.pos.z + Math.sin(a) * 8);
        }
        c.state = "wander";
      }
      let dirx = 0;
      let dirz = 0;
      if (c.state === "wander") {
        dirx = c.target.x - c.pos.x;
        dirz = c.target.z - c.pos.z;
      } else if (c.state === "chase") {
        dirx = this.pos.x - c.pos.x;
        dirz = this.pos.z - c.pos.z;
        if (c.ranged > 0 && dist < c.ranged && dist > 8 && c.cd <= 0) {
          this.creatureShoot(c);
          c.cd = c.kind === "sniper" ? 2.2 : 1.1;
        }
      } else if (c.state === "flee") {
        dirx = c.pos.x - this.pos.x;
        dirz = c.pos.z - this.pos.z;
      } else if (c.state === "attack" && c.cd <= 0) {
        this.damage(c.dmg, true);
        c.cd = 0.9;
      }
      const len = Math.hypot(dirx, dirz) || 1;
      const sp = c.speed * (c.state === "wander" ? 0.45 : 1);
      c.pos.x += (dirx / len) * sp * dt;
      c.pos.z += (dirz / len) * sp * dt;
      this.solidAt(c.pos, c.radius, c);
      c.pos.y = this.sample(c.pos.x, c.pos.z);
      if (c.pos.y < WATER_Y) {
        c.pos.x -= (dirx / len) * sp * dt * 2;
        c.pos.z -= (dirz / len) * sp * dt * 2;
        this.solidAt(c.pos, c.radius, c);
        c.pos.y = this.sample(c.pos.x, c.pos.z);
      }
      c.yaw = Math.atan2(dirx, dirz);
      c.mesh.position.copy(c.pos);
      c.mesh.rotation.y = c.yaw;
      this.stepRig(c.mesh, dt, c.state !== "attack");
    }
  }

  private solidAt(p: THREE.Vector3, r: number, skip?: Creature) {
    for (const rec of this.inst) {
      if (rec.kind === "bush") continue;
      const n = rec.mesh.count;
      for (let i = 0; i < n; i++) {
        if (!rec.alive[i]) continue;
        const dx = p.x - rec.x[i];
        const dz = p.z - rec.z[i];
        const rad = rec.r[i] + r;
        const d2 = dx * dx + dz * dz;
        if (d2 < rad * rad && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const k = (rad - d) / d;
          p.x += dx * k;
          p.z += dz * k;
        }
      }
    }
    for (const o of this.creatures) {
      if (!o.alive || o === skip) continue;
      const dx = p.x - o.pos.x;
      const dz = p.z - o.pos.z;
      const rad = o.radius + r;
      const d2 = dx * dx + dz * dz;
      if (d2 < rad * rad && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const k = (rad - d) / (2 * d);
        p.x += dx * k;
        p.z += dz * k;
        o.pos.x -= dx * k;
        o.pos.z -= dz * k;
      }
    }
  }

  private creatureShoot(c: Creature) {
    const dir = this.tmp.copy(this.pos).add(this.tmp2.set(0, this.eye, 0)).sub(c.pos).normalize();
    this.spawnBullet(c.pos.x, c.pos.y + 1.1, c.pos.z, dir, 28, c.dmg, 0, true);
  }

  private spawnBullet(
    x: number,
    y: number,
    z: number,
    dir: THREE.Vector3,
    speed: number,
    dmg: number,
    splash: number,
    fromEnemy: boolean,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(splash ? 0.1 : 0.04, 6, 6),
      new THREE.MeshBasicMaterial({ color: splash ? 0x3a7a32 : 0xffe0a0 }),
    );
    mesh.position.set(x, y, z);
    mesh.userData.fromEnemy = fromEnemy;
    this.scene.add(mesh);
    this.bullets.push({
      mesh,
      vel: dir.clone().multiplyScalar(speed),
      life: splash ? 2.4 : 1.6,
      dmg,
      splash,
    });
  }

  private updateBullets(dt: number) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      if (b.splash) b.vel.y -= 14 * dt;
      const ox = b.mesh.position.x;
      const oy = b.mesh.position.y;
      const oz = b.mesh.position.z;
      b.mesh.position.addScaledVector(b.vel, dt);
      const h = this.sample(b.mesh.position.x, b.mesh.position.z);
      let hit = b.life <= 0 || b.mesh.position.y < h + 0.1;
      if (!b.mesh.userData.fromEnemy) {
        for (const c of this.creatures) {
          if (!c.alive) continue;
          if (b.mesh.position.distanceTo(c.pos) < c.radius + 0.4) {
            this.hurtCreature(c, b.dmg);
            hit = true;
            break;
          }
        }
        if (!hit) {
          for (const r of this.remotes.values()) {
            const body = this.tmp3.set(r.pos.x, r.pos.y + 1, r.pos.z);
            if (b.mesh.position.distanceTo(body) < r.radius + 0.45) {
              this.strikePlayer(r.id, b.dmg, b.mesh.position.y > r.pos.y + 1.45);
              hit = true;
              break;
            }
          }
        }
      } else if (b.mesh.position.distanceTo(this.tmp.set(this.pos.x, this.pos.y + this.eye, this.pos.z)) < 0.7) {
        this.damage(b.dmg, true);
        hit = true;
      }
      if (hit) {
        if (b.splash) this.explode(b.mesh.position, b.dmg);
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose();
        this.bullets.splice(i, 1);
      }
      void ox;
      void oy;
      void oz;
    }
  }

  private explode(p: THREE.Vector3, dmg: number) {
    this.audio.explode();
    for (const c of this.creatures) {
      if (!c.alive) continue;
      const d = c.pos.distanceTo(p);
      if (d < 5) this.hurtCreature(c, dmg * (1 - d / 5));
    }
    for (const r of this.remotes.values()) {
      const d = r.pos.distanceTo(p);
      if (d < 5) this.strikePlayer(r.id, dmg * (1 - d / 5), false);
    }
    if (this.pos.distanceTo(p) < 5) this.damage(dmg * (1 - this.pos.distanceTo(p) / 5), true);
  }

  private hurtCreature(c: Creature, dmg: number, head = false) {
    c.hp -= dmg;
    c.provoked = true;
    c.state = c.flee ? "flee" : "chase";
    this.audio.hit();
    this.flash(c.mesh);
    this.markHit(head);
    if (c.hp <= 0) {
      c.alive = false;
      c.mesh.visible = false;
      this.kills++;
      this.score += c.kind === "boss" ? 250 : c.kind === "bear" ? 80 : 40;
      const drop: ItemId = c.kind === "deer" || c.kind === "boar" || c.kind === "bear" ? "meat" : c.kind === "wolf" ? "fiber" : "cloth";
      this.spawnDrop(c.pos.x, c.pos.y + 0.4, c.pos.z, drop, 1 + (c.kind === "bear" ? 2 : 0));
      if (c.kind === "deer" || c.kind === "boar" || c.kind === "wolf" || c.kind === "bear" || c.kind === "goat") this.quest("hunt", 1);
      else this.quest("raid", 1);
    }
  }

  private markHit(head: boolean) {
    this.hitMark = 1;
    useGameStore.getState().patch({ hitMark: 1, combo: this.combo });
    if (head) useGameStore.getState().toast(t().headshot);
  }

  private strikePlayer(id: string, dmg: number, head: boolean) {
    const dealt = Math.max(1, Math.round(head ? dmg * 1.5 : dmg));
    this.combatSend?.({ t: "hit", to: id, dmg: dealt, head });
    this.audio.hit();
    this.markHit(head);
  }

  private flash(obj: THREE.Object3D) {
    obj.traverse((o) => {
      const spr = o as THREE.Sprite;
      if (spr.isSprite) {
        const mat = spr.material as THREE.SpriteMaterial;
        mat.color.setHex(0xffcc88);
        setTimeout(() => mat.color.setHex(0xffffff), 90);
        return;
      }
      const m = o as THREE.Mesh;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat && mat.emissive) {
        mat.emissive.setHex(0xffaa66);
        setTimeout(() => mat.emissive.setHex(0x000000), 80);
      }
    });
  }

  damage(n: number, hitSound: boolean) {
    if (this.godmode || this.dodgeT > 0) return;
    const taken = this.blocking ? n * 0.18 : n;
    const absorb = Math.min(taken * 0.6, this.armor);
    this.armor = Math.max(0, this.armor - absorb);
    this.health = Math.max(0, this.health - (taken - absorb));
    this.hurtT = this.blocking ? 0.12 : 0.35;
    if (hitSound && !this.blocking) this.audio.hurt();
  }

  private harvestAndUse(act: ReturnType<Input["sample"]>, dt: number) {
    this.fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const look = this.tmp.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    const origin = this.tmp2.set(this.pos.x, this.pos.y + this.eye, this.pos.z);
    this.ray.set(origin, look);
    this.ray.far = 4.2;

    let prompt: { label: string; key: string } | null = null;
    const copy = t();
    const slot = this.held();
    const def = slot ? ITEM[slot.id] : null;

    let nearestDrop: Drop | null = null;
    let nd = 2.2;
    for (const d of this.drops) {
      const dist = d.mesh.position.distanceTo(this.pos);
      if (dist < nd) {
        nd = dist;
        nearestDrop = d;
      }
    }
    if (nearestDrop) prompt = { label: `${copy.loot} ${copy.items[nearestDrop.id]}`, key: "E" };

    const aimHit = this.pickProp(origin, look, 3.4);
    if (!prompt && aimHit) {
      prompt = {
        label: aimHit.rec.kind === "rock" ? copy.mine : aimHit.rec.kind === "tree" ? copy.chop : copy.loot,
        key: "E",
      };
    }
    const lookingWater = this.sample(this.pos.x + look.x * 2, this.pos.z + look.z * 2) < WATER_Y + 0.4 && this.pos.y < 1.6;
    if (!prompt && lookingWater && this.thirst < 95) prompt = { label: copy.drink, key: "E" };

    const placeId = def?.place;
    this.ghost.visible = false;
    let canPlace = false;
    let placePos: THREE.Vector3 | null = null;
    if (placeId) {
      const gy = this.sample(this.pos.x + this.fwd.x * 2.4, this.pos.z + this.fwd.z * 2.4);
      const gx = Math.round((this.pos.x + this.fwd.x * 2.4) / 1.5) * 1.5;
      const gz = Math.round((this.pos.z + this.fwd.z * 2.4) / 1.5) * 1.5;
      this.ghost.position.set(gx, gy + 0.2, gz);
      this.ghost.rotation.y = Math.round(this.yaw / (Math.PI / 2)) * (Math.PI / 2);
      this.ghost.visible = true;
      canPlace = gy > WATER_Y - 0.2;
      (this.ghost.material as THREE.MeshBasicMaterial).color.set(canPlace ? 0x6db56d : 0xc4453c);
      placePos = this.ghost.position.clone();
    }

    useGameStore.getState().patch({ prompt, aimOk: !!aimHit });

    if (act.interact) {
      if (nearestDrop) {
        this.takeDrop(nearestDrop);
      } else if (aimHit) {
        this.hitProp(aimHit.rec, aimHit.i, def);
      } else if (lookingWater) {
        this.thirst = Math.min(100, this.thirst + 28);
        this.audio.eat();
        const inv = useGameStore.getState().inventory.slice();
        if (this.rng() > 0.55) {
          addItem(inv, "fish", 1);
          useGameStore.getState().toast(`${copy.pickup} ${copy.items.fish}`);
        }
        useGameStore.getState().patch({ inventory: inv, thirst: this.thirst });
      } else {
        for (const b of this.builds) {
          if (b.pos.distanceTo(this.pos) < 2.4 && (b.type === "door" || b.type === "furnace" || b.type === "campfire" || b.type === "crate")) {
            if (b.type === "door") {
              b.open = !b.open;
              b.mesh.rotation.y = b.rot + (b.open ? Math.PI / 2 : 0);
            } else this.setOverlay("craft");
          }
        }
      }
    }

    if (act.fire && this.fireCd <= 0 && this.overlay === "none") {
      if (placeId && canPlace && placePos && slot) {
        this.placeBuild(placeId, placePos, this.ghost.rotation.y);
        const inv = useGameStore.getState().inventory.slice();
        takeItem(inv, slot.id, 1);
        useGameStore.getState().patch({ inventory: inv });
        this.fireCd = 0.35;
        this.audio.place();
        this.quest("base", 1);
      } else if (def && (def.hunger || def.heal || def.thirst) && def.kind === "none") {
        this.consume(def.id);
        this.fireCd = 0.4;
      } else {
        this.fireWeapon(def, origin, look);
      }
    }
    void dt;
  }

  private pickProp(origin: THREE.Vector3, dir: THREE.Vector3, maxd: number) {
    let best: { rec: InstProps; i: number; d: number } | null = null;
    for (const rec of this.inst) {
      const n = rec.mesh.count;
      for (let i = 0; i < n; i++) {
        if (!rec.alive[i]) continue;
        const y = this.sample(rec.x[i], rec.z[i]) + 1.2;
        const cx = rec.x[i] - origin.x;
        const cy = y - origin.y;
        const cz = rec.z[i] - origin.z;
        const t = cx * dir.x + cy * dir.y + cz * dir.z;
        if (t < 0.3 || t > maxd) continue;
        const px = origin.x + dir.x * t - rec.x[i];
        const py = origin.y + dir.y * t - y;
        const pz = origin.z + dir.z * t - rec.z[i];
        if (px * px + py * py * 0.4 + pz * pz < (rec.r[i] + 0.7) ** 2) {
          if (!best || t < best.d) best = { rec, i, d: t };
        }
      }
    }
    return best;
  }

  private hitProp(rec: InstProps, i: number, def: (typeof ITEM)[ItemId] | null) {
    const ok =
      rec.kind === "bush" ||
      (rec.kind === "tree" && def?.harvest === "tree") ||
      (rec.kind === "rock" && def?.harvest === "rock") ||
      (def?.kind === "melee" && rec.kind !== "rock");
    if (!ok) {
      useGameStore.getState().toast(rec.kind === "rock" ? t().mine : t().chop);
      return;
    }
    const dmg = def?.damage ?? 8;
    rec.hp[i] -= dmg;
    this.swing = 1;
    this.fireCd = def?.cooldown ?? 0.5;
    if (rec.kind === "rock") this.audio.mine();
    else this.audio.chop();
    const drops = 1 + (this.rng() > 0.6 ? 1 : 0);
    this.spawnDrop(rec.x[i], this.sample(rec.x[i], rec.z[i]) + 0.6, rec.z[i], rec.drop[i], drops);
    if (rec.kind === "tree") this.quest("tree", 1);
    if (rec.hp[i] <= 0) {
      rec.alive[i] = 0;
      this.dummy.position.set(0, -20, 0);
      this.dummy.scale.setScalar(0.001);
      this.dummy.updateMatrix();
      rec.mesh.setMatrixAt(i, this.dummy.matrix);
      rec.mesh.instanceMatrix.needsUpdate = true;
      if (rec.vis?.[i]) rec.vis[i].visible = false;
      if (rec.extra && rec.extra[i] && rec.extra[i] !== rec.drop[i]) {
        this.spawnDrop(rec.x[i], this.sample(rec.x[i], rec.z[i]) + 0.5, rec.z[i], rec.extra[i], 1);
      }
    }
  }

  private fireWeapon(def: (typeof ITEM)[ItemId] | null, origin: THREE.Vector3, look: THREE.Vector3) {
    const kind = def?.kind ?? "melee";
    if (kind !== "gun" && kind !== "bow" && kind !== "throw" && this.stamina < 6) return;
    const dmg = def?.damage ?? 10;
    this.swing = 1;
    this.fireCd = def?.cooldown ?? 0.45;
    if (kind === "gun" || kind === "bow") {
      const ammo = def?.ammo;
      if (ammo) {
        const inv = useGameStore.getState().inventory.slice();
        if (!takeItem(inv, ammo, 1)) {
          this.audio.ui();
          return;
        }
        useGameStore.getState().patch({ inventory: inv });
      }
      if (kind === "gun") this.audio.shoot();
      else this.audio.bow();
      this.pitch += 0.018;
      this.hitscan(origin, look, dmg, def?.range ?? 60);
    } else if (kind === "throw") {
      const inv = useGameStore.getState().inventory.slice();
      if (def && !takeItem(inv, def.id, 1)) return;
      useGameStore.getState().patch({ inventory: inv });
      this.spawnBullet(origin.x, origin.y, origin.z, look, 16, dmg, 5, false);
      this.audio.swing();
    } else {
      this.audio.swing();
      this.stamina = Math.max(0, this.stamina - 8);
      this.combo = (this.combo % 3) + 1;
      this.comboT = 0.7;
      const mult = this.combo === 3 ? 1.75 : this.combo === 2 ? 1.25 : 1;
      this.hitscan(origin, look, dmg * mult, def?.range ?? 2.4);
    }
  }

  private hitscan(origin: THREE.Vector3, dir: THREE.Vector3, dmg: number, range: number) {
    let best = range;
    let hitC: Creature | null = null;
    let hitRemote: RemotePawn | null = null;
    let head = false;
    const wide = range < 8 ? 0.55 : 0.28;
    for (const c of this.creatures) {
      if (!c.alive) continue;
      const center = this.tmp3.set(c.pos.x, c.pos.y + 0.85, c.pos.z);
      const to = this.tmp.copy(center).sub(origin);
      const t = to.dot(dir);
      if (t < 0.2 || t > best) continue;
      const closest = origin.clone().addScaledVector(dir, t);
      if (closest.distanceTo(center) < c.radius + wide) {
        best = t;
        hitC = c;
        hitRemote = null;
        head = closest.y > c.pos.y + 1.15;
      }
    }
    for (const r of this.remotes.values()) {
      const center = this.tmp3.set(r.pos.x, r.pos.y + 1, r.pos.z);
      const to = this.tmp.copy(center).sub(origin);
      const t = to.dot(dir);
      if (t < 0.2 || t > best) continue;
      const closest = origin.clone().addScaledVector(dir, t);
      if (closest.distanceTo(center) < r.radius + wide) {
        best = t;
        hitC = null;
        hitRemote = r;
        head = closest.y > r.pos.y + 1.4;
      }
    }
    if (hitC) this.hurtCreature(hitC, head ? dmg * 1.65 : dmg, head);
    if (hitRemote) this.strikePlayer(hitRemote.id, dmg, head);
    const geo = new THREE.BufferGeometry().setFromPoints([
      origin.clone(),
      origin.clone().addScaledVector(dir, Math.min(best, 28)),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe0a8, transparent: true, opacity: 0.7 }));
    this.scene.add(line);
    this.tracers.push({ mesh: line, t: 0.08 });
  }

  useConsumable(id: ItemId) {
    this.consume(id);
  }

  private consume(id: ItemId) {
    const def = ITEM[id];
    const inv = useGameStore.getState().inventory.slice();
    if (!takeItem(inv, id, 1)) return;
    if (def.hunger) this.hunger = Math.min(100, this.hunger + def.hunger);
    if (def.thirst) this.thirst = Math.min(100, this.thirst + def.thirst);
    if (def.heal) this.health = Math.min(100, this.health + def.heal);
    if (def.armor) this.armor = Math.min(100, this.armor + def.armor);
    useGameStore.getState().patch({ inventory: inv });
    this.audio.eat();
  }

  private placeBuild(type: ItemId, pos: THREE.Vector3, rot: number) {
    const maps = this.texMaps;
    const mat = new THREE.MeshStandardMaterial({
      map: type === "furnace" ? maps.rock : maps.planks,
      roughness: 0.86,
    });
    let geo: THREE.BufferGeometry = new THREE.BoxGeometry(1.5, 0.35, 1.5);
    let oy = 0.18;
    if (type === "wall" || type === "window") {
      geo = new THREE.BoxGeometry(1.5, 1.8, 0.18);
      oy = 1.05;
    }
    if (type === "door") {
      geo = new THREE.BoxGeometry(1.2, 1.8, 0.14);
      oy = 1.05;
    }
    if (type === "roof") {
      geo = new THREE.BoxGeometry(1.6, 0.16, 1.6);
      oy = 2.0;
    }
    if (type === "stairs") {
      geo = new THREE.BoxGeometry(1.5, 0.7, 1.5);
      oy = 0.4;
    }
    if (type === "crate") {
      geo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
      oy = 0.5;
    }
    if (type === "furnace" || type === "workbench") {
      geo = new THREE.BoxGeometry(type === "workbench" ? 1.4 : 1.0, type === "workbench" ? 0.85 : 1.2, 1.0);
      oy = type === "workbench" ? 0.48 : 0.65;
    }
    if (type === "campfire") {
      geo = new THREE.CylinderGeometry(0.55, 0.7, 0.35, 8);
      oy = 0.2;
    }
    if (type === "plant") {
      geo = new THREE.ConeGeometry(0.35, 0.9, 6);
      oy = 0.5;
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y + oy, pos.z);
    mesh.rotation.y = rot;
    this.scene.add(mesh);
    this.builds.push({ id: this.buildId++, type, mesh, pos: mesh.position.clone(), rot });
  }

  private spawnDrop(x: number, y: number, z: number, id: ItemId, n: number) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.28, 0.28),
      new THREE.MeshStandardMaterial({ color: 0xd4b56a, roughness: 0.5 }),
    );
    mesh.position.set(x + (this.rng() - 0.5), y, z + (this.rng() - 0.5));
    this.scene.add(mesh);
    this.drops.push({ mesh, id, n, life: 90 });
  }

  private takeDrop(d: Drop) {
    const inv = useGameStore.getState().inventory.slice();
    addItem(inv, d.id, d.n);
    this.gathered[d.id] = (this.gathered[d.id] ?? 0) + d.n;
    if (d.id === "wood") this.quest("wood", d.n);
    useGameStore.getState().patch({ inventory: inv });
    useGameStore.getState().toast(`${t().pickup} ${t().items[d.id]} ×${d.n}`);
    this.audio.pickup();
    this.scene.remove(d.mesh);
    d.mesh.geometry.dispose();
    (d.mesh.material as THREE.Material).dispose();
    this.drops = this.drops.filter((x) => x !== d);
  }

  private updateDrops(dt: number) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= dt;
      d.mesh.rotation.y += dt * 2;
      d.mesh.position.y += Math.sin(this.session * 3 + i) * dt * 0.15;
      if (d.life < 0) {
        this.scene.remove(d.mesh);
        this.drops.splice(i, 1);
      }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      this.tracers[i].t -= dt;
      if (this.tracers[i].t <= 0) {
        this.scene.remove(this.tracers[i].mesh);
        this.tracers[i].mesh.geometry.dispose();
        (this.tracers[i].mesh.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
  }

  private updateStations() {
    this.nearStation = "hand";
    for (const b of this.builds) {
      if (b.pos.distanceTo(this.pos) > 3.2) continue;
      if (b.type === "campfire") this.nearStation = "fire";
      if (b.type === "furnace") this.nearStation = "furnace";
      if (b.type === "workbench") this.nearStation = "bench";
    }
  }

  quest(id: QuestId, n: number) {
    this.quests[id] = Math.min(99, this.quests[id] + n);
  }

  craft(recipeId: string) {
    const r = RECIPES.find((x) => x.id === recipeId);
    if (!r) return false;
    if (r.station !== "hand" && r.station !== this.nearStation) return false;
    const inv = useGameStore.getState().inventory.slice();
    for (const [k, n] of Object.entries(r.cost)) {
      if (countItem(inv, k as ItemId) < (n ?? 0)) return false;
    }
    for (const [k, n] of Object.entries(r.cost)) takeItem(inv, k as ItemId, n ?? 0);
    addItem(inv, r.out, r.count);
    if (r.out === "axe") this.quest("axe", 1);
    useGameStore.getState().patch({ inventory: inv });
    this.audio.craft();
    useGameStore.getState().toast(`${t().make} ${t().items[r.out]}`);
    return true;
  }

  useHot(i: number) {
    useGameStore.getState().patch({ hotIndex: i });
  }

  respawn() {
    this.resetPlayer(false);
    this.dead = false;
    this.health = 70;
    useGameStore.getState().setScreen("playing");
  }

  private draw(dt: number) {
    const bobY = this.settings.headBob && this.onGround ? Math.sin(this.bob) * 0.045 : 0;
    this.cam.position.set(this.pos.x, this.pos.y + this.eye + bobY, this.pos.z);
    this.cam.rotation.order = "YXZ";
    this.cam.rotation.y = this.yaw;
    this.cam.rotation.x = this.pitch;
    if (this.hurtT > 0) {
      this.cam.position.x += (this.rng() - 0.5) * 0.04;
      this.cam.position.y += (this.rng() - 0.5) * 0.03;
    }
    const swayT = this.session;
    for (const rec of this.inst) {
      if (rec.kind !== "tree" || !rec.vis) continue;
      for (let i = 0; i < rec.vis.length; i++) {
        rec.vis[i].rotation.z = Math.sin(swayT * 1.2 + i) * 0.02;
      }
    }

    const ang = (this.time - 0.25) * Math.PI * 2;
    const sunDir = this.tmp.set(Math.cos(ang), Math.sin(ang), 0.25).normalize();
    this.sun.position.copy(this.cam.position).addScaledVector(sunDir, 80);
    this.sun.target.position.copy(this.cam.position);
    const day = Math.max(0, sunDir.y);
    const dusk = Math.max(0, 1 - Math.abs(sunDir.y) * 2);
    const night = sunDir.y < 0.05;
    const sky = new THREE.Color().setRGB(
      THREE.MathUtils.lerp(0.05, 0.53, day) + dusk * 0.25,
      THREE.MathUtils.lerp(0.07, 0.7, day) + dusk * 0.1,
      THREE.MathUtils.lerp(0.12, 0.83, day),
    );
    if (this.raining) sky.multiplyScalar(0.72);
    this.renderer.setClearColor(sky);
    (this.scene.fog as THREE.Fog).color.copy(sky);
    this.hemi.intensity = 0.35 + day * 0.7;
    this.sun.intensity = 0.15 + day * 1.4;
    this.sun.color.setRGB(1, 0.88 + dusk * 0.08, 0.7 + day * 0.2);
    this.terrainMat.uniforms.sunDir.value.copy(sunDir);
    this.terrainMat.uniforms.sunCol.value.set(this.sun.color);
    this.terrainMat.uniforms.ambient.value.set(sky.clone().multiplyScalar(0.45));
    void night;

    const wmat = this.water.material as THREE.MeshStandardMaterial;
    if (wmat.map) {
      wmat.map.offset.x += dt * 0.02;
      wmat.map.offset.y += dt * 0.013;
    }

    const rp = this.rain.geometry.attributes.position as THREE.BufferAttribute;
    const rainMat = this.rain.material as THREE.PointsMaterial;
    rainMat.opacity = this.raining && this.settings.particles ? 0.55 : 0;
    if (this.raining && this.settings.particles) {
      for (let i = 0; i < rp.count; i++) {
        let y = rp.getY(i) - dt * 22;
        if (y < 0) y = 22;
        rp.setXYZ(i, this.cam.position.x + ((i * 17) % 70) - 35, y, this.cam.position.z + ((i * 29) % 70) - 35);
      }
      rp.needsUpdate = true;
    }

    this.weapon.rotation.x = -this.swing * 0.7;
    this.weapon.position.y = -0.28 - this.swing * 0.08;
    this.weapon.position.x = 0.32 + Math.sin(this.bob) * 0.02;

    this.renderer.clear();
    this.renderer.render(this.scene, this.cam);
    this.renderer.clearDepth();
    this.wcam.rotation.copy(this.cam.rotation);
    this.renderer.render(this.wscene, this.wcam);

    this.mapT += dt;
    if (this.mapT > 0.85) {
      this.mapT = 0;
      this.paintMinimap();
    }
  }

  private paintMinimap() {
    const ctx = this.mapCanvas.getContext("2d");
    if (!ctx) return;
    const w = 160;
    ctx.fillStyle = "#0b3040";
    ctx.fillRect(0, 0, w, w);
    const scale = 1.6;
    for (let y = 0; y < w; y += 3) {
      for (let x = 0; x < w; x += 3) {
        const wx = this.pos.x + (x - 80) * scale;
        const wz = this.pos.z + (y - 80) * scale;
        const h = this.sample(wx, wz);
        if (h < WATER_Y) ctx.fillStyle = "#1b6a88";
        else if (h < 1.4) ctx.fillStyle = "#c4b07a";
        else if (h < 7) ctx.fillStyle = "#2f6a38";
        else ctx.fillStyle = "#8a8680";
        ctx.fillRect(x, y, 3, 3);
      }
    }
    ctx.save();
    ctx.translate(80, 80);
    ctx.rotate(-this.yaw);
    ctx.fillStyle = "#e8e0d4";
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    useGameStore.getState().patch({ minimap: this.mapCanvas.toDataURL("image/jpeg", 0.55) });
  }

  private pushHud() {
    const inv = useGameStore.getState().inventory;
    const craftedAxe = inv.some((s) => s?.id === "axe") ? Math.max(this.quests.axe, 1) : this.quests.axe;
    useGameStore.getState().patch({
      health: this.health,
      hunger: this.hunger,
      thirst: this.thirst,
      stamina: this.stamina,
      armor: this.armor,
      temp: this.temp,
      timeOfDay: this.time,
      raining: this.raining,
      fps: this.fps,
      session: this.session,
      yaw: this.yaw,
      kills: this.kills,
      score: this.score,
      locked: this.locked,
      nearStation: this.nearStation,
      hurt: this.hurtT,
      hitMark: this.hitMark,
      combo: this.combo,
      blocking: this.blocking,
      quests: { ...this.quests, axe: craftedAxe, wood: this.gathered.wood ?? this.quests.wood },
    });
  }

  private wireControlsTest() {
    window.__controlsTest = {
      getYaw: () => this.yaw,
      getSpeed: () => Math.hypot(this.vel.x, this.vel.z),
      setKeys: (codes: string[]) => this.input.setKeys(codes),
      getPosition: () => ({ x: this.pos.x, y: this.pos.y, z: this.pos.z }),
    };
  }

  save() {
    const st = useGameStore.getState();
    const data = {
      v: 1,
      pos: [this.pos.x, this.pos.y, this.pos.z],
      yaw: this.yaw,
      pitch: this.pitch,
      health: this.health,
      hunger: this.hunger,
      thirst: this.thirst,
      stamina: this.stamina,
      armor: this.armor,
      temp: this.temp,
      time: this.time,
      kills: this.kills,
      score: this.score,
      quests: this.quests,
      gathered: this.gathered,
      training: this.training,
      outfit: this.outfit,
      inventory: st.inventory,
      session: this.session,
      builds: this.builds.map((b) => ({ type: b.type, x: b.mesh.position.x, y: b.mesh.position.y, z: b.mesh.position.z, rot: b.rot })),
    };
    try {
      localStorage.setItem(SAVE, JSON.stringify(data));
      useGameStore.getState().patch({ hasSave: true });
    } catch {
      /* ignore */
    }
  }

  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE);
      if (!raw) return false;
      const d = JSON.parse(raw) as {
        pos: number[];
        yaw: number;
        pitch: number;
        health: number;
        hunger: number;
        thirst: number;
        stamina: number;
        armor?: number;
        temp?: number;
        time: number;
        kills: number;
        score: number;
        quests: Record<QuestId, number>;
        gathered: Partial<Record<ItemId, number>>;
        inventory: Slot[];
        session: number;
        training: boolean;
        outfit: number;
        builds: { type: ItemId; x: number; y: number; z: number; rot: number }[];
      };
      this.pos.set(d.pos[0], d.pos[1], d.pos[2]);
      this.yaw = d.yaw;
      this.pitch = d.pitch;
      this.health = d.health;
      this.hunger = d.hunger;
      this.thirst = d.thirst;
      this.stamina = d.stamina;
      this.armor = d.armor ?? 0;
      this.temp = d.temp ?? 58;
      this.time = d.time;
      this.kills = d.kills;
      this.score = d.score;
      this.quests = d.quests;
      this.gathered = d.gathered ?? {};
      this.session = d.session;
      this.training = d.training;
      this.outfit = d.outfit;
      useGameStore.getState().patch({ inventory: d.inventory, outfit: d.outfit, training: d.training });
      for (const b of d.builds ?? []) {
        this.placeBuild(b.type, new THREE.Vector3(b.x, b.y - 0.18, b.z), b.rot);
      }
      return true;
    } catch {
      return false;
    }
  }
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys: (codes: string[]) => void;
      getPosition: () => { x: number; y: number; z: number };
    };
    __tribals?: TribalsEngine;
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem(SAVE);
  } catch {
    return false;
  }
}

export { countItem };
