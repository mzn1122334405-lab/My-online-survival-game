import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
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
const TILE = 2;
const WALL_H = 3.2;
const FLOOR_T = 0.22;
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
  kind: "deer" | "boar" | "wolf" | "bear" | "goat" | "chicken" | "fish" | "crab";
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
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  rot: number;
  open?: boolean;
  hx?: number;
  hz?: number;
  top?: number;
  code?: string;
  owners?: string[];
  bottom?: number;
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

type CaveHit = { x: number; z: number; yaw: number; hx: number; hz: number; bottom: number; top: number };
type Drop = { mesh: THREE.Object3D; id: ItemId; n: number; life: number };
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

function fitInv(old: Slot[] | undefined): Slot[] {
  const out: Slot[] = Array.from({ length: INV_SIZE + HOTBAR }, () => null);
  if (!old?.length) return out;
  const legacy = old.length === 48;
  const bag = legacy ? old.slice(0, 40) : old.slice(0, Math.max(0, old.length - (old.length > INV_SIZE ? HOTBAR : 0)));
  const hot = legacy ? old.slice(40) : old.length > INV_SIZE ? old.slice(-HOTBAR) : [];
  const extra: Slot[] = [];
  bag.forEach((s, i) => {
    if (!s) return;
    if (i < INV_SIZE) out[i] = s;
    else extra.push(s);
  });
  hot.forEach((s, i) => {
    if (!s) return;
    if (i < HOTBAR) out[INV_SIZE + i] = s;
    else extra.push(s);
  });
  for (const s of extra) {
    const at = out.findIndex((x) => !x);
    if (at >= 0) out[at] = s;
  }
  return out;
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
  private caveHits: CaveHit[] = [];
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
  solids: Record<string, THREE.Mesh> = {};
  windU = { value: 0 };

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
      new THREE.BoxGeometry(1, 1, 1),
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
    await this.loadSolids();
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

  private dress(mesh: THREE.Mesh, mode: number) {
    const prev = mesh.material as THREE.MeshStandardMaterial;
    const mat = new THREE.MeshStandardMaterial({
      map: prev.map ?? null,
      roughness: 0.82,
      metalness: 0.03,
      vertexColors: true,
    });
    const wind = this.windU;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = wind;
      shader.uniforms.uMode = { value: mode };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform float uMode;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          if (uMode < 0.5) {
            transformed.x += sin(uTime * 1.3 + position.y * 3.0) * position.y * position.y * 0.045;
            transformed.z += cos(uTime * 1.05 + position.y * 2.2) * position.y * position.y * 0.03;
          } else if (uMode < 1.5) {
            float leg = smoothstep(0.46, 0.08, position.y);
            float ph = uTime * 8.0 + position.z * 6.5 + step(0.0, position.x) * 3.14159;
            transformed.z += sin(ph) * leg * 0.08;
            transformed.y += max(sin(ph), 0.0) * leg * 0.045;
          } else {
            float leg = smoothstep(0.5, 0.05, position.y);
            float ph = uTime * 8.0 + position.x * 14.0;
            transformed.z += sin(ph) * leg * 0.1;
            transformed.y += max(sin(ph), 0.0) * leg * 0.04;
          }`,
        );
    };
    mesh.material = mat;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
  }

  private async loadSolids() {
    const loader = new GLTFLoader();
    const names = [
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
      "scout",
    ];
    const modeOf = (n: string) => (n === "scout" ? 2 : n === "deer" || n === "boar" || n === "wolf" || n === "bear" ? 1 : 0);
    await Promise.all(
      names.map(async (n) => {
        const gltf = await loader.loadAsync(`/models/${n}.glb`);
        const meshes: THREE.Mesh[] = [];
        gltf.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) meshes.push(m);
        });
        const found = meshes[0];
        if (!found) throw new Error(`solid ${n} has no mesh`);
        found.geometry.computeBoundingSphere();
        this.dress(found, modeOf(n));
        this.solids[n] = found;
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
    this.placeCaves();
    this.spawnFauna();
    this.makeCamps();
    this.placeBoats();
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
    const src = this.solids[texName];
    if (!src) throw new Error(`missing solid ${texName}`);
    const mesh = new THREE.InstancedMesh(src.geometry, src.material as THREE.Material, n);
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
    for (let i = 0; i < n * 10 && k < n; i++) {
      const p = place();
      if (!p) continue;
      const jitter = 0.88 + this.rng() * 0.24;
      const s = h * jitter;
      this.dummy.position.set(p.x, this.sample(p.x, p.z), p.z);
      this.dummy.rotation.set(0, this.rng() * Math.PI * 2, 0);
      this.dummy.scale.set(s, s, s);
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
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
    const rec: InstProps = { mesh, kind, hp, max, drop, extra, alive, x: xs, z: zs, r: rs };
    this.inst.push(rec);
    return rec;
  }

  private scatter() {
    const ring = (cx: number, cz: number, n: number, radius: number) => {
      const out: { x: number; z: number }[] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const d = radius * (0.5 + (i % 4) * 0.16);
        let x = cx + Math.cos(a) * d;
        let z = cz + Math.sin(a) * d * 0.82;
        for (let k = 0; k < 8; k++) {
          const y = this.sample(x, z);
          const spawn = x * x + (z - 86) * (z - 86) < 18 * 18;
          if (y >= 0.45 && y < 11 && !spawn) break;
          x *= 0.88;
          z *= 0.88;
        }
        out.push({ x, z });
      }
      return out;
    };
    const grove = (
      tex: string,
      kind: PropKind,
      w: number,
      h: number,
      pts: { x: number; z: number }[],
      hp: number,
      drop: ItemId,
      extra: ItemId,
      r: number,
    ) => {
      let i = 0;
      this.makeBills(tex, pts.length, kind, w, h, () => {
        const p = pts[i++];
        if (!p) return null;
        return { hp, drop, extra, x: p.x, z: p.z, r };
      });
    };

    grove("oak", "tree", 7.2, 8.6, ring(-42, 22, 4, 12), 95, "wood", "fiber", 0.7);
    grove("pine", "tree", 5.4, 9.8, ring(-30, 32, 3, 10), 85, "wood", "coal", 0.55);
    grove("palm", "tree", 6.6, 10.4, ring(62, 46, 2, 8), 75, "wood", "fiber", 0.55);
    grove("dead", "tree", 4.8, 8.0, ring(-50, 8, 1, 4), 50, "wood", "coal", 0.4);

    grove("rock_s", "rock", 1.9, 1.45, ring(48, -38, 4, 9), 40, "stone", "coal", 0.55);
    grove("rock_m", "rock", 2.7, 2.1, ring(46, -28, 3, 8), 70, "stone", "iron", 0.75);
    grove("rock_l", "rock", 3.4, 2.6, ring(54, -34, 3, 8), 95, "stone", "iron", 0.95);

    grove("rock_gold", "rock", 2.4, 1.9, ring(-14, -48, 10, 10), 80, "gold", "sulfur", 0.65);
    grove("rock_s", "rock", 1.9, 1.45, ring(30, -16, 10, 10), 55, "sulfur", "stone", 0.5);
    grove("rock_l", "rock", 3.4, 2.6, ring(-56, -20, 10, 11), 70, "coal", "stone", 0.7);

    grove("oak", "bush", 1.6, 1.35, ring(-24, 56, 10, 9), 16, "fiber", "fiber", 0.4);
    grove("oak", "bush", 1.6, 1.35, ring(36, 6, 10, 9), 16, "herbs", "herbs", 0.4);
    grove("oak", "bush", 1.6, 1.35, ring(-6, 46, 10, 9), 16, "berries", "berries", 0.4);
  }

  private placeCaves() {
    const rock = new THREE.MeshStandardMaterial({ map: this.texMaps.rock, roughness: 0.96, color: 0xc8c2b4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 1 });
    const dirt = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 1 });
    const grass = new THREE.MeshStandardMaterial({ map: this.texMaps.leaves, color: 0x4e9a3a, roughness: 0.9 });
    const mouths: { x: number; z: number; yaw: number; a: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.45;
      let x = Math.cos(a) * 70;
      let z = Math.sin(a) * 70;
      for (let k = 0; k < 22; k++) {
        const y = this.sample(x, z);
        const spawn = x * x + (z - 86) * (z - 86) < 26 * 26;
        if (y > 0.7 && y < 3.6 && !spawn) break;
        if (spawn || y > 3.6) {
          x = Math.cos(a + 0.2) * (66 - k * 0.6);
          z = Math.sin(a + 0.2) * (66 - k * 0.6);
        } else {
          x *= 0.96;
          z *= 0.96;
        }
      }
      mouths.push({ x, z, yaw: Math.atan2(-x, -z), a });
    }
    const irons: { x: number; z: number }[] = [];
    const toWorld = (ox: number, oz: number, yaw: number, lx: number, lz: number) => {
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      return { x: ox + lx * c + lz * s, z: oz - lx * s + lz * c };
    };
    for (const m of mouths) {
      const g = new THREE.Group();
      const y = Math.max(this.sample(m.x, m.z), 0.4);
      const box = (w: number, h: number, d: number, px: number, py: number, pz: number, mat: THREE.Material, ry = 0) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.set(px, py, pz);
        mesh.rotation.y = ry;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        g.add(mesh);
      };
      box(8.5, 0.18, 12.5, 0, 0.08, -5.2, dirt);
      box(1.3, 5.4, 11, -3.15, 2.7, -5, rock);
      box(1.3, 5.4, 3.2, 3.15, 2.7, -1.4, rock);
      box(1.3, 5.4, 3.4, 3.15, 2.7, -8.6, rock);
      box(4.6, 5.2, 1.3, 5.4, 2.6, -5.6, rock);
      box(3.4, 5.2, 1.2, 5.2, 2.6, -3.2, rock);
      box(3.2, 5.2, 1.2, 5.2, 2.6, -8, rock);
      box(1.15, 4.6, 1.3, -1.7, 2.3, -11.1, rock);
      box(1.15, 4.6, 1.3, 1.7, 2.3, -11.1, rock);
      box(4.6, 1.3, 1.3, 0, 4.5, -11.1, rock);
      box(7.6, 1.15, 4.2, 0, 4.55, -1.8, rock);
      box(7.6, 1.15, 3.4, 0, 4.55, -8.4, rock);
      box(2.2, 1.15, 3.2, -1.7, 4.55, -5.1, rock);
      box(2.2, 1.15, 3.2, 1.7, 4.55, -5.1, rock);
      box(2.4, 3.4, 2.2, -2.4, 1.7, 0.7, rock, 0.15);
      box(2.6, 3.6, 2.4, 2.5, 1.8, 0.6, rock, -0.2);
      box(3.2, 1.5, 2.6, 0.2, 4.1, 0.4, rock);
      box(3.4, 2.2, 2.8, -4.2, 2.4, -2.2, rock, 0.4);
      box(3.2, 2.6, 2.6, 4.6, 2.2, -1.2, rock, -0.35);
      box(3.6, 2.4, 3, -3.6, 2.6, -8.5, rock, 0.25);
      box(3.4, 2.8, 2.8, 4.4, 2.3, -9.2, rock, -0.3);
      box(4.2, 1.6, 3.2, 0.4, 5.1, -4.8, rock);
      box(2.2, 0.7, 2.2, -1.6, 5.5, -3.2, grass);
      box(1.8, 0.55, 1.6, 1.8, 5.45, -6.6, grass);
      box(1.4, 0.45, 1.2, -0.4, 5.7, -7.4, grass);
      box(1.6, 0.9, 1.4, 6.2, 1.2, -5.6, rock);
      box(1.2, 0.7, 1.1, -1.4, 0.45, -6.4, rock);
      box(0.9, 0.55, 0.8, 2.2, 0.4, -7.2, dark);
      const lamp = new THREE.PointLight(0xfff1d2, 0.55, 14, 2);
      lamp.position.set(0.2, 3.2, -5.2);
      g.add(lamp);
      g.position.set(m.x, y, m.z);
      g.rotation.y = m.yaw;
      this.scene.add(g);
      const hit = (hx: number, hz: number, lx: number, lz: number, top: number) => {
        const w = toWorld(m.x, m.z, m.yaw, lx, lz);
        this.caveHits.push({ x: w.x, z: w.z, yaw: m.yaw, hx, hz, bottom: y, top: y + top });
      };
      hit(1.15, 5.4, -3.15, -5, 5.2);
      hit(1.15, 1.5, 3.15, -1.4, 5.2);
      hit(1.15, 1.6, 3.15, -8.6, 5.2);
      hit(2.2, 1.1, 5.4, -5.6, 5);
      hit(1.5, 1.1, 5.2, -3.2, 5);
      hit(1.5, 1.1, 5.2, -8, 5);
      hit(1.05, 0.7, -1.7, -11.1, 4.4);
      hit(1.05, 0.7, 1.7, -11.1, 4.4);
      const deep = toWorld(m.x, m.z, m.yaw, -0.8, -6.2);
      const side = toWorld(m.x, m.z, m.yaw, 4.2, -5.6);
      irons.push(deep, side);
    }
    let n = 0;
    this.makeBills("rock_m", irons.length, "rock", 1.7, 1.25, () => {
      const p = irons[n++];
      if (!p) return null;
      return { hp: 80, drop: "iron", extra: "stone", x: p.x, z: p.z, r: 0.55 };
    });
  }

  private collideCaves() {
    const pr = 0.4;
    for (const b of this.caveHits) {
      const dx = this.pos.x - b.x;
      const dz = this.pos.z - b.z;
      const ca = Math.cos(-b.yaw);
      const sa = Math.sin(-b.yaw);
      const lx = dx * ca - dz * sa;
      const lz = dx * sa + dz * ca;
      const px = Math.max(-b.hx, Math.min(b.hx, lx));
      const pz = Math.max(-b.hz, Math.min(b.hz, lz));
      const ox = lx - px;
      const oz = lz - pz;
      if (ox * ox + oz * oz >= pr * pr) continue;
      if (b.bottom >= this.pos.y + 1.7) continue;
      if (b.top <= this.pos.y + 0.05) continue;
      const d = Math.max(0.001, Math.hypot(ox, oz));
      const nx = ox / d;
      const nz = oz / d;
      const wx = nx * ca + nz * sa;
      const wz = -nx * sa + nz * ca;
      this.pos.x += wx * (pr - d);
      this.pos.z += wz * (pr - d);
    }
  }

  private body(kind: Creature["kind"]) {
    if (kind === "chicken") return this.makeChicken();
    if (kind === "fish") return this.makeFish();
    if (kind === "crab") return this.makeCrab();
    return this.makeRig(kind);
  }

  private tone(color: number, rough = 0.78) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough });
  }

  private makeScout() {
    const g = new THREE.Group();
    const skin = this.tone(0xc48a62, 0.68);
    const shirt = this.tone(0x6e7c48, 0.84);
    const pants = this.tone(0xc4a36a, 0.86);
    const boot = this.tone(0x3d2a1c, 0.72);
    const cap = this.tone(0x2a2a28, 0.58);
    const pack = this.tone(0x8a623c, 0.82);
    const vest = this.tone(0x3f4a34, 0.86);
    const leg = (x: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.92, 0);
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.28, 3, 6), pants);
      thigh.position.y = -0.22;
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.26, 3, 6), pants);
      shin.position.y = -0.52;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.2), boot);
      foot.position.set(0, -0.72, 0.04);
      pivot.add(thigh, shin, foot);
      return pivot;
    };
    const left = leg(-0.11);
    const right = leg(0.11);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.38, 4, 8), shirt);
    torso.position.y = 1.22;
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.14), vest);
    chest.position.set(0, 1.28, 0.07);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skin);
    head.position.y = 1.62;
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.15, 0.07, 10), cap);
    hat.position.y = 1.74;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.018, 10), cap);
    brim.position.set(0, 1.7, 0.04);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.12), pack);
    bag.position.set(0, 1.28, -0.16);
    const arm = (x: number) => {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.34, 3, 6), shirt);
      m.position.set(x, 1.18, 0.02);
      m.rotation.z = x > 0 ? -0.18 : 0.18;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), skin);
      hand.position.set(x * 1.08, 0.92, 0.06);
      return [m, hand] as const;
    };
    const [al, hl] = arm(-0.24);
    const [ar, hr] = arm(0.24);
    g.add(left, right, torso, chest, head, hat, brim, bag, al, hl, ar, hr);
    g.userData.legs = [left, right];
    g.userData.body = torso;
    g.userData.bodyY = torso.position.y;
    return g;
  }

  private makeChicken() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), this.tone(0xd8d2c4, 0.7));
    body.scale.set(1.15, 0.85, 1.35);
    body.position.y = 0.28;
    const neck = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), this.tone(0xf2efe4, 0.65));
    neck.position.set(0, 0.4, 0.12);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), this.tone(0xf4f1e6, 0.62));
    head.position.set(0, 0.5, 0.16);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 4), this.tone(0xe2a23a, 0.5));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.49, 0.24);
    const comb = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.06, 0.04), this.tone(0xc43b3b, 0.5));
    comb.position.set(0, 0.58, 0.15);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 4), this.tone(0xb9b3a4, 0.7));
    tail.rotation.x = -Math.PI / 2.4;
    tail.position.set(0, 0.36, -0.16);
    const leg = (x: number) => {
      const p = new THREE.Group();
      p.position.set(x, 0.16, 0);
      const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 4), this.tone(0xe2a23a, 0.5));
      bone.position.y = -0.08;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.015, 0.08), this.tone(0xe2a23a, 0.5));
      foot.position.set(0, -0.16, 0.02);
      p.add(bone, foot);
      return p;
    };
    const l = leg(-0.06);
    const r = leg(0.06);
    g.add(body, neck, head, beak, comb, tail, l, r);
    g.userData.legs = [l, r];
    g.userData.body = body;
    g.userData.bodyY = body.position.y;
    return g;
  }

  private makeFish() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), this.tone(0x6f9db8, 0.45));
    body.scale.set(0.55, 0.7, 1.7);
    body.position.y = 0.12;
    const tailP = new THREE.Group();
    tailP.position.set(0, 0.12, -0.2);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 4), this.tone(0x4e7f9a, 0.5));
    fin.rotation.x = -Math.PI / 2;
    fin.position.z = -0.05;
    tailP.add(fin);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 4), this.tone(0x111111, 0.3));
    eye.position.set(0.05, 0.15, 0.12);
    g.add(body, tailP, eye);
    g.userData.legs = [tailP];
    g.userData.body = body;
    g.userData.bodyY = body.position.y;
    return g;
  }

  private makeCrab() {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), this.tone(0xb23a2e, 0.62));
    shell.scale.set(1.3, 0.45, 1);
    shell.position.y = 0.12;
    const claw = (x: number) => {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), this.tone(0xd35a42, 0.55));
      c.scale.set(1.4, 0.7, 0.8);
      c.position.set(x, 0.1, 0.16);
      return c;
    };
    g.add(shell, claw(-0.16), claw(0.16));
    const legs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const p = new THREE.Group();
        p.position.set(side * 0.12, 0.08, -0.06 + i * 0.06);
        const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.01, 0.12, 4), this.tone(0x8d2e28, 0.6));
        bone.rotation.z = side * 0.9;
        bone.position.x = side * 0.05;
        p.add(bone);
        g.add(p);
        legs.push(p);
      }
    }
    g.userData.legs = legs;
    g.userData.body = shell;
    g.userData.bodyY = shell.position.y;
    return g;
  }

  private makeBoat() {
    const g = new THREE.Group();
    const wood = this.plankMat(0xd7b07a);
    const hull = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.28, 2.2), wood);
    hull.position.y = 0.16;
    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.7, 4), wood);
    bow.rotation.x = Math.PI / 2;
    bow.position.set(0, 0.18, 1.25);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.28), wood);
    seat.position.set(0, 0.32, -0.15);
    const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 5), wood);
    oar.rotation.z = 0.7;
    oar.position.set(0.45, 0.4, 0.2);
    g.add(hull, bow, seat, oar);
    return g;
  }

  private placeBoats() {
    const spots: [number, number][] = [
      [72, 8],
      [-58, 36],
      [12, -74],
      [-28, -62],
    ];
    for (const [sx, sz] of spots) {
      let x = sx;
      let z = sz;
      for (let i = 0; i < 14; i++) {
        const y = this.sample(x, z);
        if (y < WATER_Y + 0.25 && y > WATER_Y - 0.8) break;
        const out = y > WATER_Y ? 1 : -1;
        x += Math.sign(x || 1) * out * 2.2;
        z += Math.sign(z || 1) * out * 2.2;
      }
      const boat = this.makeBoat();
      boat.position.set(x, WATER_Y - 0.02, z);
      boat.rotation.y = Math.atan2(-x, -z);
      this.scene.add(boat);
    }
  }

  private playerPawn() {
    return this.makeScout();
  }

  private makeRig(kind: string) {
    const key = kind === "goat" ? "deer" : kind;
    const src = this.solids[key];
    const g = new THREE.Group();
    if (!src) return g;
    const mesh = src.clone();
    mesh.material = (src.material as THREE.MeshStandardMaterial).clone();
    const scale =
      kind === "bear" ? 2.05 : kind === "boar" ? 1.32 : kind === "wolf" ? 1.48 : kind === "goat" ? 1.3 : kind === "scout" ? 1.84 : 1.68;
    mesh.scale.setScalar(scale);
    g.add(mesh);
    g.userData.body = mesh;
    g.userData.bodyY = 0;
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
      "chicken",
      "chicken",
      "chicken",
      "chicken",
      "chicken",
      "chicken",
      "crab",
      "crab",
      "crab",
      "crab",
      "fish",
      "fish",
      "fish",
      "fish",
      "fish",
      "fish",
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
      chicken: { hp: 18, speed: 3.4, aggro: 8, melee: 0.8, dmg: 2, flee: true, ranged: 0, radius: 0.28 },
      crab: { hp: 24, speed: 2.2, aggro: 6, melee: 0.9, dmg: 4, flee: true, ranged: 0, radius: 0.32 },
      fish: { hp: 16, speed: 2.8, aggro: 7, melee: 0.7, dmg: 1, flee: true, ranged: 0, radius: 0.3 },
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
      } else if (kind === "fish" || kind === "crab") {
        for (let t = 0; t < 24; t++) {
          const a = this.rng() * Math.PI * 2;
          const d = 30 + this.rng() * 62;
          x = Math.cos(a) * d;
          z = Math.sin(a) * d;
          y = this.sample(x, z);
          const shore = kind === "crab" ? y > WATER_Y && y < 0.7 : y < WATER_Y + 0.2 && y > WATER_Y - 1.2;
          if (shore) break;
        }
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
    const spots = [
      [48, -20],
      [-40, 30],
      [20, -50],
      [-22, -38],
      [55, 18],
    ];
    for (const [x, z] of spots) {
      const y = Math.max(this.sample(x, z), 0.4);
      const floor = this.makeFoundation();
      floor.scale.set(3, 1, 3);
      floor.position.set(x, y + FLOOR_T / 2, z);
      this.scene.add(floor);
      this.builds.push({
        id: this.buildId++,
        type: "foundation",
        mesh: floor,
        pos: new THREE.Vector3(x, y, z),
        rot: 0,
        hx: 3,
        hz: 3,
        bottom: y,
        top: y + FLOOR_T,
      });
      const walls: [number, number, number, number, number][] = [
        [x, z - 3, 0, 3, 0.12],
        [x, z + 3, 0, 3, 0.12],
        [x - 3, z, Math.PI / 2, 3, 0.12],
        [x + 3, z - 2, -Math.PI / 2, 1, 0.12],
        [x + 3, z + 2, -Math.PI / 2, 1, 0.12],
      ];
      for (const [wx, wz, rot, span, thick] of walls) {
        const w = this.makeWall();
        w.scale.set(span, 1, 1);
        w.position.set(wx, y + WALL_H / 2, wz);
        w.rotation.y = rot;
        this.scene.add(w);
        this.builds.push({
          id: this.buildId++,
          type: "wall",
          mesh: w,
          pos: new THREE.Vector3(wx, y, wz),
          rot,
          hx: span,
          hz: thick,
          bottom: y,
          top: y + WALL_H,
        });
      }
      const frame = this.makeFrame();
      frame.position.set(x + 3, y + WALL_H / 2, z);
      frame.rotation.y = -Math.PI / 2;
      this.scene.add(frame);
      this.builds.push({
        id: this.buildId++,
        type: "frame",
        mesh: frame,
        pos: new THREE.Vector3(x + 3, y, z),
        rot: -Math.PI / 2,
        hx: 1,
        hz: 0.12,
        bottom: y,
        top: y + WALL_H,
      });
      const door = this.makeDoor(this.texMaps.planks);
      door.position.set(x + 3, y, z);
      door.rotation.y = -Math.PI / 2;
      this.scene.add(door);
      this.builds.push({
        id: this.buildId++,
        type: "door",
        mesh: door,
        pos: new THREE.Vector3(x + 3, y, z),
        rot: -Math.PI / 2,
        hx: 0.72,
        hz: 0.12,
        bottom: y,
        top: y + 2.6,
      });
      const roof = this.makeRoof();
      roof.scale.set(3.25, 1, 3.25);
      roof.position.set(x, y + WALL_H + 0.1, z);
      this.scene.add(roof);
      this.builds.push({
        id: this.buildId++,
        type: "roof",
        mesh: roof,
        pos: new THREE.Vector3(x, y + WALL_H, z),
        rot: 0,
        hx: 3.15,
        hz: 3.15,
        bottom: y + WALL_H,
        top: y + WALL_H + 0.2,
      });
      const crate = this.makeCrate(this.texMaps.planks);
      crate.position.set(x - 1.1, y + FLOOR_T, z + 0.8);
      crate.rotation.y = 0.3;
      this.scene.add(crate);
      this.builds.push({
        id: this.buildId++,
        type: "crate",
        mesh: crate,
        pos: new THREE.Vector3(x - 1.1, y + FLOOR_T, z + 0.8),
        rot: 0.3,
        hx: 0.52,
        hz: 0.39,
        bottom: y + FLOOR_T,
        top: y + FLOOR_T + 0.82,
      });
      for (const fz of [-1.6, 1.6]) {
        const fence = this.makeFence(this.texMaps.planks);
        fence.position.set(x + 4.4, y, z + fz);
        fence.rotation.y = -Math.PI / 2;
        this.scene.add(fence);
        this.builds.push({
          id: this.buildId++,
          type: "fence",
          mesh: fence,
          pos: new THREE.Vector3(x + 4.4, y, z + fz),
          rot: -Math.PI / 2,
          hx: 1,
          hz: 0.1,
          bottom: y,
          top: y + 1.35,
        });
      }
      const fire = this.makeCampfire();
      fire.position.set(x + 5.6, y, z);
      this.scene.add(fire);
      this.builds.push({
        id: this.buildId++,
        type: "campfire",
        mesh: fire,
        pos: new THREE.Vector3(x + 5.6, y, z),
        rot: 0,
        hx: 0.55,
        hz: 0.55,
        bottom: y,
        top: y + 0.35,
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
    if (!blocked && act.wheel) {
      const cur = useGameStore.getState().hotIndex;
      const next = (cur + act.wheel + HOTBAR * 8) % HOTBAR;
      useGameStore.getState().patch({ hotIndex: next });
    }
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
    if (useGameStore.getState().hotIndex >= HOTBAR) useGameStore.getState().patch({ hotIndex: 0 });
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

    const h = this.supportY(this.pos.x, this.pos.z);
    const terrain = this.sample(this.pos.x, this.pos.z);
    const inWater = terrain < WATER_Y - 0.05 && h < WATER_Y + 0.2;
    const targetY = inWater ? Math.max(h, WATER_Y - 0.9) : h;
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
      this.collideCaves();
      this.collideMobs(0.4);
      this.collideRemotes(0.4);
      const ground = this.sample(this.pos.x, this.pos.z);
      if (ground > this.pos.y + 0.95) {
        this.pos.x = ox;
        this.pos.z = oz;
      }
    }
    const landed = this.supportY(this.pos.x, this.pos.z);
    if (landed > this.pos.y && landed - this.pos.y <= 0.95) {
      this.pos.y = landed;
      this.vel.y = 0;
      this.onGround = true;
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
    const step = 0.95;
    for (const b of this.builds) {
      if (b.type === "door" && b.open) continue;
      const hx = b.hx ?? (b.type === "foundation" || b.type === "roof" ? TILE / 2 : 0.25);
      const hz = b.hz ?? (b.type === "wall" || b.type === "window" || b.type === "door" ? 0.12 : TILE / 2);
      const dx = this.pos.x - b.pos.x;
      const dz = this.pos.z - b.pos.z;
      const ca = Math.cos(-b.rot);
      const sa = Math.sin(-b.rot);
      const lx = dx * ca - dz * sa;
      const lz = dx * sa + dz * ca;
      if (b.type === "frame" && Math.abs(lx) < 0.78) continue;
      const px = Math.max(-hx, Math.min(hx, lx));
      const pz = Math.max(-hz, Math.min(hz, lz));
      const ox = lx - px;
      const oz = lz - pz;
      if (ox * ox + oz * oz >= pr * pr) continue;
      const lo = b.bottom ?? b.pos.y;
      const hi = b.top ?? b.pos.y + 1;
      const head = this.pos.y + 1.75;
      if (lo >= head - 0.05) continue;
      if (hi <= this.pos.y + 0.02) continue;
      const surface = this.surfaceAt(b, this.pos.x, this.pos.z);
      const top = surface ?? b.top ?? b.pos.y;
      if (this.pos.y >= top - 0.08) continue;
      if (top > this.pos.y && top - this.pos.y <= step) continue;
      const d = Math.max(0.001, Math.hypot(ox, oz));
      const nx = ox / d;
      const nz = oz / d;
      const wx = nx * ca + nz * sa;
      const wz = -nx * sa + nz * ca;
      this.pos.x += wx * (pr - d);
      this.pos.z += wz * (pr - d);
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
      const wildlife = c.kind === "deer" || c.kind === "goat" || c.kind === "boar" || c.kind === "wolf" || c.kind === "bear" || c.kind === "chicken" || c.kind === "fish" || c.kind === "crab";
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
          c.cd = 1.1;
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
      c.yaw = Math.atan2(dirx, dirz);
      if (c.kind === "fish") c.pos.y = WATER_Y - 0.02;
      else {
        c.pos.y = this.sample(c.pos.x, c.pos.z);
        if (c.pos.y < WATER_Y) {
          c.pos.x -= (dirx / len) * sp * dt * 2;
          c.pos.z -= (dirz / len) * sp * dt * 2;
          this.solidAt(c.pos, c.radius, c);
          c.pos.y = Math.max(this.sample(c.pos.x, c.pos.z), WATER_Y);
        }
      }
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
      this.score += c.kind === "bear" ? 80 : 40;
      const drop: ItemId =
        c.kind === "fish" || c.kind === "crab" ? "fish" : c.kind === "wolf" ? "fiber" : c.kind === "chicken" || c.kind === "deer" || c.kind === "boar" || c.kind === "bear" || c.kind === "goat" ? "meat" : "cloth";
      this.spawnDrop(c.pos.x, c.pos.y + 0.4, c.pos.z, drop, 1 + (c.kind === "bear" ? 2 : 0));
      this.quest("hunt", 1);
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
    let placeRot = 0;
    if (placeId) {
      const snap = this.snapBuild(placeId);
      if (snap) {
        const spec = this.buildSpec(placeId);
        this.ghost.scale.set(spec.sx, spec.sy, spec.sz);
        this.ghost.position.set(snap.x, snap.y + spec.oy, snap.z);
        this.ghost.rotation.y = snap.rot;
        this.ghost.visible = true;
        canPlace = snap.ok;
        (this.ghost.material as THREE.MeshBasicMaterial).color.set(canPlace ? 0x6db56d : 0xc4453c);
        placePos = new THREE.Vector3(snap.x, snap.y, snap.z);
        placeRot = snap.rot;
      }
    }

    if (!prompt) {
      const near = this.nearestBuild(this.pos.x, this.pos.z, 2.4, ["door", "crate", "furnace", "campfire"]);
      if (near && slot?.id === "lock" && !near.code && (near.type === "door" || near.type === "crate")) {
        prompt = { label: copy.lockHint, key: "E" };
      } else if (near?.type === "door") {
        prompt = { label: near.code && !this.knowsLock(near) ? copy.lockEnter : copy.open, key: "E" };
      } else if (near) {
        prompt = { label: near.code && !this.knowsLock(near) ? copy.lockEnter : copy.cook, key: "E" };
      }
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
          if (b.pos.distanceTo(this.pos) >= 2.4) continue;
          if (b.type !== "door" && b.type !== "furnace" && b.type !== "campfire" && b.type !== "crate") continue;
          if (slot?.id === "lock" && (b.type === "door" || b.type === "crate") && !b.code) {
            this.askLock(b.id, "set");
            break;
          }
          if ((b.type === "door" || b.type === "crate") && b.code && !this.knowsLock(b)) {
            this.askLock(b.id, "open");
            break;
          }
          if (b.type === "door") this.toggleDoor(b);
          else this.setOverlay("craft");
          break;
        }
      }
    }

    if (act.fire && this.fireCd <= 0 && this.overlay === "none") {
      if (placeId && canPlace && placePos && slot) {
        this.placeBuild(placeId, placePos, placeRot);
        const inv = useGameStore.getState().inventory.slice();
        takeItem(inv, slot.id, 1);
        useGameStore.getState().patch({ inventory: inv });
        this.fireCd = 0.35;
        this.audio.place();
        this.quest("base", 1);
      } else if (slot?.id === "lock") {
        const target = this.nearestBuild(this.pos.x, this.pos.z, 2.6, ["door", "crate"]);
        if (target && !target.code) this.askLock(target.id, "set");
        this.fireCd = 0.35;
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

  private me() {
    return (this.netName || "local").toLowerCase();
  }

  private knowsLock(b: Build) {
    return (b.owners ?? []).some((n) => n.toLowerCase() === this.me());
  }

  private askLock(id: number, mode: "set" | "open") {
    this.overlay = "lock";
    useGameStore.getState().patch({ overlay: "lock", lockAsk: { id, mode } });
    if (document.pointerLockElement) document.exitPointerLock();
  }

  submitLock(code: string) {
    const ask = useGameStore.getState().lockAsk;
    if (!ask || !/^\d{4}$/.test(code)) return false;
    const b = this.builds.find((x) => x.id === ask.id);
    if (!b) {
      this.closeLock();
      return false;
    }
    if (ask.mode === "set") {
      const inv = useGameStore.getState().inventory.slice();
      if (!takeItem(inv, "lock", 1)) return false;
      b.code = code;
      b.owners = [this.netName || "local"];
      this.attachLockMesh(b);
      useGameStore.getState().patch({ inventory: inv });
      useGameStore.getState().toast(t().lockOn);
      this.closeLock();
      this.save();
      return true;
    }
    if (b.code === code) {
      const me = this.netName || "local";
      b.owners = [...new Set([...(b.owners ?? []), me])];
      this.closeLock();
      this.save();
      if (b.type === "door") this.toggleDoor(b);
      else this.setOverlay("craft");
      return true;
    }
    useGameStore.getState().toast(t().lockBad);
    return false;
  }

  closeLock() {
    this.overlay = "none";
    useGameStore.getState().patch({ overlay: "none", lockAsk: null });
  }

  private toggleDoor(b: Build) {
    b.open = !b.open;
    const panel = b.mesh.getObjectByName("panel");
    if (panel) panel.rotation.y = b.open ? -Math.PI / 2 : 0;
  }

  private attachLockMesh(b: Build) {
    const prev = b.mesh.getObjectByName("padlock");
    if (prev) b.mesh.remove(prev);
    if (!b.code) return;
    const lock = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.11, 0.045),
      new THREE.MeshStandardMaterial({ color: 0xd4b15a, metalness: 0.7, roughness: 0.3 }),
    );
    lock.name = "padlock";
    lock.position.set(b.type === "door" ? 0.42 : 0, b.type === "door" ? 1.15 : 0.55, b.type === "door" ? 0.12 : 0.4);
    b.mesh.add(lock);
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

  private buildSpec(type: ItemId) {
    if (type === "wall" || type === "window" || type === "frame") return { sx: TILE, sy: WALL_H, sz: 0.18, oy: WALL_H / 2, hx: TILE / 2, hz: 0.12 };
    if (type === "door") return { sx: 1.7, sy: 2.6, sz: 0.2, oy: 1.3, hx: 0.72, hz: 0.12 };
    if (type === "fence") return { sx: TILE, sy: 1.35, sz: 0.16, oy: 0.68, hx: TILE / 2, hz: 0.1 };
    if (type === "roof") return { sx: TILE, sy: 0.16, sz: TILE, oy: 0.08, hx: TILE / 2, hz: TILE / 2 };
    if (type === "stairs") return { sx: TILE, sy: WALL_H, sz: TILE, oy: WALL_H / 2, hx: TILE / 2, hz: TILE / 2 };
    if (type === "crate") return { sx: 1.05, sy: 0.82, sz: 0.78, oy: 0.41, hx: 0.52, hz: 0.39 };
    if (type === "furnace") return { sx: 1.05, sy: 1.25, sz: 1.05, oy: 0.62, hx: 0.52, hz: 0.52 };
    if (type === "workbench") return { sx: 1.5, sy: 0.9, sz: 1, oy: 0.45, hx: 0.75, hz: 0.5 };
    if (type === "campfire") return { sx: 1.1, sy: 0.35, sz: 1.1, oy: 0.18, hx: 0.55, hz: 0.55 };
    if (type === "plant") return { sx: 0.7, sy: 0.9, sz: 0.7, oy: 0.45, hx: 0.3, hz: 0.3 };
    return { sx: TILE, sy: FLOOR_T, sz: TILE, oy: FLOOR_T / 2, hx: TILE / 2, hz: TILE / 2 };
  }

  private nearestBuild(x: number, z: number, maxDist: number, types: ItemId[]) {
    let best: Build | null = null;
    let bd = maxDist;
    for (const b of this.builds) {
      if (!types.includes(b.type)) continue;
      const d = Math.hypot(b.pos.x - x, b.pos.z - z);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  private snapBuild(type: ItemId) {
    const aimX = this.pos.x + this.fwd.x * 2.8;
    const aimZ = this.pos.z + this.fwd.z * 2.8;
    let x = Math.round(aimX / TILE) * TILE;
    let z = Math.round(aimZ / TILE) * TILE;
    let rot = Math.round(this.yaw / (Math.PI / 2)) * (Math.PI / 2);
    let y = Math.max(this.sample(x, z), 0.05);
    const edge = type === "wall" || type === "door" || type === "window" || type === "fence" || type === "frame";
    if (edge) {
      const base = this.nearestBuild(aimX, aimZ, TILE * 0.95, ["foundation"]);
      const host = base ?? { pos: new THREE.Vector3(x, y, z), bottom: y };
      const by = base?.bottom ?? host.bottom ?? y;
      const edges = [
        { x: host.pos.x, z: host.pos.z - TILE / 2, rot: 0 },
        { x: host.pos.x, z: host.pos.z + TILE / 2, rot: Math.PI },
        { x: host.pos.x - TILE / 2, z: host.pos.z, rot: Math.PI / 2 },
        { x: host.pos.x + TILE / 2, z: host.pos.z, rot: -Math.PI / 2 },
      ];
      let best = edges[0];
      let bd = Infinity;
      for (const e of edges) {
        const d = (e.x - aimX) ** 2 + (e.z - aimZ) ** 2;
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      x = best.x;
      z = best.z;
      rot = best.rot;
      y = by;
    } else if (type === "roof") {
      const found = this.nearestBuild(aimX, aimZ, TILE * 0.8, ["foundation"]);
      if (found) {
        x = found.pos.x;
        z = found.pos.z;
        y = (found.bottom ?? found.pos.y) + WALL_H;
      } else {
        y += WALL_H;
      }
    } else if (type === "stairs") {
      const found = this.nearestBuild(x, z, TILE * 1.15, ["foundation"]);
      if (found && Math.hypot(found.pos.x - x, found.pos.z - z) > 0.2) y = found.bottom ?? found.pos.y;
    } else if (type === "foundation") {
      const found = this.nearestBuild(x, z, TILE * 1.15, ["foundation"]);
      if (found) y = found.bottom ?? found.pos.y;
    } else {
      const found = this.nearestBuild(x, z, TILE * 0.55, ["foundation", "roof"]);
      if (found) y = found.top ?? found.pos.y;
    }
    if (type === "door") {
      const frame = this.nearestBuild(aimX, aimZ, TILE, ["frame"]);
      if (frame) {
        x = frame.pos.x;
        z = frame.pos.z;
        rot = frame.rot;
        y = frame.bottom ?? frame.pos.y;
      }
    }
    const blocked = this.builds.some((b) => {
      if (Math.hypot(b.pos.x - x, b.pos.z - z) > 0.35) return false;
      if (b.type === type) return true;
      if ((type === "door" && b.type === "frame") || (type === "frame" && b.type === "door")) return false;
      const solid = b.type === "wall" || b.type === "door" || b.type === "window" || b.type === "fence" || b.type === "frame";
      const want = type === "wall" || type === "door" || type === "window" || type === "fence" || type === "frame";
      return solid && want;
    });
    const ok = y > WATER_Y - 0.35 && !blocked;
    return { x, z, y, rot, ok };
  }

  private supportY(x: number, z: number) {
    let y = this.sample(x, z);
    for (const b of this.builds) {
      const s = this.surfaceAt(b, x, z);
      if (s != null && s <= this.pos.y + 0.95 && s > y) y = s;
    }
    return y;
  }

  private surfaceAt(b: Build, x: number, z: number) {
    const dx = x - b.pos.x;
    const dz = z - b.pos.z;
    const ca = Math.cos(-b.rot);
    const sa = Math.sin(-b.rot);
    const lx = dx * ca - dz * sa;
    const lz = dx * sa + dz * ca;
    const hx = b.hx ?? 1;
    const hz = b.hz ?? 1;
    if (Math.abs(lx) > hx || Math.abs(lz) > hz) return null;
    if (b.type === "stairs") {
      const t = (lz + hz) / Math.max(0.001, hz * 2);
      return (b.bottom ?? b.pos.y) + Math.min(1, Math.max(0, t)) * WALL_H;
    }
    if (b.type === "wall" || b.type === "window" || b.type === "door" || b.type === "fence" || b.type === "frame") return b.top ?? null;
    return b.top ?? null;
  }

  private placeBuild(type: ItemId, pos: THREE.Vector3, rot: number) {
    const spec = this.buildSpec(type);
    const mesh = this.makeBuildMesh(type);
    const grounded = type === "door" || type === "fence" || type === "crate" || type === "campfire" || type === "plant" || type === "furnace" || type === "workbench";
    mesh.position.set(pos.x, grounded ? pos.y : pos.y + spec.oy, pos.z);
    mesh.rotation.y = rot;
    this.scene.add(mesh);
    const bottom = pos.y;
    const top = type === "stairs" ? pos.y + WALL_H : pos.y + spec.sy;
    const built: Build = {
      id: this.buildId++,
      type,
      mesh,
      pos: new THREE.Vector3(pos.x, bottom, pos.z),
      rot,
      hx: spec.hx,
      hz: spec.hz,
      bottom,
      top,
    };
    this.builds.push(built);
    return built;
  }

  private plankMat(color = 0xffffff) {
    return new THREE.MeshStandardMaterial({ map: this.texMaps.planks, color, roughness: 0.84 });
  }

  private boxAt(w: number, h: number, d: number, x: number, y: number, z: number) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    return g;
  }

  private mergeParts(parts: THREE.BufferGeometry[]) {
    return mergeGeometries(parts) ?? parts[0];
  }

  private makeBuildMesh(type: ItemId) {
    if (type === "door") return this.makeDoor(this.texMaps.planks);
    if (type === "fence") return this.makeFence(this.texMaps.planks);
    if (type === "crate") return this.makeCrate(this.texMaps.planks);
    if (type === "frame") return this.makeFrame();
    if (type === "window") return this.makeWindow();
    if (type === "furnace") return this.makeFurnace();
    if (type === "workbench") return this.makeBench();
    if (type === "campfire") return this.makeCampfire();
    if (type === "plant") return this.makePlant();
    if (type === "foundation") return this.makeFoundation();
    if (type === "wall") return this.makeWall();
    if (type === "roof") return this.makeRoof();
    if (type === "stairs") return this.makeStairs();
    const spec = this.buildSpec(type);
    return new THREE.Mesh(new THREE.BoxGeometry(spec.sx, spec.sy, spec.sz), this.plankMat());
  }

  private makeFoundation() {
    const t = FLOOR_T;
    const parts = [
      this.boxAt(TILE, 0.08, 0.12, 0, -t / 2 + 0.04, -0.88),
      this.boxAt(TILE, 0.08, 0.12, 0, -t / 2 + 0.04, 0.88),
      this.boxAt(0.12, 0.08, TILE - 0.16, -0.88, -t / 2 + 0.04, 0),
      this.boxAt(0.12, 0.08, TILE - 0.16, 0.88, -t / 2 + 0.04, 0),
    ];
    for (let i = -4; i <= 4; i++) parts.push(this.boxAt(TILE * 0.96, 0.05, 0.16, 0, t / 2 - 0.025, i * 0.2));
    return new THREE.Mesh(this.mergeParts(parts), this.plankMat());
  }

  private makeWall() {
    const h = WALL_H;
    const parts = [
      this.boxAt(0.14, h, 0.16, -0.92, 0, 0),
      this.boxAt(0.14, h, 0.16, 0.92, 0, 0),
      this.boxAt(1.7, 0.12, 0.16, 0, -h / 2 + 0.06, 0),
      this.boxAt(1.7, 0.12, 0.16, 0, h / 2 - 0.06, 0),
      this.boxAt(1.7, 0.08, 0.1, 0, 0, 0),
    ];
    for (let i = -3; i <= 3; i++) parts.push(this.boxAt(0.2, h - 0.3, 0.07, i * 0.25, 0, 0.03));
    return new THREE.Mesh(this.mergeParts(parts), this.plankMat());
  }

  private makeRoof() {
    const parts = [this.boxAt(TILE + 0.28, 0.07, TILE + 0.28, 0, 0.03, 0)];
    for (let i = -4; i <= 4; i++) parts.push(this.boxAt(TILE + 0.2, 0.035, 0.16, 0, 0.07, i * 0.22));
    parts.push(this.boxAt(0.1, 0.1, TILE, -0.7, -0.04, 0));
    parts.push(this.boxAt(0.1, 0.1, TILE, 0.7, -0.04, 0));
    return new THREE.Mesh(this.mergeParts(parts), this.plankMat(0xd7c4a3));
  }

  private makeStairs() {
    const parts: THREE.BufferGeometry[] = [];
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const h = (WALL_H / steps) * (i + 1);
      parts.push(this.boxAt(TILE * 0.92, h, TILE / steps - 0.02, 0, h / 2 - WALL_H / 2, -TILE / 2 + (i + 0.5) * (TILE / steps)));
    }
    parts.push(this.boxAt(0.08, WALL_H, TILE, -TILE / 2 + 0.06, 0, 0));
    parts.push(this.boxAt(0.08, WALL_H, TILE, TILE / 2 - 0.06, 0, 0));
    return new THREE.Mesh(this.mergeParts(parts), this.plankMat());
  }

  private makeFrame() {
    const g = new THREE.Group();
    const wood = this.plankMat(0xc4a57a);
    const h = WALL_H;
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, 0.18), wood);
    postL.position.set(-0.92, 0, 0);
    const postR = postL.clone();
    postR.position.x = 0.92;
    const headerH = h - 2.62;
    const header = new THREE.Mesh(new THREE.BoxGeometry(1.68, headerH, 0.2), wood);
    header.position.set(0, -h / 2 + 2.62 + headerH / 2, 0);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.08, 0.2), wood);
    sill.position.set(0, -h / 2 + 0.04, 0);
    g.add(postL, postR, header, sill);
    return g;
  }

  private makeWindow() {
    const g = new THREE.Group();
    const wood = this.plankMat();
    const h = WALL_H;
    const add = (mesh: THREE.Mesh, x: number, y: number, z: number) => {
      mesh.position.set(x, y, z);
      g.add(mesh);
    };
    add(new THREE.Mesh(new THREE.BoxGeometry(0.14, h, 0.16), wood), -0.92, 0, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.14, h, 0.16), wood), 0.92, 0, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 0.12), wood), 0, -h / 2 + 0.4, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 0.12), wood), 0, h / 2 - 0.4, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 0.1), wood), 0, 0, 0);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 1.45, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x9fd4ee, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1 }),
    );
    add(glass, 0, 0, 0);
    return g;
  }

  private makeDoor(map: THREE.Texture) {
    const wood = new THREE.MeshStandardMaterial({ map, roughness: 0.82 });
    const dark = new THREE.MeshStandardMaterial({ map, color: 0x6a4b30, roughness: 0.78 });
    const g = new THREE.Group();
    const jambL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.55, 0.18), dark);
    jambL.position.set(-0.78, 1.28, 0);
    const jambR = jambL.clone();
    jambR.position.x = 0.78;
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.16, 0.2), dark);
    lintel.position.set(0, 2.52, 0);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.06, 0.2), dark);
    sill.position.set(0, 0.03, 0);
    const hinge = new THREE.Group();
    hinge.name = "panel";
    hinge.position.set(-0.66, 0, 0);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.28, 2.28, 0.07), wood);
    panel.position.set(0.66, 1.2, 0);
    const insetA = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.85, 0.025), dark);
    insetA.position.set(0.66, 1.72, 0.04);
    const insetB = insetA.clone();
    insetB.position.y = 0.7;
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.16, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xd4b15a, metalness: 0.65, roughness: 0.32 }),
    );
    handle.position.set(1.16, 1.15, 0.07);
    hinge.add(panel, insetA, insetB, handle);
    g.add(jambL, jambR, lintel, sill, hinge);
    return g;
  }

  private makeFence(map: THREE.Texture) {
    const wood = new THREE.MeshStandardMaterial({ map, color: 0xe2d0b0, roughness: 0.8 });
    const g = new THREE.Group();
    for (const x of [-0.92, 0.92]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.22, 0.1), wood);
      post.position.set(x, 0.61, 0);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 4), wood);
      cap.position.set(x, 1.28, 0);
      g.add(post, cap);
    }
    for (const y of [0.45, 0.92]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.07, 0.05), wood);
      rail.position.set(0, y, 0.03);
      g.add(rail);
    }
    for (let i = -3; i <= 3; i++) {
      const pick = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.02, 0.035), wood);
      pick.position.set(i * 0.26, 0.55, 0);
      g.add(pick);
    }
    return g;
  }

  private makeCrate(map: THREE.Texture) {
    const wood = new THREE.MeshStandardMaterial({ map, roughness: 0.8 });
    const band = new THREE.MeshStandardMaterial({ color: 0x3e3428, roughness: 0.5, metalness: 0.25 });
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.52, 0.68), wood);
    body.position.y = 0.26;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.12, 0.74), wood);
    lid.position.y = 0.58;
    const lip = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.04, 0.78), wood);
    lip.position.y = 0.66;
    g.add(body, lid, lip);
    for (const z of [-0.35, 0.35]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.055, 0.02), band);
      strap.position.set(0, 0.28, z);
      g.add(strap);
    }
    for (const x of [-0.47, 0.47]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.055, 0.7), band);
      strap.position.set(x, 0.28, 0);
      g.add(strap);
    }
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.05), band);
    latch.position.set(0, 0.52, 0.36);
    g.add(latch);
    return g;
  }

  private makeFurnace() {
    const rock = new THREE.MeshStandardMaterial({ map: this.texMaps.rock, roughness: 0.92 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a120e, roughness: 0.8 });
    const ember = new THREE.MeshStandardMaterial({ color: 0xff6a2a, emissive: 0xff4a10, emissiveIntensity: 0.6 });
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.82, 0.9), rock);
    body.position.y = 0.41;
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.06), dark);
    mouth.position.set(0, 0.32, 0.44);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.04), ember);
    glow.position.set(0, 0.24, 0.46);
    const stack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.28), rock);
    stack.position.set(0, 1.02, -0.22);
    g.add(body, mouth, glow, stack);
    return g;
  }

  private makeBench() {
    const wood = this.plankMat();
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.08, 0.78), wood);
    top.position.y = 0.78;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.62), wood);
    shelf.position.y = 0.32;
    g.add(top, shelf);
    for (const [x, z] of [[-0.62, -0.3], [0.62, -0.3], [-0.62, 0.3], [0.62, 0.3]] as const) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.78, 0.08), wood);
      leg.position.set(x, 0.39, z);
      g.add(leg);
    }
    const vice = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), new THREE.MeshStandardMaterial({ color: 0x8d939a, metalness: 0.5, roughness: 0.4 }));
    vice.position.set(0.5, 0.88, 0);
    g.add(vice);
    return g;
  }

  private makeCampfire() {
    const g = new THREE.Group();
    const rock = new THREE.MeshStandardMaterial({ map: this.texMaps.rock, roughness: 0.95 });
    const log = new THREE.MeshStandardMaterial({ map: this.texMaps.bark, roughness: 0.9 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 0), rock);
      stone.position.set(Math.cos(a) * 0.38, 0.1, Math.sin(a) * 0.38);
      stone.scale.y = 0.7;
      g.add(stone);
    }
    for (const r of [0.4, -0.5]) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.7, 6), log);
      stick.rotation.z = r;
      stick.rotation.y = r;
      stick.position.y = 0.16;
      g.add(stick);
    }
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.28, 5),
      new THREE.MeshStandardMaterial({ color: 0xff7a2a, emissive: 0xff5a10, emissiveIntensity: 0.8 }),
    );
    flame.position.y = 0.28;
    g.add(flame);
    return g;
  }

  private makePlant() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, 0.35, 6),
      new THREE.MeshStandardMaterial({ map: this.texMaps.bark, roughness: 0.9 }),
    );
    trunk.position.y = 0.18;
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.55, 7),
      new THREE.MeshStandardMaterial({ map: this.texMaps.leaves, color: 0x3e8a34, roughness: 0.8 }),
    );
    leaf.position.y = 0.55;
    const leaf2 = leaf.clone();
    leaf2.scale.set(0.7, 0.7, 0.7);
    leaf2.position.y = 0.78;
    g.add(trunk, leaf, leaf2);
    return g;
  }

  private spawnDrop(x: number, y: number, z: number, id: ItemId, n: number) {
    const mesh = this.itemProp(id);
    mesh.position.set(x + (this.rng() - 0.5) * 0.4, y + 0.05, z + (this.rng() - 0.5) * 0.4);
    this.scene.add(mesh);
    this.drops.push({ mesh, id, n, life: 90 });
  }

  private itemProp(id: ItemId) {
    const g = new THREE.Group();
    if (id === "wood") {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.42, 6), new THREE.MeshStandardMaterial({ map: this.texMaps.bark, roughness: 0.9 }));
      log.rotation.z = Math.PI / 2;
      log.position.y = 0.08;
      g.add(log);
    } else if (id === "fish" || id === "cookedFish") {
      const fish = this.makeFish();
      fish.scale.setScalar(0.7);
      g.add(fish);
    } else if (id === "meat" || id === "cookedMeat") {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 5), this.tone(id === "cookedMeat" ? 0x8a4530 : 0xc4564e, 0.55));
      m.scale.set(1.35, 0.55, 0.8);
      m.position.y = 0.06;
      g.add(m);
    } else if (id === "fiber" || id === "herbs" || id === "berries") {
      const col = id === "berries" ? 0xc4473a : id === "herbs" ? 0x3c8a36 : 0x8ea24a;
      for (let i = 0; i < 5; i++) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.2, 4), this.tone(col, 0.7));
        blade.position.set((i - 2) * 0.035, 0.1, (i % 2) * 0.03);
        blade.rotation.z = (i - 2) * 0.18;
        g.add(blade);
      }
    } else if (id === "cloth") {
      const fold = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.16), this.tone(0xd8d2c2, 0.9));
      fold.position.y = 0.04;
      fold.rotation.y = 0.4;
      g.add(fold);
    } else {
      const col = id === "gold" || id === "ironIngot" ? 0xe1b84a : id === "iron" ? 0x9aa0a6 : id === "sulfur" ? 0xd6c24a : id === "coal" ? 0x2a2a2a : 0x8d8880;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 0), this.tone(col, 0.88));
      rock.scale.set(1.15, 0.65, 0.9);
      rock.position.y = 0.07;
      g.add(rock);
    }
    return g;
  }

  private disposeObj(obj: THREE.Object3D) {
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
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
    this.disposeObj(d.mesh);
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

  moveSlot(from: number, to: number) {
    const src = useGameStore.getState().inventory;
    if (from === to || from < 0 || to < 0 || from >= src.length || to >= src.length) return;
    const inv = src.map((s) => (s ? { ...s } : null));
    const a = inv[from];
    const b = inv[to];
    if (!a) return;
    if (b && b.id === a.id) {
      const room = ITEM[a.id].stack - b.count;
      const take = Math.min(Math.max(0, room), a.count);
      b.count += take;
      a.count -= take;
      inv[from] = a.count > 0 ? a : null;
    } else {
      inv[from] = b;
      inv[to] = a;
    }
    useGameStore.getState().patch({ inventory: inv });
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
    this.windU.value = this.session;

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
      builds: this.builds.map((b) => ({
        type: b.type,
        x: b.pos.x,
        y: b.pos.y,
        z: b.pos.z,
        rot: b.rot,
        code: b.code,
        owners: b.owners,
        open: b.open,
      })),
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
        builds: { type: ItemId; x: number; y: number; z: number; rot: number; code?: string; owners?: string[]; open?: boolean }[];
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
      useGameStore.getState().patch({ inventory: fitInv(d.inventory), outfit: d.outfit, training: d.training });
      for (const b of d.builds ?? []) {
        const built = this.placeBuild(b.type, new THREE.Vector3(b.x, b.y, b.z), b.rot);
        built.code = b.code;
        built.owners = b.owners;
        if (b.open && built.type === "door") {
          built.open = true;
          const panel = built.mesh.getObjectByName("panel");
          if (panel) panel.rotation.y = -Math.PI / 2;
        }
        this.attachLockMesh(built);
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
