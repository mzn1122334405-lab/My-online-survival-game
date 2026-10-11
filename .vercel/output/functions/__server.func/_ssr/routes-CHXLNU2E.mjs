import { o as __toESM } from "../_runtime.mjs";
import { S as require_jsx_runtime, Y as require_react, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as signOut } from "./client-1vAx-gM_.mjs";
import { a as hasGateSessionMarker } from "./server-ClEkcw8V.mjs";
import { a as RECIPES, i as OUTFITS, n as EYE, o as WATER_Y, r as ITEM, t as COPY } from "./data-nTq2QRWJ.mjs";
import { a as t, c as useCurrentUserState, i as sendChat, l as useGameStore, n as getMyProfile, o as upsertProfile, r as listChat, s as useCurrentUser, t as freshInventory } from "./online-C6tyAErU.mjs";
import { a as Swords, c as Pause, d as Crosshair, f as Compass, l as MessageSquare, n as Volume2, o as RotateCcw, p as Box, r as Users, s as Play, t as VolumeX, u as Map$1 } from "../_libs/lucide-react.mjs";
import { A as SRGBColorSpace, C as Object3D, D as PointsMaterial, E as Points, F as SpriteMaterial, I as TextureLoader, L as TorusGeometry, M as ShaderMaterial, N as SphereGeometry, O as Raycaster, P as Sprite, R as Vector3, S as MeshStandardMaterial, T as PlaneGeometry, _ as LineBasicMaterial, a as CanvasTexture, b as Mesh, c as ConeGeometry, d as DirectionalLight, f as Fog, g as Line, h as InstancedMesh, i as BufferGeometry, j as Scene, k as RepeatWrapping, l as CylinderGeometry, m as HemisphereLight, n as BoxGeometry, o as CapsuleGeometry, p as Group, r as BufferAttribute, s as Color, t as WebGLRenderer, u as DataTexture, v as MathUtils, w as PerspectiveCamera, x as MeshBasicMaterial, y as Matrix4 } from "../_libs/three.mjs";
import { t as createNoise2D } from "../_libs/simplex-noise.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CHXLNU2E.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var GameAudio = class {
	ctx = null;
	master = null;
	sfx = null;
	music = null;
	muted = false;
	amb = null;
	ambGain = null;
	rainGain = null;
	noise = null;
	unlock() {
		if (!this.ctx) {
			const Ctx = window.AudioContext || window.webkitAudioContext;
			this.ctx = new Ctx({ latencyHint: "interactive" });
			this.master = this.ctx.createGain();
			this.sfx = this.ctx.createGain();
			this.music = this.ctx.createGain();
			this.sfx.gain.value = .7;
			this.music.gain.value = .22;
			this.sfx.connect(this.master);
			this.music.connect(this.master);
			this.master.connect(this.ctx.destination);
			this.noise = this.makeNoise();
			this.startAmb();
		}
		if (this.ctx.state === "suspended") this.ctx.resume();
	}
	setMuted(v) {
		this.muted = v;
		if (this.master) this.master.gain.setTargetAtTime(v ? 0 : 1, this.ctx.currentTime, .02);
	}
	makeNoise() {
		const ctx = this.ctx;
		const buf = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
		return buf;
	}
	startAmb() {
		if (!this.ctx || !this.music || !this.noise) return;
		const g = this.ctx.createGain();
		g.gain.value = .08;
		const src = this.ctx.createBufferSource();
		src.buffer = this.noise;
		src.loop = true;
		const f = this.ctx.createBiquadFilter();
		f.type = "lowpass";
		f.frequency.value = 420;
		src.connect(f);
		f.connect(g);
		g.connect(this.music);
		src.start();
		this.ambGain = g;
		const o = this.ctx.createOscillator();
		o.type = "sine";
		o.frequency.value = 72;
		const og = this.ctx.createGain();
		og.gain.value = .012;
		o.connect(og);
		og.connect(this.music);
		o.start();
		this.amb = o;
		const rg = this.ctx.createGain();
		rg.gain.value = 0;
		const rs = this.ctx.createBufferSource();
		rs.buffer = this.noise;
		rs.loop = true;
		const hf = this.ctx.createBiquadFilter();
		hf.type = "highpass";
		hf.frequency.value = 1800;
		rs.connect(hf);
		hf.connect(rg);
		rg.connect(this.music);
		rs.start();
		this.rainGain = rg;
	}
	setRain(on) {
		if (!this.rainGain || !this.ctx) return;
		this.rainGain.gain.setTargetAtTime(on ? .12 : 0, this.ctx.currentTime, .4);
	}
	setNight(night) {
		if (!this.ambGain || !this.ctx) return;
		this.ambGain.gain.setTargetAtTime(night ? .14 : .08, this.ctx.currentTime, .8);
	}
	beep(freq, dur, type, vol = .12, slide = 0) {
		if (!this.ctx || !this.sfx) return;
		const t = this.ctx.currentTime;
		const o = this.ctx.createOscillator();
		const g = this.ctx.createGain();
		o.type = type;
		o.frequency.setValueAtTime(freq, t);
		if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
		g.gain.setValueAtTime(vol, t);
		g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
		o.connect(g);
		g.connect(this.sfx);
		o.start(t);
		o.stop(t + dur + .02);
	}
	burst(vol = .18, dur = .08, cutoff = 1200) {
		if (!this.ctx || !this.sfx || !this.noise) return;
		const t = this.ctx.currentTime;
		const src = this.ctx.createBufferSource();
		src.buffer = this.noise;
		const f = this.ctx.createBiquadFilter();
		f.type = "bandpass";
		f.frequency.value = cutoff;
		const g = this.ctx.createGain();
		g.gain.setValueAtTime(vol, t);
		g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
		src.connect(f);
		f.connect(g);
		g.connect(this.sfx);
		src.start(t);
		src.stop(t + dur);
	}
	chop() {
		this.burst(.22, .09, 900);
		this.beep(140, .08, "square", .05, -60);
	}
	mine() {
		this.burst(.2, .1, 500);
		this.beep(90, .1, "sawtooth", .06, -30);
	}
	swing() {
		this.burst(.1, .06, 1800);
	}
	shoot() {
		this.burst(.32, .07, 700);
		this.beep(220, .05, "square", .08, -160);
	}
	bow() {
		this.beep(420, .06, "triangle", .08, -200);
	}
	hit() {
		this.beep(180, .07, "square", .1, -80);
	}
	hurt() {
		this.beep(110, .18, "sawtooth", .12, -50);
	}
	pickup() {
		this.beep(660, .08, "sine", .08, 120);
	}
	craft() {
		this.beep(520, .1, "triangle", .07);
		this.beep(740, .12, "sine", .05);
	}
	eat() {
		this.burst(.08, .12, 400);
	}
	step() {
		this.burst(.045, .05, 280);
	}
	ui() {
		this.beep(480, .04, "sine", .05);
	}
	explode() {
		this.burst(.45, .28, 180);
		this.beep(70, .3, "sawtooth", .14, -40);
	}
	place() {
		this.beep(200, .08, "square", .07);
		this.burst(.1, .08, 600);
	}
};
var Input = class {
	keys = /* @__PURE__ */ new Set();
	injected = null;
	lookX = 0;
	lookY = 0;
	fireHeld = false;
	fireClick = false;
	interactClick = false;
	jumpClick = false;
	touchMoveX = 0;
	touchMoveY = 0;
	touchLookX = 0;
	touchLookY = 0;
	isTouch = false;
	leftId = -1;
	rightId = -1;
	leftOrigin = {
		x: 0,
		y: 0
	};
	rightLast = {
		x: 0,
		y: 0
	};
	canvas;
	onLock;
	onUnlock;
	prevent = /* @__PURE__ */ new Set([
		"Space",
		"ArrowUp",
		"ArrowDown",
		"ArrowLeft",
		"ArrowRight",
		"Tab",
		"KeyI",
		"KeyC",
		"KeyB",
		"KeyM",
		"KeyE",
		"KeyQ",
		"KeyR"
	]);
	constructor(canvas, onLock, onUnlock) {
		this.canvas = canvas;
		this.onLock = onLock;
		this.onUnlock = onUnlock;
		this.isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
	}
	attach() {
		window.addEventListener("keydown", this.kd);
		window.addEventListener("keyup", this.ku);
		window.addEventListener("blur", this.clear);
		document.addEventListener("visibilitychange", this.vis);
		document.addEventListener("pointerlockchange", this.plc);
		this.canvas.addEventListener("mousemove", this.mm);
		this.canvas.addEventListener("mousedown", this.md);
		window.addEventListener("mouseup", this.mu);
		this.canvas.addEventListener("contextmenu", this.ctx);
		this.canvas.addEventListener("pointerdown", this.pd);
		window.addEventListener("pointermove", this.pm);
		window.addEventListener("pointerup", this.pu);
		window.addEventListener("pointercancel", this.pu);
	}
	detach() {
		window.removeEventListener("keydown", this.kd);
		window.removeEventListener("keyup", this.ku);
		window.removeEventListener("blur", this.clear);
		document.removeEventListener("visibilitychange", this.vis);
		document.removeEventListener("pointerlockchange", this.plc);
		this.canvas.removeEventListener("mousemove", this.mm);
		this.canvas.removeEventListener("mousedown", this.md);
		window.removeEventListener("mouseup", this.mu);
		this.canvas.removeEventListener("contextmenu", this.ctx);
		this.canvas.removeEventListener("pointerdown", this.pd);
		window.removeEventListener("pointermove", this.pm);
		window.removeEventListener("pointerup", this.pu);
		window.removeEventListener("pointercancel", this.pu);
		if (document.pointerLockElement) document.exitPointerLock();
	}
	requestLock() {
		if (this.isTouch) return;
		const el = this.canvas;
		const p = el.requestPointerLock({ unadjustedMovement: true });
		if (p && typeof p.catch === "function") p.catch(() => {
			el.requestPointerLock();
		});
	}
	plc = () => {
		if (document.pointerLockElement === this.canvas) this.onLock();
		else this.onUnlock();
	};
	kd = (e) => {
		if (e.repeat) return;
		if (this.prevent.has(e.code) || /^Digit[1-8]$/.test(e.code)) e.preventDefault();
		this.keys.add(e.code);
		if (e.code === "KeyE") this.interactClick = true;
		if (e.code === "Space") this.jumpClick = true;
	};
	ku = (e) => {
		this.keys.delete(e.code);
	};
	clear = () => {
		this.keys.clear();
		this.fireHeld = false;
	};
	vis = () => {
		if (document.hidden) this.clear();
	};
	mm = (e) => {
		if (document.pointerLockElement !== this.canvas) return;
		this.lookX += e.movementX;
		this.lookY += e.movementY;
	};
	md = (e) => {
		if (e.button === 0) {
			this.fireHeld = true;
			this.fireClick = true;
		}
	};
	mu = (e) => {
		if (e.button === 0) this.fireHeld = false;
	};
	ctx = (e) => e.preventDefault();
	pd = (e) => {
		if (!this.isTouch) return;
		const r = this.canvas.getBoundingClientRect();
		const x = e.clientX - r.left;
		const mid = r.width * .42;
		if (x < mid && this.leftId < 0) {
			this.leftId = e.pointerId;
			this.leftOrigin = {
				x: e.clientX,
				y: e.clientY
			};
		} else if (x >= mid && this.rightId < 0) {
			this.rightId = e.pointerId;
			this.rightLast = {
				x: e.clientX,
				y: e.clientY
			};
		}
	};
	pm = (e) => {
		if (!this.isTouch) return;
		if (e.pointerId === this.leftId) {
			const dx = (e.clientX - this.leftOrigin.x) / 52;
			const dy = (e.clientY - this.leftOrigin.y) / 52;
			const m = Math.hypot(dx, dy);
			const s = m > 1 ? 1 / m : 1;
			this.touchMoveX = dx * s;
			this.touchMoveY = dy * s;
		} else if (e.pointerId === this.rightId) {
			this.touchLookX += e.clientX - this.rightLast.x;
			this.touchLookY += e.clientY - this.rightLast.y;
			this.rightLast = {
				x: e.clientX,
				y: e.clientY
			};
		}
	};
	pu = (e) => {
		if (e.pointerId === this.leftId) {
			this.leftId = -1;
			this.touchMoveX = 0;
			this.touchMoveY = 0;
		}
		if (e.pointerId === this.rightId) this.rightId = -1;
	};
	down(code) {
		return (this.injected ?? this.keys).has(code);
	}
	setKeys(codes) {
		this.injected = new Set(codes);
	}
	sample() {
		const src = this.injected ?? this.keys;
		let x = 0;
		let y = 0;
		if (src.has("KeyA") || src.has("ArrowLeft")) x -= 1;
		if (src.has("KeyD") || src.has("ArrowRight")) x += 1;
		if (src.has("KeyW") || src.has("ArrowUp")) y += 1;
		if (src.has("KeyS") || src.has("ArrowDown")) y -= 1;
		x += this.touchMoveX;
		y -= this.touchMoveY;
		const m = Math.hypot(x, y);
		if (m > 1) {
			x /= m;
			y /= m;
		}
		const lx = this.lookX + this.touchLookX;
		const ly = this.lookY + this.touchLookY;
		this.lookX = 0;
		this.lookY = 0;
		this.touchLookX = 0;
		this.touchLookY = 0;
		const fire = this.fireHeld || this.fireClick || src.has("Mouse0");
		const interact = this.interactClick || src.has("KeyE");
		const jump = this.jumpClick || src.has("Space");
		this.fireClick = false;
		this.interactClick = false;
		this.jumpClick = false;
		return {
			moveX: x,
			moveY: y,
			lookX: lx,
			lookY: ly,
			jump,
			sprint: src.has("ShiftLeft") || src.has("ShiftRight"),
			crouch: src.has("KeyC") && !src.has("ControlLeft"),
			fire,
			interact,
			reload: src.has("KeyR")
		};
	}
};
var SEG = 120;
var SIZE = 220;
var GRID = 121;
var SAVE = "tribals-save-v1";
var FIXED = 1 / 60;
function mulberry(a) {
	return () => {
		let t = a += 1831565813;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
function addItem(inv, id, n) {
	const stack = ITEM[id].stack;
	let left = n;
	for (const s of inv) if (s && s.id === id && s.count < stack) {
		const room = stack - s.count;
		const take = Math.min(room, left);
		s.count += take;
		left -= take;
		if (!left) return true;
	}
	for (let i = 0; i < inv.length; i++) if (!inv[i]) {
		const take = Math.min(stack, left);
		inv[i] = {
			id,
			count: take
		};
		left -= take;
		if (!left) return true;
	}
	return left < n;
}
function countItem(inv, id) {
	return inv.reduce((a, s) => a + (s && s.id === id ? s.count : 0), 0);
}
function takeItem(inv, id, n) {
	if (countItem(inv, id) < n) return false;
	let left = n;
	for (const s of inv) {
		if (!s || s.id !== id) continue;
		const take = Math.min(s.count, left);
		s.count -= take;
		left -= take;
		if (!left) break;
	}
	for (let i = 0; i < inv.length; i++) if (inv[i] && inv[i].count <= 0) inv[i] = null;
	return true;
}
function hotItem(inv, idx) {
	return inv[40 + idx] ?? null;
}
var TribalsEngine = class {
	canvas;
	renderer;
	scene = new Scene();
	cam = new PerspectiveCamera(78, 1, .08, 420);
	wscene = new Scene();
	wcam = new PerspectiveCamera(55, 1, .05, 8);
	input;
	audio = new GameAudio();
	noise2D;
	rng;
	heights = /* @__PURE__ */ new Float32Array(14641);
	pos = new Vector3(0, 2, 78);
	vel = new Vector3();
	yaw = 0;
	pitch = -.08;
	onGround = true;
	eye = EYE;
	stamina = 100;
	health = 100;
	hunger = 100;
	thirst = 100;
	time = .3;
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
	quests = {
		wood: 0,
		axe: 0,
		tree: 0,
		hunt: 0,
		base: 0,
		raid: 0
	};
	gathered = {};
	training = false;
	outfit = 0;
	seed = 1;
	locked = false;
	overlay = "none";
	dead = false;
	paused = false;
	running = false;
	remotes = /* @__PURE__ */ new Map();
	isAdmin = false;
	netName = "";
	acc = 0;
	last = 0;
	sun;
	hemi;
	water;
	terrainMat;
	weapon;
	ghost;
	inst = [];
	creatures = [];
	builds = [];
	drops = [];
	bullets = [];
	rain;
	tracers = [];
	tmp = new Vector3();
	tmp2 = new Vector3();
	fwd = new Vector3();
	right = new Vector3();
	ray = new Raycaster();
	mat = new Matrix4();
	dummy = new Object3D();
	prevKeys = /* @__PURE__ */ new Set();
	hudT = 0;
	mapT = 0;
	mapCanvas;
	saveT = 0;
	nearStation = "hand";
	buildId = 1;
	creatId = 1;
	woodMat;
	leafMat;
	rockMat;
	armMat;
	disposed = false;
	textures = [];
	texMaps = {};
	spriteTex = {};
	constructor(canvas) {
		this.canvas = canvas;
		this.rng = mulberry(1337);
		this.noise2D = createNoise2D(this.rng);
		this.renderer = new WebGLRenderer({
			canvas,
			antialias: true,
			powerPreference: "high-performance"
		});
		this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
		this.renderer.setClearColor(8894676);
		this.renderer.shadowMap.enabled = false;
		this.renderer.autoClear = false;
		this.scene.fog = new Fog(8894676, 48, 210);
		this.hemi = new HemisphereLight(13625599, 3820072, .9);
		this.scene.add(this.hemi);
		this.sun = new DirectionalLight(16770744, 1.4);
		this.sun.position.set(40, 70, 20);
		this.scene.add(this.sun);
		this.scene.add(this.sun.target);
		this.input = new Input(canvas, () => {
			this.locked = true;
			useGameStore.getState().patch({ locked: true });
		}, () => {
			this.locked = false;
			useGameStore.getState().patch({ locked: false });
		});
		this.woodMat = new MeshStandardMaterial({
			color: 9134649,
			roughness: .9
		});
		this.leafMat = new MeshStandardMaterial({
			color: 3107384,
			roughness: .85
		});
		this.rockMat = new MeshStandardMaterial({
			color: 9078400,
			roughness: 1,
			flatShading: true
		});
		this.armMat = new MeshStandardMaterial({
			color: 7043658,
			roughness: .7
		});
		this.terrainMat = new ShaderMaterial({
			uniforms: {
				tGrass: { value: null },
				tSand: { value: null },
				tRock: { value: null },
				sunDir: { value: new Vector3(.35, .85, .25) },
				ambient: { value: new Color(5071488) },
				sunCol: { value: new Color(16769712) }
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
        }`
		});
		this.water = new Mesh();
		this.weapon = new Group();
		this.ghost = new Mesh(new BoxGeometry(1.5, .35, 1.5), new MeshBasicMaterial({
			color: 7189869,
			transparent: true,
			opacity: .4,
			depthWrite: false
		}));
		this.ghost.visible = false;
		this.scene.add(this.ghost);
		this.rain = new Points();
		this.mapCanvas = document.createElement("canvas");
		this.mapCanvas.width = 160;
		this.mapCanvas.height = 160;
		this.wcam.position.set(0, 0, 0);
		this.wscene.add(this.wcam);
		this.weapon.position.set(.32, -.28, -.55);
		this.wcam.add(this.weapon);
	}
	async start(opts) {
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
		useGameStore.getState().patch({
			screen: "playing",
			training: this.training,
			overlay: "none"
		});
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
			const m = o;
			if (m.geometry) m.geometry.dispose();
			const mat = m.material;
			if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
			else mat?.dispose();
		});
		this.textures.forEach((t) => t.dispose());
		this.renderer.dispose();
	}
	async loadTextures() {
		const loader = new TextureLoader();
		loader.crossOrigin = "anonymous";
		const names = [
			"grass",
			"sand",
			"rock",
			"bark",
			"leaves",
			"water",
			"planks",
			"dirt"
		];
		const maps = {};
		await Promise.all(names.map(async (n) => {
			try {
				const tex = await loader.loadAsync(`/textures/${n}.jpg`);
				tex.wrapS = tex.wrapT = RepeatWrapping;
				tex.colorSpace = SRGBColorSpace;
				tex.anisotropy = 4;
				maps[n] = tex;
				this.textures.push(tex);
			} catch (err) {
				console.warn("texture fail", n, err);
				const data = new Uint8Array([
					120,
					140,
					80
				]);
				const tex = new DataTexture(data, 1, 1);
				tex.needsUpdate = true;
				maps[n] = tex;
			}
		}));
		this.terrainMat.uniforms.tGrass.value = maps.grass;
		this.terrainMat.uniforms.tSand.value = maps.sand;
		this.terrainMat.uniforms.tRock.value = maps.rock;
		this.woodMat.map = maps.bark;
		this.woodMat.color.set(16777215);
		this.leafMat.map = maps.leaves;
		this.leafMat.color.set(16777215);
		this.rockMat.map = maps.rock;
		this.rockMat.color.set(16777215);
		this.texMaps = maps;
		await Promise.all([
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
			"village"
		].map(async (n) => {
			try {
				const tex = await loader.loadAsync(`/sprites/${n}.png`);
				tex.colorSpace = SRGBColorSpace;
				tex.anisotropy = 4;
				this.spriteTex[n] = tex;
				this.textures.push(tex);
			} catch (err) {
				console.warn("sprite fail", n, err);
			}
		}));
	}
	hgt(x, z) {
		const n1 = this.noise2D(x * .012, z * .012);
		const n2 = this.noise2D(x * .04 + 20, z * .04);
		const n3 = this.noise2D(x * .1, z * .1);
		const d = Math.hypot(x, z) / 96;
		if (d > 1.18) return -8;
		let h = (1 - Math.min(1, d * d)) * 9.5 + n1 * 4.2 + n2 * 1.6 + n3 * .35 - 1.1;
		if (d < .12) h -= 2.2;
		if (d > .92) h = MathUtils.lerp(h, -2.5, (d - .92) / .26);
		return h;
	}
	sample(x, z) {
		const u = (x + SIZE / 2) / SIZE * SEG;
		const v = (z + SIZE / 2) / SIZE * SEG;
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
	buildWorld() {
		const geo = new PlaneGeometry(SIZE, SIZE, SEG, SEG);
		geo.rotateX(-Math.PI / 2);
		for (let iz = 0; iz <= SEG; iz++) for (let ix = 0; ix <= SEG; ix++) {
			const x = ix / SEG * SIZE - SIZE / 2;
			const z = iz / SEG * SIZE - SIZE / 2;
			this.heights[iz * GRID + ix] = this.hgt(x, z);
		}
		const pos = geo.attributes.position;
		for (let i = 0; i < pos.count; i++) {
			const x = pos.getX(i);
			const z = pos.getZ(i);
			pos.setY(i, this.sample(x, z));
		}
		geo.computeVertexNormals();
		const terrain = new Mesh(geo, this.terrainMat);
		terrain.receiveShadow = true;
		this.scene.add(terrain);
		const wgeo = new PlaneGeometry(SIZE * 1.6, SIZE * 1.6, 1, 1);
		const wmat = new MeshStandardMaterial({
			map: this.texMaps.water,
			color: 7259348,
			transparent: true,
			opacity: .72,
			roughness: .15,
			metalness: .1,
			depthWrite: false
		});
		if (wmat.map) wmat.map.repeat.set(18, 18);
		this.water = new Mesh(wgeo, wmat);
		this.water.rotation.x = -Math.PI / 2;
		this.water.position.y = WATER_Y;
		this.scene.add(this.water);
		this.scatter();
		this.spawnFauna();
		this.makeCamps();
		this.makeRain();
	}
	makeInst(geo, mat, n, kind, place) {
		const mesh = new InstancedMesh(geo, mat, n);
		mesh.frustumCulled = false;
		const hp = new Float32Array(n);
		const max = new Float32Array(n);
		const drop = [];
		const extra = [];
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
		const rec = {
			mesh,
			kind,
			hp,
			max,
			drop,
			extra,
			alive,
			x: xs,
			z: zs,
			r: rs
		};
		this.inst.push(rec);
		return rec;
	}
	makeBills(texName, n, kind, w, h, place) {
		const tex = this.spriteTex[texName];
		const mat = tex ? new SpriteMaterial({
			map: tex,
			transparent: true,
			alphaTest: .28,
			depthWrite: true
		}) : new SpriteMaterial({ color: 3832376 });
		const dummyGeo = new BoxGeometry(.15, .15, .15);
		const mesh = new InstancedMesh(dummyGeo, this.woodMat, n);
		mesh.visible = false;
		mesh.frustumCulled = false;
		const hp = new Float32Array(n);
		const max = new Float32Array(n);
		const drop = [];
		const extra = [];
		const alive = new Uint8Array(n);
		const xs = new Float32Array(n);
		const zs = new Float32Array(n);
		const rs = new Float32Array(n);
		const vis = [];
		let k = 0;
		for (let i = 0; i < n * 10 && k < n; i++) {
			const p = place();
			if (!p) continue;
			const spr = new Sprite(mat);
			spr.center.set(.5, 0);
			const jitter = .85 + this.rng() * .35;
			spr.scale.set(w * jitter, h * jitter, 1);
			spr.position.set(p.x, this.sample(p.x, p.z), p.z);
			this.scene.add(spr);
			vis[k] = spr;
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
		const rec = {
			mesh,
			kind,
			hp,
			max,
			drop,
			extra,
			alive,
			x: xs,
			z: zs,
			r: rs,
			vis
		};
		this.inst.push(rec);
		return rec;
	}
	scatter() {
		const tryPlace = (minH, maxH, minD, maxD) => {
			const a = this.rng() * Math.PI * 2;
			const d = minD + this.rng() * (maxD - minD);
			const x = Math.cos(a) * d;
			const z = Math.sin(a) * d;
			const y = this.sample(x, z);
			if (y < minH || y > maxH) return null;
			if (x * x + (z - 86) * (z - 86) < 196) return null;
			return {
				x,
				z,
				y
			};
		};
		this.makeBills("palm", 36, "tree", 6.6, 10.4, () => {
			const p = tryPlace(.35, 3.4, 52, 94);
			if (!p) return null;
			return {
				hp: 75,
				drop: "wood",
				extra: "fiber",
				x: p.x,
				z: p.z,
				r: .55
			};
		});
		this.makeBills("oak", 48, "tree", 7.2, 8.6, () => {
			const p = tryPlace(1.4, 8.2, 8, 72);
			if (!p) return null;
			return {
				hp: 95,
				drop: "wood",
				extra: "fiber",
				x: p.x,
				z: p.z,
				r: .7
			};
		});
		this.makeBills("pine", 32, "tree", 5.4, 9.8, () => {
			const p = tryPlace(6.2, 14, 4, 44);
			if (!p) return null;
			return {
				hp: 85,
				drop: "wood",
				extra: "coal",
				x: p.x,
				z: p.z,
				r: .55
			};
		});
		this.makeBills("dead", 14, "tree", 4.8, 8, () => {
			const p = tryPlace(4, 12, 10, 80);
			if (!p) return null;
			return {
				hp: 50,
				drop: "wood",
				extra: "coal",
				x: p.x,
				z: p.z,
				r: .4
			};
		});
		this.makeBills("rock_s", 28, "rock", 1.9, 1.45, () => {
			const p = tryPlace(.3, 12, 8, 94);
			if (!p) return null;
			return {
				hp: 40,
				drop: "stone",
				extra: "coal",
				x: p.x,
				z: p.z,
				r: .55
			};
		});
		this.makeBills("rock_m", 22, "rock", 2.7, 2.1, () => {
			const p = tryPlace(.4, 11, 10, 90);
			if (!p) return null;
			return {
				hp: 70,
				drop: "stone",
				extra: "iron",
				x: p.x,
				z: p.z,
				r: .75
			};
		});
		this.makeBills("rock_l", 16, "rock", 3.4, 2.6, () => {
			const p = tryPlace(1, 12, 12, 86);
			if (!p) return null;
			return {
				hp: 95,
				drop: "stone",
				extra: "iron",
				x: p.x,
				z: p.z,
				r: .95
			};
		});
		this.makeBills("rock_gold", 10, "rock", 2.4, 1.9, () => {
			const p = tryPlace(5.5, 14, 6, 50);
			if (!p) return null;
			return {
				hp: 80,
				drop: "gold",
				extra: "sulfur",
				x: p.x,
				z: p.z,
				r: .65
			};
		});
		this.makeBills("oak", 34, "bush", 1.6, 1.35, () => {
			const p = tryPlace(.6, 5.2, 18, 88);
			if (!p) return null;
			const roll = this.rng();
			return {
				hp: 16,
				drop: roll > .55 ? "berries" : roll > .25 ? "fiber" : "herbs",
				x: p.x,
				z: p.z,
				r: .45
			};
		});
	}
	body(kind) {
		const g = new Group();
		const key = kind === "goat" ? "deer" : kind;
		const tex = this.spriteTex[key] ?? this.spriteTex.scout;
		const [w, h] = {
			deer: [1.85, 1.7],
			goat: [1.6, 1.5],
			boar: [1.9, 1.45],
			wolf: [1.8, 1.55],
			bear: [2.35, 1.95],
			basic: [1.15, 2.05],
			armed: [1.2, 2.1],
			sniper: [1.15, 2.05],
			boss: [1.45, 2.25]
		}[kind] ?? [1.4, 1.8];
		if (tex) {
			const spr = new Sprite(new SpriteMaterial({
				map: tex,
				transparent: true,
				alphaTest: .28,
				depthWrite: true
			}));
			spr.center.set(.5, 0);
			spr.scale.set(w, h, 1);
			g.add(spr);
		} else {
			const m = new Mesh(new CapsuleGeometry(.22, .7, 3, 6), new MeshStandardMaterial({ color: 6969914 }));
			m.position.y = .7;
			g.add(m);
		}
		return g;
	}
	playerPawn() {
		const g = new Group();
		const tex = this.spriteTex.scout ?? this.spriteTex.basic;
		if (tex) {
			const spr = new Sprite(new SpriteMaterial({
				map: tex,
				transparent: true,
				alphaTest: .28,
				depthWrite: true
			}));
			spr.center.set(.5, 0);
			spr.scale.set(1.15, 2.05, 1);
			g.add(spr);
		}
		return g;
	}
	spawnFauna() {
		const kinds = [
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
			"basic",
			"basic",
			"basic",
			"armed",
			"armed",
			"sniper",
			"boss"
		];
		if (this.training) kinds.splice(0, kinds.length, "deer", "deer", "deer", "boar", "wolf");
		const stats = {
			deer: {
				hp: 40,
				speed: 5.5,
				aggro: 14,
				melee: 1.6,
				dmg: 6,
				flee: true,
				ranged: 0,
				radius: .55
			},
			goat: {
				hp: 35,
				speed: 5,
				aggro: 10,
				melee: 1.4,
				dmg: 5,
				flee: true,
				ranged: 0,
				radius: .5
			},
			boar: {
				hp: 70,
				speed: 4.6,
				aggro: 10,
				melee: 1.7,
				dmg: 14,
				flee: false,
				ranged: 0,
				radius: .6
			},
			wolf: {
				hp: 55,
				speed: 6.2,
				aggro: 18,
				melee: 1.5,
				dmg: 12,
				flee: false,
				ranged: 0,
				radius: .5
			},
			bear: {
				hp: 150,
				speed: 4.2,
				aggro: 12,
				melee: 2,
				dmg: 22,
				flee: false,
				ranged: 0,
				radius: .85
			},
			basic: {
				hp: 55,
				speed: 3.6,
				aggro: 16,
				melee: 1.8,
				dmg: 10,
				flee: false,
				ranged: 0,
				radius: .5
			},
			armed: {
				hp: 80,
				speed: 3.4,
				aggro: 22,
				melee: 1.8,
				dmg: 12,
				flee: false,
				ranged: 18,
				radius: .5
			},
			sniper: {
				hp: 60,
				speed: 2.8,
				aggro: 40,
				melee: 1.6,
				dmg: 18,
				flee: false,
				ranged: 38,
				radius: .5
			},
			boss: {
				hp: 240,
				speed: 3.5,
				aggro: 28,
				melee: 2.2,
				dmg: 24,
				flee: false,
				ranged: 16,
				radius: .9
			}
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
				if (y > .8) break;
			}
			if (kind === "boss") {
				x = 6;
				z = -8;
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
				hp: s.hp,
				max: s.hp,
				speed: s.speed,
				aggro: s.aggro,
				melee: s.melee,
				dmg: s.dmg,
				flee: !!s.flee,
				ranged: s.ranged,
				pos: new Vector3(x, y, z),
				vel: new Vector3(),
				yaw: this.rng() * 6,
				state: "wander",
				cd: 0,
				wanderT: 0,
				target: new Vector3(x, y, z),
				alive: true,
				radius: s.radius,
				provoked: false
			});
		}
	}
	makeCamps() {
		const plank = this.texMaps.planks;
		const mat = new MeshStandardMaterial({
			map: plank,
			roughness: .82
		});
		const barrelMat = new MeshStandardMaterial({
			map: this.texMaps.bark,
			color: 9069112,
			roughness: .7
		});
		const spots = [
			[48, -20],
			[-40, 30],
			[20, -50],
			[-22, -38],
			[55, 18]
		];
		const villageTex = this.spriteTex.village;
		const villageMat = villageTex ? new SpriteMaterial({
			map: villageTex,
			transparent: true,
			alphaTest: .3,
			depthWrite: true
		}) : null;
		for (const [x, z] of spots) {
			const y = Math.max(this.sample(x, z), .4);
			if (villageMat) {
				const spr = new Sprite(villageMat);
				spr.center.set(.5, 0);
				spr.scale.set(8.4, 4.8, 1);
				spr.position.set(x, y, z + .4);
				this.scene.add(spr);
			}
			const floor = new Mesh(new BoxGeometry(6, .28, 6), mat);
			floor.position.set(x, y + .14, z);
			this.scene.add(floor);
			this.builds.push({
				id: this.buildId++,
				type: "foundation",
				mesh: floor,
				pos: new Vector3(x, y, z),
				rot: 0,
				hx: 3,
				hz: 3
			});
			for (const [dx, dz, ry] of [
				[
					0,
					-3,
					0
				],
				[
					0,
					3,
					0
				],
				[
					-3,
					0,
					Math.PI / 2
				]
			]) {
				const w = new Mesh(new BoxGeometry(6, 2.35, .22), mat);
				w.position.set(x + dx, y + 1.28, z + dz);
				w.rotation.y = ry;
				this.scene.add(w);
				this.builds.push({
					id: this.buildId++,
					type: "wall",
					mesh: w,
					pos: new Vector3(x + dx, y, z + dz),
					rot: ry,
					hx: 3,
					hz: .2
				});
			}
			const barrel = new Mesh(new CylinderGeometry(.32, .35, .7, 10), barrelMat);
			barrel.position.set(x + 1.4, y + .5, z + 1.1);
			this.scene.add(barrel);
			this.builds.push({
				id: this.buildId++,
				type: "crate",
				mesh: barrel,
				pos: barrel.position.clone(),
				rot: 0,
				hx: .38,
				hz: .38
			});
		}
	}
	makeRain() {
		const n = 420;
		const g = new BufferGeometry();
		const arr = new Float32Array(n * 3);
		for (let i = 0; i < n; i++) {
			arr[i * 3] = (this.rng() - .5) * 70;
			arr[i * 3 + 1] = this.rng() * 28;
			arr[i * 3 + 2] = (this.rng() - .5) * 70;
		}
		g.setAttribute("position", new BufferAttribute(arr, 3));
		const m = new PointsMaterial({
			color: 11061472,
			size: .08,
			transparent: true,
			opacity: 0
		});
		this.rain = new Points(g, m);
		this.scene.add(this.rain);
	}
	findSpawn() {
		for (const [x, z] of [
			[0, 88],
			[6, 86],
			[-6, 86],
			[10, 84],
			[-10, 84],
			[0, 92],
			[14, 80],
			[-14, 80],
			[0, 78]
		]) {
			const y = this.sample(x, z);
			if (y < .32 || y > 3.4) continue;
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
			if (ok) return {
				x,
				y,
				z
			};
		}
		return {
			x: 0,
			y: Math.max(this.sample(0, 90), WATER_Y + .4),
			z: 90
		};
	}
	resetPlayer(giveItems) {
		const spawn = this.findSpawn();
		this.pos.set(spawn.x, spawn.y, spawn.z);
		this.vel.set(0, 0, 0);
		this.yaw = 0;
		this.pitch = .08;
		this.health = 100;
		this.hunger = 100;
		this.thirst = 100;
		this.stamina = 100;
		this.dead = false;
		this.time = .28;
		if (giveItems) useGameStore.getState().patch({ inventory: freshInventory(this.training) });
	}
	buildWeapon(id) {
		this.weapon.clear();
		const wood = new MeshStandardMaterial({
			color: 9134649,
			roughness: .8
		});
		const metal = new MeshStandardMaterial({
			color: 10134445,
			metalness: .6,
			roughness: .35
		});
		const dark = new MeshStandardMaterial({
			color: 546,
			roughness: .5
		});
		const skin = this.armMat;
		const arm = new Mesh(new BoxGeometry(.12, .12, .42), skin);
		arm.position.set(-.18, -.06, .12);
		this.weapon.add(arm);
		const arm2 = arm.clone();
		arm2.position.set(.08, -.08, .18);
		this.weapon.add(arm2);
		const add = (mesh, x, y, z) => {
			mesh.position.set(x, y, z);
			this.weapon.add(mesh);
		};
		if (id === "axe") {
			const h = new Mesh(new CylinderGeometry(.025, .03, .7, 6), wood);
			h.rotation.z = .5;
			add(h, .05, -.05, -.15);
			add(new Mesh(new BoxGeometry(.08, .22, .16), metal), .22, .22, -.38);
		} else if (id === "pickaxe") {
			const h = new Mesh(new CylinderGeometry(.025, .03, .7, 6), wood);
			h.rotation.z = .45;
			add(h, .05, -.05, -.15);
			add(new Mesh(new BoxGeometry(.28, .08, .08), metal), .22, .22, -.38);
		} else if (id === "hammer") {
			add(new Mesh(new CylinderGeometry(.03, .03, .55, 6), wood), .12, 0, -.2);
			add(new Mesh(new BoxGeometry(.16, .14, .1), metal), .12, .28, -.38);
		} else if (id === "knife") {
			add(new Mesh(new BoxGeometry(.04, .08, .18), wood), .16, -.04, -.22);
			add(new Mesh(new BoxGeometry(.02, .06, .28), metal), .16, -.02, -.42);
		} else if (id === "spear") {
			const h = new Mesh(new CylinderGeometry(.02, .025, 1.15, 6), wood);
			h.rotation.x = Math.PI / 2;
			add(h, .1, -.04, -.35);
			add(new Mesh(new ConeGeometry(.04, .16, 5), metal), .1, -.04, -.95);
		} else if (id === "bow") {
			const b = new Mesh(new TorusGeometry(.28, .018, 5, 10, Math.PI), wood);
			b.rotation.y = Math.PI / 2;
			add(b, .12, 0, -.35);
		} else if (id === "pistol") {
			add(new Mesh(new BoxGeometry(.08, .1, .28), dark), .14, -.02, -.32);
			add(new Mesh(new BoxGeometry(.07, .16, .08), dark), .14, -.12, -.18);
		} else if (id === "rifle") {
			add(new Mesh(new BoxGeometry(.08, .1, .72), dark), .12, -.02, -.45);
			add(new Mesh(new BoxGeometry(.06, .16, .08), wood), .12, -.12, -.12);
			add(new Mesh(new CylinderGeometry(.02, .02, .28, 6), metal), .12, 0, -.85);
		} else if (id === "grenade") add(new Mesh(new SphereGeometry(.08, 8, 6), new MeshStandardMaterial({ color: 3828274 })), .16, -.02, -.28);
	}
	held() {
		return hotItem(useGameStore.getState().inventory, useGameStore.getState().hotIndex);
	}
	resize = () => {
		const w = this.canvas.clientWidth || window.innerWidth;
		const h = this.canvas.clientHeight || window.innerHeight;
		this.renderer.setSize(w, h, false);
		this.cam.aspect = w / Math.max(1, h);
		this.cam.updateProjectionMatrix();
		this.wcam.aspect = this.cam.aspect;
		this.wcam.updateProjectionMatrix();
	};
	loop = (now) => {
		if (!this.running) return;
		let dt = (now - this.last) / 1e3;
		this.last = now;
		if (dt > .1) dt = .1;
		this.acc += dt;
		while (this.acc >= FIXED) {
			this.fixed(FIXED);
			this.acc -= FIXED;
		}
		this.draw(dt);
		this.fpsA += dt;
		this.fpsN++;
		if (this.fpsA >= .4) {
			this.fps = Math.round(this.fpsN / this.fpsA);
			this.fpsA = 0;
			this.fpsN = 0;
		}
	};
	pressed(code) {
		return (this.input.injected ?? this.input.keys).has(code) && !this.prevKeys.has(code);
	}
	fixed(dt) {
		if (useGameStore.getState().screen !== "playing" || this.dead) {
			this.prevKeys = new Set(this.input.injected ?? this.input.keys);
			return;
		}
		this.session += dt;
		this.handleUiKeys();
		const blocked = this.overlay !== "none";
		const act = this.input.sample();
		if (!blocked) this.simulate(dt, act);
		this.prevKeys = new Set(this.input.injected ?? this.input.keys);
		this.hudT += dt;
		if (this.hudT > .12) {
			this.hudT = 0;
			this.pushHud();
		}
		this.saveT += dt;
		if (this.saveT > 12) {
			this.saveT = 0;
			this.save();
		}
	}
	handleUiKeys() {
		if (this.pressed("Escape")) {
			if (this.overlay !== "none") this.setOverlay("none");
			else {
				const paused = useGameStore.getState().screen === "paused";
				useGameStore.getState().setScreen(paused ? "playing" : "paused");
				if (!paused && document.pointerLockElement) document.exitPointerLock();
			}
			return;
		}
		if (this.pressed("Tab") || this.pressed("KeyI")) this.setOverlay(this.overlay === "inventory" ? "none" : "inventory");
		if (this.pressed("KeyC")) this.setOverlay(this.overlay === "craft" ? "none" : "craft");
		if (this.pressed("KeyB")) this.setOverlay(this.overlay === "craft" ? "none" : "craft");
		if (this.pressed("KeyT")) this.setOverlay(this.overlay === "chat" ? "none" : "chat");
		if (this.pressed("KeyM")) this.setOverlay(this.overlay === "map" ? "none" : "map");
		for (let i = 1; i <= 8; i++) if (this.pressed(`Digit${i}`)) useGameStore.getState().patch({ hotIndex: i - 1 });
		const id = this.held()?.id ?? "fists";
		if (this.weapon.userData.id !== id) {
			this.weapon.userData.id = id;
			this.buildWeapon(id === "fists" ? "fists" : id);
		}
	}
	setOverlay(o) {
		this.overlay = o;
		useGameStore.getState().setOverlay(o);
		if (o !== "none" && document.pointerLockElement) document.exitPointerLock();
	}
	setNetName(name) {
		this.netName = name;
	}
	setAdmin(v) {
		this.isAdmin = v;
	}
	netSnapshot() {
		return {
			t: "p",
			x: this.pos.x,
			y: this.pos.y,
			z: this.pos.z,
			yaw: this.yaw,
			hp: this.health,
			name: this.netName
		};
	}
	giveItems(id, n) {
		const inv = useGameStore.getState().inventory.slice();
		addItem(inv, id, n);
		useGameStore.getState().patch({ inventory: inv });
		useGameStore.getState().toast(`+${n}`);
	}
	syncRemote(id, s) {
		let r = this.remotes.get(id);
		if (!r) {
			const mesh = this.playerPawn();
			mesh.add(this.makeNameTag(s.name || id));
			this.scene.add(mesh);
			r = {
				id,
				mesh,
				pos: new Vector3(s.x, s.y, s.z),
				yaw: s.yaw,
				name: s.name,
				hp: s.hp,
				radius: .45
			};
			this.remotes.set(id, r);
		}
		r.pos.set(s.x, s.y, s.z);
		r.yaw = s.yaw;
		r.hp = s.hp;
		r.mesh.position.lerp(r.pos, .45);
		r.mesh.position.y = s.y;
		r.mesh.rotation.y = s.yaw;
	}
	dropRemote(id) {
		const r = this.remotes.get(id);
		if (!r) return;
		this.scene.remove(r.mesh);
		this.remotes.delete(id);
	}
	keepRemotes(ids) {
		const set = new Set(ids);
		for (const id of [...this.remotes.keys()]) if (!set.has(id)) this.dropRemote(id);
	}
	makeNameTag(name) {
		const c = document.createElement("canvas");
		c.width = 256;
		c.height = 64;
		const ctx = c.getContext("2d");
		if (ctx) {
			ctx.fillStyle = "rgba(7,16,24,0.72)";
			ctx.fillRect(0, 0, 256, 64);
			ctx.fillStyle = "#e8e0d4";
			ctx.font = "700 28px Cairo, sans-serif";
			ctx.textAlign = "center";
			ctx.fillText(name.slice(0, 16), 128, 42);
		}
		const tex = new CanvasTexture(c);
		const spr = new Sprite(new SpriteMaterial({
			map: tex,
			transparent: true,
			depthTest: false
		}));
		spr.scale.set(1.5, .38, 1);
		spr.position.y = 2.15;
		return spr;
	}
	simulate(dt, act) {
		const sens = .0022;
		this.yaw -= act.lookX * sens;
		this.pitch -= act.lookY * sens;
		const lim = Math.PI / 2 - .02;
		if (this.pitch > lim) this.pitch = lim;
		if (this.pitch < -lim) this.pitch = -lim;
		this.fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
		this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
		const sprint = act.sprint && this.stamina > 4 && act.moveY > 0;
		const speed = sprint ? 7.4 : 4.35;
		if (sprint) this.stamina = Math.max(0, this.stamina - 18 * dt);
		else this.stamina = Math.min(100, this.stamina + 22 * dt);
		const wish = this.tmp.set(0, 0, 0);
		wish.addScaledVector(this.fwd, act.moveY);
		wish.addScaledVector(this.right, act.moveX);
		if (wish.lengthSq() > 1) wish.normalize();
		const h = this.sample(this.pos.x, this.pos.z);
		const inWater = h < WATER_Y - .05;
		const targetY = Math.max(h, inWater ? WATER_Y - .9 : h);
		if (this.pos.y <= targetY + .08) {
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
		const max = inWater ? speed * .55 : speed;
		const vx = wish.x * max;
		const vz = wish.z * max;
		this.vel.x += (vx - this.vel.x) * Math.min(1, accel * dt);
		this.vel.z += (vz - this.vel.z) * Math.min(1, accel * dt);
		const travel = Math.hypot(this.vel.x, this.vel.z, this.vel.y) * dt;
		const steps = Math.max(1, Math.min(6, Math.ceil(travel / .2)));
		const sdt = dt / steps;
		for (let s = 0; s < steps; s++) {
			const ox = this.pos.x;
			const oz = this.pos.z;
			this.pos.x += this.vel.x * sdt;
			this.pos.z += this.vel.z * sdt;
			this.pos.y += this.vel.y * sdt;
			this.collideProps();
			this.collideBuilds();
			this.collideMobs(.4);
			this.collideRemotes(.4);
			if (this.sample(this.pos.x, this.pos.z) > this.pos.y + .95) {
				this.pos.x = ox;
				this.pos.z = oz;
			}
		}
		const moving = Math.hypot(this.vel.x, this.vel.z);
		if (this.onGround && moving > 1.2) {
			this.bob += dt * (sprint ? 12 : 8);
			this.stepT += dt;
			if (this.stepT > (sprint ? .32 : .46)) {
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
		const night = this.time < .22 || this.time > .78;
		this.audio.setNight(night);
		if (!this.training) {
			this.hunger = Math.max(0, this.hunger - dt * .55);
			this.thirst = Math.max(0, this.thirst - dt * .72);
			if (this.raining) this.thirst = Math.min(100, this.thirst + dt * .35);
			if (this.hunger <= .1) this.damage(dt * 3.5, false);
			if (this.thirst <= .1) this.damage(dt * 4.2, false);
			if (this.hunger > 50 && this.thirst > 50 && this.health < 100) this.health = Math.min(100, this.health + dt * 2.2);
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
	collideProps() {
		const pr = .38;
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
	collideBuilds() {
		const pr = .4;
		for (const b of this.builds) {
			if (b.type === "door" && b.open) continue;
			const hx = b.hx ?? (b.type === "foundation" || b.type === "roof" ? .85 : .25);
			const hz = b.hz ?? (b.type === "wall" || b.type === "window" || b.type === "door" ? .2 : .85);
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
				const d = Math.max(.001, Math.hypot(ox, oz));
				const nx = ox / d;
				const nz = oz / d;
				const wx = nx * ca + nz * sa;
				const wz = -nx * sa + nz * ca;
				this.pos.x += wx * (pr - d);
				this.pos.z += wz * (pr - d);
			}
		}
	}
	collideMobs(pr) {
		for (const c of this.creatures) {
			if (!c.alive) continue;
			const dx = this.pos.x - c.pos.x;
			const dz = this.pos.z - c.pos.z;
			const rad = c.radius + pr;
			const d2 = dx * dx + dz * dz;
			if (d2 < rad * rad && d2 > 1e-6) {
				const d = Math.sqrt(d2);
				const k = (rad - d) / d;
				this.pos.x += dx * k * .65;
				this.pos.z += dz * k * .65;
				c.pos.x -= dx * k * .35;
				c.pos.z -= dz * k * .35;
			}
		}
	}
	collideRemotes(pr) {
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
	updateCreatures(dt) {
		const night = this.time < .22 || this.time > .78;
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
			} else if (c.flee && (c.provoked || dist < aggro)) c.state = "flee";
			else if (!c.flee && dist < aggro && (!wildlife || c.provoked)) c.state = dist < c.melee ? "attack" : "chase";
			else {
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
				c.cd = .9;
			}
			const len = Math.hypot(dirx, dirz) || 1;
			const sp = c.speed * (c.state === "wander" ? .45 : 1);
			c.pos.x += dirx / len * sp * dt;
			c.pos.z += dirz / len * sp * dt;
			this.solidAt(c.pos, c.radius, c);
			c.pos.y = this.sample(c.pos.x, c.pos.z);
			if (c.pos.y < .12) {
				c.pos.x -= dirx / len * sp * dt * 2;
				c.pos.z -= dirz / len * sp * dt * 2;
				this.solidAt(c.pos, c.radius, c);
				c.pos.y = this.sample(c.pos.x, c.pos.z);
			}
			c.yaw = Math.atan2(dirx, dirz);
			c.mesh.position.copy(c.pos);
			c.mesh.rotation.y = c.yaw;
		}
	}
	solidAt(p, r, skip) {
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
	creatureShoot(c) {
		const dir = this.tmp.copy(this.pos).add(this.tmp2.set(0, this.eye, 0)).sub(c.pos).normalize();
		this.spawnBullet(c.pos.x, c.pos.y + 1.1, c.pos.z, dir, 28, c.dmg, 0, true);
	}
	spawnBullet(x, y, z, dir, speed, dmg, splash, fromEnemy) {
		const mesh = new Mesh(new SphereGeometry(splash ? .1 : .04, 6, 6), new MeshBasicMaterial({ color: splash ? 3832370 : 16769184 }));
		mesh.position.set(x, y, z);
		mesh.userData.fromEnemy = fromEnemy;
		this.scene.add(mesh);
		this.bullets.push({
			mesh,
			vel: dir.clone().multiplyScalar(speed),
			life: splash ? 2.4 : 1.6,
			dmg,
			splash
		});
	}
	updateBullets(dt) {
		for (let i = this.bullets.length - 1; i >= 0; i--) {
			const b = this.bullets[i];
			b.life -= dt;
			if (b.splash) b.vel.y -= 14 * dt;
			b.mesh.position.x;
			b.mesh.position.y;
			b.mesh.position.z;
			b.mesh.position.addScaledVector(b.vel, dt);
			const h = this.sample(b.mesh.position.x, b.mesh.position.z);
			let hit = b.life <= 0 || b.mesh.position.y < h + .1;
			if (!b.mesh.userData.fromEnemy) for (const c of this.creatures) {
				if (!c.alive) continue;
				if (b.mesh.position.distanceTo(c.pos) < c.radius + .4) {
					this.hurtCreature(c, b.dmg);
					hit = true;
					break;
				}
			}
			else if (b.mesh.position.distanceTo(this.tmp.set(this.pos.x, this.pos.y + this.eye, this.pos.z)) < .7) {
				this.damage(b.dmg, true);
				hit = true;
			}
			if (hit) {
				if (b.splash) this.explode(b.mesh.position, b.dmg);
				this.scene.remove(b.mesh);
				b.mesh.geometry.dispose();
				b.mesh.material.dispose();
				this.bullets.splice(i, 1);
			}
		}
	}
	explode(p, dmg) {
		this.audio.explode();
		for (const c of this.creatures) {
			if (!c.alive) continue;
			const d = c.pos.distanceTo(p);
			if (d < 5) this.hurtCreature(c, dmg * (1 - d / 5));
		}
		if (this.pos.distanceTo(p) < 5) this.damage(dmg * (1 - this.pos.distanceTo(p) / 5), true);
	}
	hurtCreature(c, dmg) {
		c.hp -= dmg;
		c.provoked = true;
		c.state = c.flee ? "flee" : "chase";
		this.audio.hit();
		this.flash(c.mesh);
		if (c.hp <= 0) {
			c.alive = false;
			c.mesh.visible = false;
			this.kills++;
			this.score += c.kind === "boss" ? 250 : c.kind === "bear" ? 80 : 40;
			const drop = c.kind === "deer" || c.kind === "boar" || c.kind === "bear" ? "meat" : c.kind === "wolf" ? "fiber" : "cloth";
			this.spawnDrop(c.pos.x, c.pos.y + .4, c.pos.z, drop, 1 + (c.kind === "bear" ? 2 : 0));
			if (c.kind === "deer" || c.kind === "boar" || c.kind === "wolf" || c.kind === "bear" || c.kind === "goat") this.quest("hunt", 1);
			else this.quest("raid", 1);
		}
	}
	flash(obj) {
		obj.traverse((o) => {
			const spr = o;
			if (spr.isSprite) {
				const mat = spr.material;
				mat.color.setHex(16764040);
				setTimeout(() => mat.color.setHex(16777215), 90);
				return;
			}
			const mat = o.material;
			if (mat && mat.emissive) {
				mat.emissive.setHex(16755302);
				setTimeout(() => mat.emissive.setHex(0), 80);
			}
		});
	}
	damage(n, hitSound) {
		this.health = Math.max(0, this.health - n);
		this.hurtT = .35;
		if (hitSound) this.audio.hurt();
	}
	harvestAndUse(act, dt) {
		this.fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
		const look = this.tmp.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
		const origin = this.tmp2.set(this.pos.x, this.pos.y + this.eye, this.pos.z);
		this.ray.set(origin, look);
		this.ray.far = 4.2;
		let prompt = null;
		const copy = t();
		const slot = this.held();
		const def = slot ? ITEM[slot.id] : null;
		let nearestDrop = null;
		let nd = 2.2;
		for (const d of this.drops) {
			const dist = d.mesh.position.distanceTo(this.pos);
			if (dist < nd) {
				nd = dist;
				nearestDrop = d;
			}
		}
		if (nearestDrop) prompt = {
			label: `${copy.loot} ${copy.items[nearestDrop.id]}`,
			key: "E"
		};
		const aimHit = this.pickProp(origin, look, 3.4);
		if (!prompt && aimHit) prompt = {
			label: aimHit.rec.kind === "rock" ? copy.mine : aimHit.rec.kind === "tree" ? copy.chop : copy.loot,
			key: "E"
		};
		const lookingWater = this.sample(this.pos.x + look.x * 2, this.pos.z + look.z * 2) < .52 && this.pos.y < 1.6;
		if (!prompt && lookingWater && this.thirst < 95) prompt = {
			label: copy.drink,
			key: "E"
		};
		const placeId = def?.place;
		this.ghost.visible = false;
		let canPlace = false;
		let placePos = null;
		if (placeId) {
			const gy = this.sample(this.pos.x + this.fwd.x * 2.4, this.pos.z + this.fwd.z * 2.4);
			const gx = Math.round((this.pos.x + this.fwd.x * 2.4) / 1.5) * 1.5;
			const gz = Math.round((this.pos.z + this.fwd.z * 2.4) / 1.5) * 1.5;
			this.ghost.position.set(gx, gy + .2, gz);
			this.ghost.rotation.y = Math.round(this.yaw / (Math.PI / 2)) * (Math.PI / 2);
			this.ghost.visible = true;
			canPlace = gy > WATER_Y - .2;
			this.ghost.material.color.set(canPlace ? 7189869 : 12862780);
			placePos = this.ghost.position.clone();
		}
		useGameStore.getState().patch({
			prompt,
			aimOk: !!aimHit
		});
		if (act.interact) {
			if (nearestDrop) this.takeDrop(nearestDrop);
			else if (aimHit) this.hitProp(aimHit.rec, aimHit.i, def);
			else if (lookingWater) {
				this.thirst = Math.min(100, this.thirst + 28);
				this.audio.eat();
				const inv = useGameStore.getState().inventory.slice();
				if (this.rng() > .55) {
					addItem(inv, "fish", 1);
					useGameStore.getState().toast(`${copy.pickup} ${copy.items.fish}`);
				}
				useGameStore.getState().patch({
					inventory: inv,
					thirst: this.thirst
				});
			} else for (const b of this.builds) if (b.pos.distanceTo(this.pos) < 2.4 && (b.type === "door" || b.type === "furnace" || b.type === "campfire" || b.type === "crate")) {
				if (b.type === "door") {
					b.open = !b.open;
					b.mesh.rotation.y = b.rot + (b.open ? Math.PI / 2 : 0);
				} else this.setOverlay("craft");
			}
		}
		if (act.fire && this.fireCd <= 0 && this.overlay === "none") {
			if (placeId && canPlace && placePos && slot) {
				this.placeBuild(placeId, placePos, this.ghost.rotation.y);
				const inv = useGameStore.getState().inventory.slice();
				takeItem(inv, slot.id, 1);
				useGameStore.getState().patch({ inventory: inv });
				this.fireCd = .35;
				this.audio.place();
				this.quest("base", 1);
			} else if (def && (def.hunger || def.heal || def.thirst) && def.kind === "none") {
				this.consume(def.id);
				this.fireCd = .4;
			} else this.fireWeapon(def, origin, look);
		}
	}
	pickProp(origin, dir, maxd) {
		let best = null;
		for (const rec of this.inst) {
			const n = rec.mesh.count;
			for (let i = 0; i < n; i++) {
				if (!rec.alive[i]) continue;
				const y = this.sample(rec.x[i], rec.z[i]) + 1.2;
				const cx = rec.x[i] - origin.x;
				const cy = y - origin.y;
				const cz = rec.z[i] - origin.z;
				const t = cx * dir.x + cy * dir.y + cz * dir.z;
				if (t < .3 || t > maxd) continue;
				const px = origin.x + dir.x * t - rec.x[i];
				const py = origin.y + dir.y * t - y;
				const pz = origin.z + dir.z * t - rec.z[i];
				if (px * px + py * py * .4 + pz * pz < (rec.r[i] + .7) ** 2) {
					if (!best || t < best.d) best = {
						rec,
						i,
						d: t
					};
				}
			}
		}
		return best;
	}
	hitProp(rec, i, def) {
		if (!(rec.kind === "bush" || rec.kind === "tree" && def?.harvest === "tree" || rec.kind === "rock" && def?.harvest === "rock" || def?.kind === "melee" && rec.kind !== "rock")) {
			useGameStore.getState().toast(rec.kind === "rock" ? t().mine : t().chop);
			return;
		}
		const dmg = def?.damage ?? 8;
		rec.hp[i] -= dmg;
		this.swing = 1;
		this.fireCd = def?.cooldown ?? .5;
		if (rec.kind === "rock") this.audio.mine();
		else this.audio.chop();
		const drops = 1 + (this.rng() > .6 ? 1 : 0);
		this.spawnDrop(rec.x[i], this.sample(rec.x[i], rec.z[i]) + .6, rec.z[i], rec.drop[i], drops);
		if (rec.kind === "tree") this.quest("tree", 1);
		if (rec.hp[i] <= 0) {
			rec.alive[i] = 0;
			this.dummy.position.set(0, -20, 0);
			this.dummy.scale.setScalar(.001);
			this.dummy.updateMatrix();
			rec.mesh.setMatrixAt(i, this.dummy.matrix);
			rec.mesh.instanceMatrix.needsUpdate = true;
			if (rec.vis?.[i]) rec.vis[i].visible = false;
			if (rec.extra && rec.extra[i] && rec.extra[i] !== rec.drop[i]) this.spawnDrop(rec.x[i], this.sample(rec.x[i], rec.z[i]) + .5, rec.z[i], rec.extra[i], 1);
		}
	}
	fireWeapon(def, origin, look) {
		const kind = def?.kind ?? "melee";
		const dmg = def?.damage ?? 10;
		this.swing = 1;
		this.fireCd = def?.cooldown ?? .45;
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
			this.pitch += .018;
			this.hitscan(origin, look, dmg, def?.range ?? 60);
		} else if (kind === "throw") {
			const inv = useGameStore.getState().inventory.slice();
			if (def && !takeItem(inv, def.id, 1)) return;
			useGameStore.getState().patch({ inventory: inv });
			this.spawnBullet(origin.x, origin.y, origin.z, look, 16, dmg, 5, false);
			this.audio.swing();
		} else {
			this.audio.swing();
			this.hitscan(origin, look, dmg, def?.range ?? 2.4);
		}
	}
	hitscan(origin, dir, dmg, range) {
		let hitC = null;
		let best = range;
		for (const c of this.creatures) {
			if (!c.alive) continue;
			const t = this.tmp.copy(c.pos).add(this.tmp2.set(0, .8, 0)).sub(origin).dot(dir);
			if (t < 0 || t > best) continue;
			if (origin.clone().addScaledVector(dir, t).distanceTo(c.pos.clone().setY(c.pos.y + .8)) < c.radius + .35) {
				best = t;
				hitC = c;
			}
		}
		if (hitC) this.hurtCreature(hitC, dmg);
		const geo = new BufferGeometry().setFromPoints([origin.clone(), origin.clone().addScaledVector(dir, Math.min(best, 28))]);
		const line = new Line(geo, new LineBasicMaterial({
			color: 16769192,
			transparent: true,
			opacity: .7
		}));
		this.scene.add(line);
		this.tracers.push({
			mesh: line,
			t: .08
		});
	}
	useConsumable(id) {
		this.consume(id);
	}
	consume(id) {
		const def = ITEM[id];
		const inv = useGameStore.getState().inventory.slice();
		if (!takeItem(inv, id, 1)) return;
		if (def.hunger) this.hunger = Math.min(100, this.hunger + def.hunger);
		if (def.thirst) this.thirst = Math.min(100, this.thirst + def.thirst);
		if (def.heal) this.health = Math.min(100, this.health + def.heal);
		useGameStore.getState().patch({ inventory: inv });
		this.audio.eat();
	}
	placeBuild(type, pos, rot) {
		const maps = this.texMaps;
		const mat = new MeshStandardMaterial({
			map: type === "furnace" ? maps.rock : maps.planks,
			roughness: .86
		});
		let geo = new BoxGeometry(1.5, .35, 1.5);
		let oy = .18;
		if (type === "wall" || type === "window") {
			geo = new BoxGeometry(1.5, 1.8, .18);
			oy = 1.05;
		}
		if (type === "door") {
			geo = new BoxGeometry(1.2, 1.8, .14);
			oy = 1.05;
		}
		if (type === "roof") {
			geo = new BoxGeometry(1.6, .16, 1.6);
			oy = 2;
		}
		if (type === "stairs") {
			geo = new BoxGeometry(1.5, .7, 1.5);
			oy = .4;
		}
		if (type === "crate") {
			geo = new BoxGeometry(.9, .9, .9);
			oy = .5;
		}
		if (type === "furnace") {
			geo = new BoxGeometry(1, 1.2, 1);
			oy = .65;
		}
		if (type === "campfire") {
			geo = new CylinderGeometry(.55, .7, .35, 8);
			oy = .2;
		}
		if (type === "plant") {
			geo = new ConeGeometry(.35, .9, 6);
			oy = .5;
		}
		const mesh = new Mesh(geo, mat);
		mesh.position.set(pos.x, pos.y + oy, pos.z);
		mesh.rotation.y = rot;
		this.scene.add(mesh);
		this.builds.push({
			id: this.buildId++,
			type,
			mesh,
			pos: mesh.position.clone(),
			rot
		});
	}
	spawnDrop(x, y, z, id, n) {
		const mesh = new Mesh(new BoxGeometry(.28, .28, .28), new MeshStandardMaterial({
			color: 13940074,
			roughness: .5
		}));
		mesh.position.set(x + (this.rng() - .5), y, z + (this.rng() - .5));
		this.scene.add(mesh);
		this.drops.push({
			mesh,
			id,
			n,
			life: 90
		});
	}
	takeDrop(d) {
		const inv = useGameStore.getState().inventory.slice();
		addItem(inv, d.id, d.n);
		this.gathered[d.id] = (this.gathered[d.id] ?? 0) + d.n;
		if (d.id === "wood") this.quest("wood", d.n);
		useGameStore.getState().patch({ inventory: inv });
		useGameStore.getState().toast(`${t().pickup} ${t().items[d.id]} ×${d.n}`);
		this.audio.pickup();
		this.scene.remove(d.mesh);
		d.mesh.geometry.dispose();
		d.mesh.material.dispose();
		this.drops = this.drops.filter((x) => x !== d);
	}
	updateDrops(dt) {
		for (let i = this.drops.length - 1; i >= 0; i--) {
			const d = this.drops[i];
			d.life -= dt;
			d.mesh.rotation.y += dt * 2;
			d.mesh.position.y += Math.sin(this.session * 3 + i) * dt * .15;
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
				this.tracers[i].mesh.material.dispose();
				this.tracers.splice(i, 1);
			}
		}
	}
	updateStations() {
		this.nearStation = "hand";
		for (const b of this.builds) {
			if (b.pos.distanceTo(this.pos) > 3.2) continue;
			if (b.type === "campfire") this.nearStation = "fire";
			if (b.type === "furnace") this.nearStation = "furnace";
		}
	}
	quest(id, n) {
		this.quests[id] = Math.min(99, this.quests[id] + n);
	}
	craft(recipeId) {
		const r = RECIPES.find((x) => x.id === recipeId);
		if (!r) return false;
		if (r.station !== "hand" && r.station !== this.nearStation) return false;
		const inv = useGameStore.getState().inventory.slice();
		for (const [k, n] of Object.entries(r.cost)) if (countItem(inv, k) < (n ?? 0)) return false;
		for (const [k, n] of Object.entries(r.cost)) takeItem(inv, k, n ?? 0);
		addItem(inv, r.out, r.count);
		if (r.out === "axe") this.quest("axe", 1);
		useGameStore.getState().patch({ inventory: inv });
		this.audio.craft();
		useGameStore.getState().toast(`${t().make} ${t().items[r.out]}`);
		return true;
	}
	useHot(i) {
		useGameStore.getState().patch({ hotIndex: i });
	}
	respawn() {
		this.resetPlayer(false);
		this.dead = false;
		this.health = 70;
		useGameStore.getState().setScreen("playing");
	}
	draw(dt) {
		const bobY = this.onGround ? Math.sin(this.bob) * .045 : 0;
		this.cam.position.set(this.pos.x, this.pos.y + this.eye + bobY, this.pos.z);
		this.cam.rotation.order = "YXZ";
		this.cam.rotation.y = this.yaw;
		this.cam.rotation.x = this.pitch;
		if (this.hurtT > 0) {
			this.cam.position.x += (this.rng() - .5) * .04;
			this.cam.position.y += (this.rng() - .5) * .03;
		}
		const ang = (this.time - .25) * Math.PI * 2;
		const sunDir = this.tmp.set(Math.cos(ang), Math.sin(ang), .25).normalize();
		this.sun.position.copy(this.cam.position).addScaledVector(sunDir, 80);
		this.sun.target.position.copy(this.cam.position);
		const day = Math.max(0, sunDir.y);
		const dusk = Math.max(0, 1 - Math.abs(sunDir.y) * 2);
		sunDir.y;
		const sky = new Color().setRGB(MathUtils.lerp(.05, .53, day) + dusk * .25, MathUtils.lerp(.07, .7, day) + dusk * .1, MathUtils.lerp(.12, .83, day));
		if (this.raining) sky.multiplyScalar(.72);
		this.renderer.setClearColor(sky);
		this.scene.fog.color.copy(sky);
		this.hemi.intensity = .35 + day * .7;
		this.sun.intensity = .15 + day * 1.4;
		this.sun.color.setRGB(1, .88 + dusk * .08, .7 + day * .2);
		this.terrainMat.uniforms.sunDir.value.copy(sunDir);
		this.terrainMat.uniforms.sunCol.value.set(this.sun.color);
		this.terrainMat.uniforms.ambient.value.set(sky.clone().multiplyScalar(.45));
		const wmat = this.water.material;
		if (wmat.map) {
			wmat.map.offset.x += dt * .02;
			wmat.map.offset.y += dt * .013;
		}
		const rp = this.rain.geometry.attributes.position;
		const rainMat = this.rain.material;
		rainMat.opacity = this.raining ? .55 : 0;
		if (this.raining) {
			for (let i = 0; i < rp.count; i++) {
				let y = rp.getY(i) - dt * 22;
				if (y < 0) y = 22;
				rp.setXYZ(i, this.cam.position.x + i * 17 % 70 - 35, y, this.cam.position.z + i * 29 % 70 - 35);
			}
			rp.needsUpdate = true;
		}
		this.weapon.rotation.x = -this.swing * .7;
		this.weapon.position.y = -.28 - this.swing * .08;
		this.weapon.position.x = .32 + Math.sin(this.bob) * .02;
		this.renderer.clear();
		this.renderer.render(this.scene, this.cam);
		this.renderer.clearDepth();
		this.wcam.rotation.copy(this.cam.rotation);
		this.renderer.render(this.wscene, this.wcam);
		this.mapT += dt;
		if (this.mapT > .85) {
			this.mapT = 0;
			this.paintMinimap();
		}
	}
	paintMinimap() {
		const ctx = this.mapCanvas.getContext("2d");
		if (!ctx) return;
		const w = 160;
		ctx.fillStyle = "#0b3040";
		ctx.fillRect(0, 0, w, w);
		const scale = 1.6;
		for (let y = 0; y < w; y += 3) for (let x = 0; x < w; x += 3) {
			const wx = this.pos.x + (x - 80) * scale;
			const wz = this.pos.z + (y - 80) * scale;
			const h = this.sample(wx, wz);
			if (h < .12) ctx.fillStyle = "#1b6a88";
			else if (h < 1.4) ctx.fillStyle = "#c4b07a";
			else if (h < 7) ctx.fillStyle = "#2f6a38";
			else ctx.fillStyle = "#8a8680";
			ctx.fillRect(x, y, 3, 3);
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
		useGameStore.getState().patch({ minimap: this.mapCanvas.toDataURL("image/jpeg", .55) });
	}
	pushHud() {
		const craftedAxe = useGameStore.getState().inventory.some((s) => s?.id === "axe") ? Math.max(this.quests.axe, 1) : this.quests.axe;
		useGameStore.getState().patch({
			health: this.health,
			hunger: this.hunger,
			thirst: this.thirst,
			stamina: this.stamina,
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
			quests: {
				...this.quests,
				axe: craftedAxe,
				wood: this.gathered.wood ?? this.quests.wood
			}
		});
	}
	wireControlsTest() {
		window.__controlsTest = {
			getYaw: () => this.yaw,
			getSpeed: () => Math.hypot(this.vel.x, this.vel.z),
			setKeys: (codes) => this.input.setKeys(codes),
			getPosition: () => ({
				x: this.pos.x,
				y: this.pos.y,
				z: this.pos.z
			})
		};
	}
	save() {
		const st = useGameStore.getState();
		const data = {
			v: 1,
			pos: [
				this.pos.x,
				this.pos.y,
				this.pos.z
			],
			yaw: this.yaw,
			pitch: this.pitch,
			health: this.health,
			hunger: this.hunger,
			thirst: this.thirst,
			stamina: this.stamina,
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
				x: b.mesh.position.x,
				y: b.mesh.position.y,
				z: b.mesh.position.z,
				rot: b.rot
			}))
		};
		try {
			localStorage.setItem(SAVE, JSON.stringify(data));
			useGameStore.getState().patch({ hasSave: true });
		} catch {}
	}
	loadSave() {
		try {
			const raw = localStorage.getItem(SAVE);
			if (!raw) return false;
			const d = JSON.parse(raw);
			this.pos.set(d.pos[0], d.pos[1], d.pos[2]);
			this.yaw = d.yaw;
			this.pitch = d.pitch;
			this.health = d.health;
			this.hunger = d.hunger;
			this.thirst = d.thirst;
			this.stamina = d.stamina;
			this.time = d.time;
			this.kills = d.kills;
			this.score = d.score;
			this.quests = d.quests;
			this.gathered = d.gathered ?? {};
			this.session = d.session;
			this.training = d.training;
			this.outfit = d.outfit;
			useGameStore.getState().patch({
				inventory: d.inventory,
				outfit: d.outfit,
				training: d.training
			});
			for (const b of d.builds ?? []) this.placeBuild(b.type, new Vector3(b.x, b.y - .18, b.z), b.rot);
			return true;
		} catch {
			return false;
		}
	}
};
function hasSave() {
	try {
		return !!localStorage.getItem(SAVE);
	} catch {
		return false;
	}
}
var subscribeToNothing = () => () => {};
var noGateSessionOnServer = () => false;
/**
* Minimal signed-in identity chip + sign-out. Restyle freely (see the
* `design-ui` skill). Sign-out is only shown when auth is enabled (the
* disabled-auth dev user has nothing to sign out of) and the session is not
* gate-materialized — behind the gate the next request signs the viewer
* straight back in, so a sign-out control there is a broken loop.
*/
function UserButton() {
	const user = useCurrentUser();
	const [signingOut, setSigningOut] = (0, import_react.useState)(false);
	const gateSession = (0, import_react.useSyncExternalStore)(subscribeToNothing, hasGateSessionMarker, noGateSessionOnServer);
	if (!user) return null;
	const label = user.displayName ?? user.primaryEmail ?? "Account";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [
			user.profileImageUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: user.profileImageUrl,
				alt: "",
				className: "h-8 w-8 rounded-full object-cover"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "grid h-8 w-8 place-items-center rounded-full bg-black/10 text-sm font-medium dark:bg-white/20",
				children: label.charAt(0).toUpperCase()
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-sm font-medium",
				children: label
			}),
			!gateSession && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: signingOut,
				onClick: () => {
					setSigningOut(true);
					signOut().catch(() => setSigningOut(false));
				},
				className: "cursor-pointer text-sm underline-offset-4 opacity-70 hover:underline disabled:cursor-wait disabled:no-underline",
				children: signingOut ? "Signing out…" : "Sign out"
			})
		]
	});
}
var FAST_POLL_MS = 400;
var IDLE_POLL_MS = 2e3;
var PING_INTERVAL_MS = 2e3;
var STALL_MS = 1e4;
var MAX_RECOVERY_ATTEMPTS = 3;
var SIGNAL_RETRY_DELAYS_MS = [250, 750];
function defaultIceServers() {
	return [{ urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];
}
var P2PRoom = class {
	opts;
	peers = /* @__PURE__ */ new Map();
	/** Per-remote-peer signal delivery chains (order-preserving). */
	signalQueues = /* @__PURE__ */ new Map();
	cursor = 0;
	pollTimer = null;
	pingTimer = null;
	closed = false;
	everPolled = false;
	lastPeersFingerprint = "";
	constructor(opts) {
		this.opts = opts;
	}
	/**
	* The first poll IS the join: it registers this peer and returns the
	* roster. A failed first poll (cold DB, offline tab) must not strand the
	* room: the loop and timers start regardless and the next poll retries.
	*/
	async join() {
		try {
			await this.pollOnce();
		} catch {}
		if (this.closed) return;
		this.schedulePoll(this.anyPairConnecting() ? FAST_POLL_MS : IDLE_POLL_MS);
		this.pingTimer = setInterval(() => {
			this.pingAll();
			this.watchdog();
		}, PING_INTERVAL_MS);
	}
	close() {
		this.closed = true;
		if (this.pollTimer) clearTimeout(this.pollTimer);
		if (this.pingTimer) clearInterval(this.pingTimer);
		for (const slot of this.peers.values()) slot.pc.close();
		this.peers.clear();
		fetch("/api/rtc", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				op: "leave",
				room: this.opts.room,
				peer: this.opts.selfId
			}),
			keepalive: true
		}).catch(() => {});
	}
	/** Send on the unreliable game-state channel (drops stale packets). */
	broadcast(data) {
		const wire = JSON.stringify({
			t: "d",
			d: data
		});
		for (const slot of this.peers.values()) if (slot.state?.readyState === "open") slot.state.send(wire);
	}
	/** Send reliably (ordered) to one peer, or to all when peerId is omitted. */
	send(data, peerId) {
		const wire = JSON.stringify({
			t: "d",
			d: data
		});
		const targets = peerId ? [this.peers.get(peerId)] : [...this.peers.values()];
		for (const slot of targets) if (slot?.reliable?.readyState === "open") slot.reliable.send(wire);
	}
	peerList() {
		return [...this.peers.values()].map((s) => ({ ...s.info }));
	}
	schedulePoll(delay) {
		if (this.closed) return;
		if (this.pollTimer) clearTimeout(this.pollTimer);
		this.pollTimer = setTimeout(() => void this.poll(), delay);
	}
	anyPairConnecting() {
		for (const s of this.peers.values()) {
			if (s.terminal) continue;
			if (s.info.connectionState !== "connected") return true;
		}
		return false;
	}
	async pollOnce() {
		const params = new URLSearchParams({
			room: this.opts.room,
			peer: this.opts.selfId,
			name: this.opts.name ?? "",
			since: String(this.cursor)
		});
		const res = await fetch(`/api/rtc?${params}`);
		if (this.closed) return;
		if (!res.ok) throw new Error(`signaling poll failed: ${res.status}`);
		const body = await res.json();
		if (this.closed) return;
		if (!this.everPolled) {
			this.everPolled = true;
			this.opts.onConnected?.();
		}
		this.reconcileRoster(body.peers);
		const roster = new Set(body.peers.map((p) => p.id));
		for (const sig of body.signals) {
			this.cursor = Math.max(this.cursor, sig.id);
			await this.onSignal(sig.from, sig.kind, sig.payload, roster);
			if (this.closed) return;
		}
	}
	async poll() {
		if (this.closed) return;
		try {
			await this.pollOnce();
		} catch {}
		this.schedulePoll(this.anyPairConnecting() ? FAST_POLL_MS : IDLE_POLL_MS);
	}
	reconcileRoster(peers) {
		const alive = new Set(peers.map((p) => p.id));
		for (const p of peers) {
			if (p.id === this.opts.selfId) continue;
			const existing = this.peers.get(p.id);
			if (existing) existing.info.name = p.name;
			else this.connectTo(p.id, p.name, this.opts.selfId > p.id);
		}
		for (const [id, slot] of this.peers) if (!alive.has(id)) {
			slot.pc.close();
			this.peers.delete(id);
		}
		this.emitPeers();
	}
	connectTo(peerId, name, initiator) {
		if (this.closed) return null;
		const pc = new RTCPeerConnection({ iceServers: this.opts.iceServers ?? defaultIceServers() });
		const slot = {
			pc,
			makingOffer: false,
			ignoreOffer: false,
			pendingCandidates: [],
			lastProgressAt: Date.now(),
			recoveryAttempts: 0,
			info: {
				id: peerId,
				name,
				connectionState: pc.connectionState,
				candidateType: null,
				rttMs: null
			}
		};
		this.peers.set(peerId, slot);
		pc.onicecandidate = (e) => {
			if (e.candidate) this.sendSignal(peerId, "ice", e.candidate.toJSON());
		};
		pc.onconnectionstatechange = () => {
			slot.info.connectionState = pc.connectionState;
			if (pc.connectionState === "connecting" || pc.connectionState === "connected") slot.lastProgressAt = Date.now();
			if (pc.connectionState === "connected") {
				slot.recoveryAttempts = 0;
				slot.terminal = false;
				this.readCandidateType(slot);
			}
			this.emitPeers();
			if (pc.connectionState === "failed") pc.restartIce();
			if (pc.connectionState === "failed" || pc.connectionState === "disconnected") this.schedulePoll(FAST_POLL_MS);
		};
		pc.onnegotiationneeded = async () => {
			try {
				slot.makingOffer = true;
				await pc.setLocalDescription();
				await this.sendSignal(peerId, "offer", pc.localDescription.toJSON());
			} catch {} finally {
				slot.makingOffer = false;
			}
		};
		pc.ondatachannel = (e) => this.attachChannel(slot, e.channel);
		if (initiator) {
			this.attachChannel(slot, pc.createDataChannel("state", {
				ordered: false,
				maxRetransmits: 0
			}));
			this.attachChannel(slot, pc.createDataChannel("reliable", { ordered: true }));
		}
		return slot;
	}
	attachChannel(slot, channel) {
		if (channel.label === "state") slot.state = channel;
		else slot.reliable = channel;
		channel.onopen = () => {
			slot.lastProgressAt = Date.now();
		};
		channel.onmessage = (e) => {
			let msg;
			try {
				msg = JSON.parse(e.data);
			} catch {
				return;
			}
			if (msg.t === "ping") {
				if (slot.state?.readyState === "open") slot.state.send(JSON.stringify({ t: "pong" }));
			} else if (msg.t === "pong") {
				if (slot.pingSentAt) {
					slot.info.rttMs = Math.round(performance.now() - slot.pingSentAt);
					slot.pingSentAt = void 0;
					this.emitPeers();
				}
			} else this.opts.onMessage?.(slot.info.id, msg.d, channel.label === "state" ? "state" : "reliable");
		};
	}
	/** Apply buffered ICE candidates once a remote description is in place. */
	async flushPendingCandidates(slot) {
		while (slot.pendingCandidates.length > 0) {
			const candidate = slot.pendingCandidates.shift();
			try {
				await slot.pc.addIceCandidate(candidate);
			} catch (err) {
				if (!slot.ignoreOffer) console.warn("[p2p] addIceCandidate failed:", err);
			}
			if (this.closed) return;
		}
	}
	async onSignal(from, kind, payload, roster) {
		if (this.closed) return;
		let slot = this.peers.get(from);
		if (!slot) {
			if (!roster.has(from)) return;
			const created = this.connectTo(from, "", false);
			if (!created) return;
			slot = created;
		}
		const polite = this.opts.selfId < from;
		try {
			if (kind === "offer" || kind === "answer") {
				const description = payload;
				const collision = kind === "offer" && (slot.makingOffer || slot.pc.signalingState !== "stable");
				slot.ignoreOffer = !polite && collision;
				if (slot.ignoreOffer) return;
				try {
					await slot.pc.setRemoteDescription(description);
				} catch (err) {
					if (kind !== "offer" || slot.recreatedForOffer) throw err;
					const attempts = slot.recoveryAttempts;
					const name = slot.info.name;
					slot.pc.close();
					this.peers.delete(from);
					const fresh = this.connectTo(from, name, false);
					if (!fresh) return;
					fresh.recoveryAttempts = attempts;
					fresh.recreatedForOffer = true;
					slot = fresh;
					await slot.pc.setRemoteDescription(description);
				}
				if (this.closed) return;
				await this.flushPendingCandidates(slot);
				if (this.closed) return;
				if (kind === "offer") {
					await slot.pc.setLocalDescription();
					if (this.closed) return;
					await this.sendSignal(from, "answer", slot.pc.localDescription.toJSON());
				}
			} else if (kind === "ice") {
				const candidate = payload;
				if (!slot.pc.remoteDescription) {
					slot.pendingCandidates.push(candidate);
					return;
				}
				try {
					await slot.pc.addIceCandidate(candidate);
				} catch (err) {
					if (!slot.ignoreOffer) console.warn("[p2p] addIceCandidate failed:", err);
				}
			}
		} catch {}
	}
	/**
	* Signals are serialized per remote peer (a candidate must never overtake
	* its SDP into the DB) and retried on failure with short backoff.
	*/
	sendSignal(to, kind, payload) {
		const next = (this.signalQueues.get(to) ?? Promise.resolve()).then(() => this.postSignal(to, kind, payload));
		this.signalQueues.set(to, next.catch(() => {}));
		return next;
	}
	async postSignal(to, kind, payload) {
		for (let attempt = 0;; attempt++) {
			if (this.closed) return;
			try {
				const res = await fetch("/api/rtc", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						op: "signal",
						room: this.opts.room,
						from: this.opts.selfId,
						to,
						kind,
						payload
					})
				});
				if (res.ok) return;
				throw new Error(`signal POST failed: ${res.status}`);
			} catch (err) {
				if (attempt >= SIGNAL_RETRY_DELAYS_MS.length) {
					console.warn(`[p2p] signal ${kind} to ${to} failed after retries`, err);
					return;
				}
				await new Promise((r) => setTimeout(r, SIGNAL_RETRY_DELAYS_MS[attempt]));
			}
		}
	}
	pingAll() {
		const wire = JSON.stringify({ t: "ping" });
		for (const slot of this.peers.values()) {
			if (slot.state?.readyState !== "open") continue;
			const stale = slot.pingSentAt !== void 0 && performance.now() - slot.pingSentAt > 2 * PING_INTERVAL_MS;
			if (slot.pingSentAt === void 0 || stale) {
				slot.pingSentAt = performance.now();
				slot.state.send(wire);
			}
		}
	}
	/**
	* Stuck-pair recovery, piggybacked on the ping interval. A pair that has
	* made no progress for STALL_MS gets rebuilt by the dialer with a FRESH
	* RTCPeerConnection (new DTLS identity — fixes the suspend/resume
	* fingerprint wedge). After MAX_RECOVERY_ATTEMPTS the pair is terminal:
	* visible to the app as its last connectionState, ignored by fast-poll.
	*/
	watchdog() {
		if (this.closed) return;
		const now = Date.now();
		for (const [peerId, slot] of this.peers) {
			const live = slot.pc.connectionState;
			if (live !== slot.info.connectionState) {
				slot.info.connectionState = live;
				if (live === "connecting" || live === "connected") slot.lastProgressAt = now;
				this.emitPeers();
			}
			if (slot.terminal || live === "connected") continue;
			if (now - slot.lastProgressAt <= STALL_MS) continue;
			if (slot.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
				slot.terminal = true;
				this.emitPeers();
				continue;
			}
			slot.recoveryAttempts += 1;
			slot.lastProgressAt = now;
			if (this.opts.selfId > peerId) {
				const { name } = slot.info;
				const attempts = slot.recoveryAttempts;
				slot.pc.close();
				this.peers.delete(peerId);
				const fresh = this.connectTo(peerId, name, true);
				if (fresh) fresh.recoveryAttempts = attempts;
				this.schedulePoll(FAST_POLL_MS);
			}
		}
	}
	async readCandidateType(slot) {
		try {
			const stats = await slot.pc.getStats();
			let selected;
			stats.forEach((s) => {
				if (s.type === "candidate-pair" && s.nominated) selected = s;
			});
			const localId = selected?.localCandidateId;
			if (localId) {
				const local = stats.get(localId);
				slot.info.candidateType = local?.candidateType ?? null;
				this.emitPeers();
			}
		} catch {}
	}
	emitPeers() {
		const list = this.peerList();
		const fingerprint = JSON.stringify(list.map((p) => [
			p.id,
			p.name,
			p.connectionState,
			p.candidateType,
			p.rttMs
		]));
		if (fingerprint === this.lastPeersFingerprint) return;
		this.lastPeersFingerprint = fingerprint;
		this.opts.onPeersChanged?.(list);
	}
};
/**
* React binding for P2PRoom. Identity and room id are captured once on mount
* (useState initializers) so re-renders never tear down the mesh: the P2PRoom
* instance lives exactly as long as the component that mounted it, and
* changing `room`/`name` requires a remount (key the component on them).
*/
function defaultRoom() {
	if (typeof window === "undefined") return "room-ssr";
	return `room-${window.location.hostname.split(".")[0]}`.slice(0, 64);
}
function useP2PRoom(options = {}) {
	const [selfId] = (0, import_react.useState)(() => `p-${Math.random().toString(36).slice(2, 10)}`);
	const [room] = (0, import_react.useState)(() => options.room ?? defaultRoom());
	const [name] = (0, import_react.useState)(() => options.name ?? selfId);
	const [peers, setPeers] = (0, import_react.useState)([]);
	const [joined, setJoined] = (0, import_react.useState)(false);
	const roomRef = (0, import_react.useRef)(null);
	const listeners = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	(0, import_react.useEffect)(() => {
		const p2p = new P2PRoom({
			room,
			selfId,
			name,
			onPeersChanged: setPeers,
			onMessage: (from, data, channel) => {
				for (const fn of listeners.current) fn(from, data, channel);
			},
			onConnected: () => setJoined(true)
		});
		roomRef.current = p2p;
		p2p.join();
		return () => {
			roomRef.current = null;
			p2p.close();
		};
	}, [
		room,
		selfId,
		name
	]);
	return {
		selfId,
		room,
		peers,
		joined,
		broadcast: (0, import_react.useCallback)((data) => roomRef.current?.broadcast(data), []),
		send: (0, import_react.useCallback)((data, peerId) => roomRef.current?.send(data, peerId), []),
		onMessage: (0, import_react.useCallback)((fn) => {
			listeners.current.add(fn);
			return () => {
				listeners.current.delete(fn);
			};
		}, [])
	};
}
function OnlineSession({ engine, username, isAdmin }) {
	const p2p = useP2PRoom({
		room: "island",
		name: username
	});
	const lang = useGameStore((s) => s.lang);
	const overlay = useGameStore((s) => s.overlay);
	const copy = COPY[lang];
	const [chat, setChat] = (0, import_react.useState)([]);
	const [draft, setDraft] = (0, import_react.useState)("");
	const [live, setLive] = (0, import_react.useState)([]);
	const inputRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		engine.current?.setNetName(username);
		engine.current?.setAdmin(isAdmin);
	}, [
		engine,
		username,
		isAdmin
	]);
	(0, import_react.useEffect)(() => {
		listChat().then(setChat).catch(() => setChat([]));
	}, []);
	(0, import_react.useEffect)(() => p2p.onMessage((from, data) => {
		if (!data || typeof data !== "object") return;
		const msg = data;
		if (msg.t === "p" && typeof msg.x === "number") engine.current?.syncRemote(from, {
			x: msg.x,
			y: msg.y ?? 0,
			z: msg.z ?? 0,
			yaw: msg.yaw ?? 0,
			hp: msg.hp ?? 100,
			name: String(msg.name ?? from)
		});
		if (msg.t === "chat" && typeof msg.body === "string") setLive((rows) => [...rows.slice(-30), {
			from: String(msg.from ?? from),
			body: msg.body
		}]);
	}), [p2p.onMessage, engine]);
	(0, import_react.useEffect)(() => {
		engine.current?.keepRemotes(p2p.peers.map((p) => p.id));
	}, [p2p.peers, engine]);
	(0, import_react.useEffect)(() => {
		let raf = 0;
		let last = 0;
		const loop = (now) => {
			if (now - last >= 70) {
				const snap = engine.current?.netSnapshot();
				if (snap) p2p.broadcast(snap);
				last = now;
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	}, [p2p.broadcast, engine]);
	(0, import_react.useEffect)(() => {
		if (overlay === "chat") inputRef.current?.focus();
	}, [overlay]);
	async function onSend(e) {
		e.preventDefault();
		const text = draft.trim();
		if (!text) return;
		setDraft("");
		try {
			const res = await sendChat({ data: text });
			if (res.kind === "give" && engine.current) {
				engine.current.giveItems(res.item, res.count);
				useGameStore.getState().toast(res.message);
			} else if (res.kind === "admin") {
				if (res.username.toLowerCase() === username.toLowerCase()) engine.current?.setAdmin(true);
				useGameStore.getState().toast(res.message);
			} else if (res.kind === "help" || res.kind === "error") useGameStore.getState().toast(res.message);
			else {
				p2p.send({
					t: "chat",
					from: username,
					body: text
				});
				setLive((rows) => [...rows.slice(-30), {
					from: username,
					body: text
				}]);
				const latest = await listChat();
				setChat(latest);
			}
		} catch {
			useGameStore.getState().toast(lang === "ar" ? "تعذر إرسال الرسالة" : "Could not send");
		}
	}
	const lines = [...chat.map((c) => ({
		from: c.username,
		body: c.body,
		key: `d${c.id}`
	})), ...live.map((c, i) => ({
		from: c.from,
		body: c.body,
		key: `l${i}-${c.body}`
	}))].slice(-24);
	const connected = p2p.peers.filter((p) => p.connectionState === "connected").length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "pointer-events-none absolute bottom-20 left-3 z-20 max-w-56 sm:left-5",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-xl border border-line bg-panel/80 px-3 py-2 text-[11px] backdrop-blur-sm",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "flex items-center gap-1 font-semibold text-amber",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "size-3" }),
						" ",
						copy.online,
						" · ",
						connected + 1
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "truncate text-foam",
					children: [username, isAdmin ? ` · ${copy.adminBadge}` : ""]
				}),
				p2p.peers.slice(0, 6).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "truncate text-muted",
					children: [
						p.name || p.id,
						" ",
						p.connectionState === "connected" ? "" : "…"
					]
				}, p.id))
			]
		})
	}), overlay === "chat" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "absolute inset-x-0 bottom-0 z-30 flex justify-center p-3 sm:p-5",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			onSubmit: onSend,
			className: "flex w-full max-w-xl flex-col gap-2 rounded-2xl border border-line bg-surface/95 p-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "font-semibold",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "me-1 inline size-4 text-amber" }), copy.chat]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "text-muted",
						onClick: () => engine.current?.setOverlay("none"),
						children: "Esc"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "max-h-40 overflow-y-auto text-sm",
					children: [lines.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted",
						children: copy.enterChat
					}), lines.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "leading-snug",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-semibold text-sand",
							children: [l.from, ": "]
						}), l.body]
					}, l.key))]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						ref: inputRef,
						value: draft,
						onChange: (e) => setDraft(e.target.value),
						className: "flex-1 rounded-xl border border-line bg-raised px-3 py-2 text-sm text-foam outline-none focus:border-amber",
						placeholder: copy.enterChat,
						maxLength: 240
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "submit",
						className: "rounded-xl bg-amber px-4 py-2 text-sm font-bold text-ink",
						children: copy.send
					})]
				})
			]
		})
	})] });
}
function fmtTime(s) {
	return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}
function compassLetter(yaw, lang) {
	const deg = (-yaw * 180 / Math.PI + 360) % 360;
	const dirs = lang === "ar" ? [
		[0, "ش"],
		[90, "ق"],
		[180, "ج"],
		[270, "غ"]
	] : [
		[0, "N"],
		[90, "E"],
		[180, "S"],
		[270, "W"]
	];
	let best = dirs[0][1];
	let bd = 999;
	for (const [a, l] of dirs) {
		const d = Math.min(Math.abs(deg - a), 360 - Math.abs(deg - a));
		if (d < bd) {
			bd = d;
			best = l;
		}
	}
	return best;
}
function GameApp() {
	const canvasRef = (0, import_react.useRef)(null);
	const engineRef = (0, import_react.useRef)(null);
	const [muted, setMuted] = (0, import_react.useState)(false);
	const [booting, setBooting] = (0, import_react.useState)(false);
	const screen = useGameStore((s) => s.screen);
	const overlay = useGameStore((s) => s.overlay);
	const lang = useGameStore((s) => s.lang);
	const locked = useGameStore((s) => s.locked);
	const copy = COPY[lang];
	const { user, isPending } = useCurrentUserState();
	const [profile, setProfile] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		useGameStore.getState().patch({ hasSave: hasSave() });
		return () => {
			engineRef.current?.stop();
			engineRef.current = null;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		if (isPending || !user) {
			setProfile(null);
			return;
		}
		const hint = (user.displayName || user.primaryEmail?.split("@")[0] || "player").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
		upsertProfile({ data: hint || "player" }).then(setProfile).catch(() => getMyProfile().then(setProfile).catch(() => setProfile(null)));
	}, [user, isPending]);
	async function begin(training, load) {
		const canvas = canvasRef.current;
		if (!canvas) return;
		setBooting(true);
		engineRef.current?.stop();
		const eng = new TribalsEngine(canvas);
		engineRef.current = eng;
		window.__tribals = eng;
		const outfit = useGameStore.getState().outfit;
		try {
			await eng.start({
				training,
				outfit,
				load
			});
			eng.audio.setMuted(muted);
		} catch (err) {
			console.error(err);
			window.__tribalsError = err instanceof Error ? err.stack ?? err.message : String(err);
		} finally {
			setBooting(false);
		}
		eng.input.requestLock();
	}
	function onCanvasClick() {
		if (useGameStore.getState().screen !== "playing") return;
		if (useGameStore.getState().overlay !== "none") return;
		engineRef.current?.audio.unlock();
		engineRef.current?.input.requestLock();
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative h-dvh w-full overflow-hidden bg-ink text-foam",
		dir: lang === "ar" ? "rtl" : "ltr",
		style: { fontFamily: "var(--font-sans)" },
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
				ref: canvasRef,
				className: "absolute inset-0 h-full w-full touch-none",
				onClick: onCanvasClick
			}),
			screen === "menu" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, {
				onPlay: begin,
				booting,
				userPending: isPending,
				signedIn: !!user,
				profile
			}),
			screen !== "menu" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hud, {
				muted,
				setMuted,
				engine: engineRef
			}),
			screen === "playing" && profile && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OnlineSession, {
				engine: engineRef,
				username: profile.username,
				isAdmin: profile.isAdmin
			}),
			screen === "playing" && overlay === "none" && !locked && !engineRef.current?.input.isTouch && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "absolute inset-0 z-20 flex items-center justify-center bg-ink/50 text-base font-semibold tracking-wide text-foam",
				onClick: onCanvasClick,
				children: copy.click
			}),
			screen === "paused" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PauseOverlay, { engine: engineRef }),
			screen === "dead" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeadOverlay, { engine: engineRef }),
			(overlay === "inventory" || overlay === "craft") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BagOverlay, { engine: engineRef }),
			overlay === "map" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapOverlay, {})
		]
	});
}
function Menu({ onPlay, booting, userPending, signedIn, profile }) {
	const lang = useGameStore((s) => s.lang);
	const outfit = useGameStore((s) => s.outfit);
	const has = useGameStore((s) => s.hasSave);
	const copy = COPY[lang];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "absolute inset-0 z-30 overflow-y-auto",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: "/images/menu-hero.jpg",
				alt: "",
				className: "absolute inset-0 h-full w-full object-cover",
				crossOrigin: "anonymous"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/25" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative mx-auto flex min-h-dvh max-w-5xl flex-col justify-end gap-6 px-5 pb-10 pt-16 sm:justify-center sm:pb-16",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "max-w-xl animate-[tribals-fade_0.5s_var(--ease-smooth-out)]",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-semibold tracking-[0.28em] text-amber",
								children: copy.tag
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "mt-2 text-5xl font-extrabold leading-none tracking-tight text-foam sm:text-7xl",
								children: copy.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-4 max-w-md text-sm leading-relaxed text-muted",
								children: copy.tutorial
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap gap-2",
						children: copy.outfits.map((name, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => useGameStore.getState().setOutfit(i),
							className: `rounded-lg border px-3 py-2 text-sm font-semibold transition ${outfit === i ? "border-amber bg-amber text-ink" : "border-line bg-raised/80 text-foam hover:border-sand"}`,
							style: outfit === i ? void 0 : { boxShadow: `inset 0 -3px 0 ${OUTFITS[i].accent}` },
							children: name
						}, name))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-3 sm:flex-row",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: booting,
								onClick: () => onPlay(false, false),
								className: "rounded-xl bg-foam px-6 py-3 text-base font-bold text-ink transition hover:bg-sand disabled:opacity-60",
								children: booting ? "…" : copy.play
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: booting,
								onClick: () => onPlay(true, false),
								className: "rounded-xl border border-line bg-raised/80 px-6 py-3 text-base font-semibold text-foam",
								children: copy.train
							}),
							has && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: booting,
								onClick: () => onPlay(false, true),
								className: "rounded-xl border border-amber/40 bg-panel/80 px-6 py-3 text-base font-semibold text-amber",
								children: copy.resume
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => useGameStore.getState().setLang(lang === "ar" ? "en" : "ar"),
								className: "rounded-xl border border-line px-4 py-3 text-sm font-semibold text-muted",
								children: copy.lang
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: copy.controls
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel/80 p-3",
						children: userPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-8 w-40 animate-pulse rounded-lg bg-raised" }) : signedIn ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, {}), profile && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-xs text-sand",
							children: [
								copy.online,
								": ",
								profile.username,
								profile.isAdmin ? ` · ${copy.adminBadge}` : ""
							]
						})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/login",
							className: "rounded-xl bg-amber px-4 py-2 text-sm font-bold text-ink",
							children: copy.login
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-muted",
							children: copy.guest
						})] })
					})
				]
			})
		]
	});
}
function Hud({ muted, setMuted, engine }) {
	const s = useGameStore();
	const copy = COPY[s.lang];
	const inv = s.inventory;
	const hot = s.hotIndex;
	const phase = s.raining ? copy.storm : s.timeOfDay < .22 || s.timeOfDay > .78 ? copy.nightLabel : s.timeOfDay > .7 ? copy.dusk : copy.day;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		s.hurt > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "pointer-events-none absolute inset-0 z-10",
			style: { boxShadow: `inset 0 0 120px rgba(160,20,16,${Math.min(.55, s.hurt)})` }
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crosshair, {
				className: "size-5 text-foam/80",
				strokeWidth: 1.6
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "absolute left-3 top-3 z-10 flex flex-col gap-2 sm:left-5 sm:top-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl border border-line bg-panel/85 px-3 py-2 backdrop-blur-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-[11px] font-semibold tracking-wide text-muted",
					children: [
						phase,
						" · FPS ",
						s.fps,
						" · ",
						fmtTime(s.session)
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-[11px] text-sand",
					children: [
						copy.kills,
						" ",
						s.kills,
						" · ",
						copy.score,
						" ",
						s.score
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "hidden w-56 rounded-xl border border-line bg-panel/80 p-3 text-[12px] sm:block",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-1 font-semibold text-amber",
					children: copy.missions
				}), copy.quests.map((q) => {
					const v = s.quests[q.id] ?? 0;
					const done = v >= q.target;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: done ? "text-ok" : "text-muted",
						children: [
							q.title,
							" · ",
							Math.min(v, q.target),
							"/",
							q.target
						]
					}, q.id);
				})]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "absolute right-3 top-3 z-10 flex gap-2 sm:right-5 sm:top-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex w-44 flex-col gap-1.5 rounded-xl border border-line bg-panel/85 p-3 backdrop-blur-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
						color: "var(--color-health)",
						value: s.health,
						label: copy.health
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
						color: "var(--color-hunger)",
						value: s.hunger,
						label: copy.hunger
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
						color: "var(--color-thirst)",
						value: s.thirst,
						label: copy.thirst
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
						color: "var(--color-stamina)",
						value: s.stamina,
						label: copy.stamina
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative hidden size-28 overflow-hidden rounded-full border border-line bg-panel/90 sm:block",
				children: [s.minimap && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: s.minimap,
					alt: "",
					className: "h-full w-full object-cover",
					crossOrigin: "anonymous"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute inset-x-0 top-1 flex justify-center text-[10px] font-bold text-foam",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Compass, { className: "ml-1 size-3" }),
						" ",
						compassLetter(s.yaw, s.lang)
					]
				})]
			})]
		}),
		s.prompt && s.overlay === "none" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "absolute left-1/2 top-[58%] z-10 -translate-x-1/2 rounded-lg border border-line bg-panel/90 px-3 py-1.5 text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "me-2 inline-block rounded bg-raised px-1.5 font-mono text-xs text-amber",
				children: s.prompt.key
			}), s.prompt.label]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1 sm:bottom-5",
			children: Array.from({ length: 8 }, (_, i) => {
				const slot = inv[40 + i];
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => engine.current?.useHot(i),
					className: `pointer-events-auto flex size-11 flex-col items-center justify-center rounded-lg border sm:size-12 ${hot === i ? "border-amber bg-raised" : "border-line bg-panel/80"}`,
					children: slot ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: ITEM[slot.id].icon,
						alt: "",
						className: "size-7 object-contain",
						crossOrigin: "anonymous"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[9px] tabular-nums text-muted",
						children: slot.count
					})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[10px] text-muted",
						children: i + 1
					})
				}, i);
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "absolute bottom-3 right-3 z-10 flex gap-2 sm:bottom-5 sm:right-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
					onClick: () => {
						const v = !muted;
						setMuted(v);
						engine.current?.audio.setMuted(v);
					},
					children: muted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "size-4" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
					onClick: () => engine.current?.setOverlay(overlayOf(s.overlay, "inventory")),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, { className: "size-4" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
					onClick: () => engine.current?.setOverlay(overlayOf(s.overlay, "map")),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Map$1, { className: "size-4" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
					onClick: () => engine.current?.setOverlay(overlayOf(s.overlay, "chat")),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "size-4" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
					onClick: () => useGameStore.getState().setScreen("paused"),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-4" })
				})
			]
		}),
		engine.current?.input.isTouch && s.overlay === "none" && s.screen === "playing" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TouchPad, { engine }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "pointer-events-none absolute bottom-24 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1",
			children: s.toasts.map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rounded-md border border-line bg-panel/90 px-3 py-1 text-sm",
				children: x.text
			}, x.id))
		})
	] });
}
function overlayOf(cur, next) {
	return cur === next ? "none" : next;
}
function Bar({ color, value, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mb-0.5 flex justify-between text-[10px] text-muted",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "tabular-nums",
			children: Math.round(value)
		})]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "h-1.5 overflow-hidden rounded-full bg-ink",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "h-full rounded-full",
			style: {
				width: `${Math.max(0, Math.min(100, value))}%`,
				background: color
			}
		})
	})] });
}
function IconBtn({ children, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		className: "pointer-events-auto flex size-11 items-center justify-center rounded-xl border border-line bg-panel/85 text-foam",
		children
	});
}
function TouchPad({ engine }) {
	const copy = t();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-none absolute inset-0 z-10",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute bottom-24 left-6 size-28 rounded-full border border-line/80 bg-raised/30" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "absolute bottom-24 right-6 flex flex-col gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "pointer-events-auto size-14 rounded-full border border-line bg-panel/80 text-xs font-semibold",
					onPointerDown: () => {
						const i = engine.current?.input;
						if (i) i.fireClick = true;
					},
					children: copy.attack
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "pointer-events-auto size-12 rounded-full border border-line bg-panel/80 text-xs",
					onPointerDown: () => {
						const i = engine.current?.input;
						if (i) i.jumpClick = true;
					},
					children: "⌃"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "pointer-events-auto size-12 rounded-full border border-line bg-panel/80 text-xs",
					onPointerDown: () => {
						const i = engine.current?.input;
						if (i) i.interactClick = true;
					},
					children: "E"
				})
			]
		})]
	});
}
function PauseOverlay({ engine }) {
	const copy = t();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "absolute inset-0 z-30 flex items-center justify-center bg-ink/70 p-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-sm rounded-2xl border border-line bg-surface p-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-2xl font-bold",
				children: copy.paused
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "rounded-xl bg-foam px-4 py-3 font-semibold text-ink",
					onClick: () => {
						useGameStore.getState().setScreen("playing");
						engine.current?.input.requestLock();
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "me-2 inline size-4" }), copy.resume]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "rounded-xl border border-line px-4 py-3 font-semibold",
					onClick: () => {
						engine.current?.save();
						engine.current?.stop();
						engine.current = null;
						useGameStore.getState().setScreen("menu");
						useGameStore.getState().patch({
							hasSave: hasSave(),
							overlay: "none"
						});
					},
					children: copy.title
				})]
			})]
		})
	});
}
function DeadOverlay({ engine }) {
	const copy = t();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "absolute inset-0 z-30 flex items-center justify-center bg-ink/75 p-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-sm rounded-2xl border border-line bg-surface p-6 text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Swords, { className: "mx-auto size-8 text-health" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-3 text-2xl font-bold",
					children: copy.dead
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "mt-5 w-full rounded-xl bg-foam px-4 py-3 font-semibold text-ink",
					onClick: () => {
						engine.current?.respawn();
						engine.current?.input.requestLock();
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "me-2 inline size-4" }), copy.respawn]
				})
			]
		})
	});
}
function BagOverlay({ engine }) {
	const s = useGameStore();
	const copy = COPY[s.lang];
	const [sel, setSel] = (0, import_react.useState)(RECIPES[0]);
	const inv = s.inventory;
	const can = (r) => {
		if (r.station !== "hand" && r.station !== s.nearStation) return false;
		return Object.entries(r.cost).every(([k, n]) => countItem(inv, k) >= (n ?? 0));
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "absolute inset-0 z-20 flex items-center justify-center bg-ink/55 p-3 sm:p-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex max-h-[88dvh] w-full max-w-5xl flex-col gap-3 overflow-hidden rounded-2xl border border-line bg-surface p-4 sm:flex-row",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 overflow-auto",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-2 flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "font-bold",
						children: copy.inv
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "text-sm text-muted",
						onClick: () => engine.current?.setOverlay("none"),
						children: "Esc"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid grid-cols-6 gap-1 sm:grid-cols-8",
					children: inv.map((slot, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => {
							if (!slot) return;
							if (ITEM[slot.id].kind === "none" && (ITEM[slot.id].heal || ITEM[slot.id].hunger || ITEM[slot.id].thirst)) engine.current?.useConsumable(slot.id);
						},
						className: "flex aspect-square flex-col items-center justify-center rounded-lg border border-line bg-raised p-1",
						children: slot ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: ITEM[slot.id].icon,
							alt: "",
							className: "size-8 object-contain",
							crossOrigin: "anonymous"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[9px] tabular-nums text-muted",
							children: slot.count
						})] }) : null
					}, i))
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-full overflow-auto sm:w-80",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "mb-2 font-bold",
						children: copy.craft
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-2 text-xs text-muted",
						children: s.nearStation === "furnace" ? copy.stationFurnace : s.nearStation === "fire" ? copy.stationFire : copy.stationHand
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex max-h-48 flex-col gap-1 overflow-auto",
						children: RECIPES.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setSel(r),
							className: `flex items-center gap-2 rounded-lg border px-2 py-1.5 text-start text-sm ${sel.id === r.id ? "border-amber bg-raised" : "border-line"} ${can(r) ? "text-foam" : "text-muted"}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
									src: ITEM[r.out].icon,
									alt: "",
									className: "size-7 object-contain",
									crossOrigin: "anonymous"
								}),
								copy.items[r.out],
								" ×",
								r.count
							]
						}, r.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 rounded-xl border border-line bg-raised p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-semibold",
								children: copy.items[sel.out]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "mt-1 text-xs text-muted",
								children: Object.entries(sel.cost).map(([k, n]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
									copy.items[k],
									" ",
									n,
									" / ",
									countItem(inv, k)
								] }, k))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: !can(sel),
								onClick: () => engine.current?.craft(sel.id),
								className: "mt-3 w-full rounded-lg bg-ok px-3 py-2 text-sm font-bold text-ink disabled:opacity-40",
								children: copy.make
							})
						]
					})
				]
			})]
		})
	});
}
function MapOverlay() {
	const s = useGameStore();
	const copy = COPY[s.lang];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "absolute inset-0 z-20 flex items-center justify-center bg-ink/60 p-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-lg rounded-2xl border border-line bg-surface p-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "mb-3 font-bold",
					children: copy.map
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "overflow-hidden rounded-xl border border-line",
					children: s.minimap ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: s.minimap,
						alt: "",
						className: "aspect-square w-full object-cover",
						crossOrigin: "anonymous"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: "/images/island-map.jpg",
						alt: "",
						className: "aspect-square w-full object-cover",
						crossOrigin: "anonymous"
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "mt-3 w-full rounded-lg border border-line py-2 text-sm",
					onClick: () => useGameStore.getState().setOverlay("none"),
					children: "Esc"
				})
			]
		})
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameApp, {});
}
//#endregion
export { Home as component };
