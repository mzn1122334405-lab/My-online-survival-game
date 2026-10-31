import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const SKIN = new THREE.Color(0xc68642);
const NAIL = new THREE.Color(0xf3d7c4);
const SLEEVE = new THREE.Color(0x2c3036);
const STITCH = new THREE.Color(0x9aa0a6);

export type HandMode = "idle" | "walk" | "run" | "jump" | "punch" | "grip";

export type HandRig = {
  mesh: THREE.SkinnedMesh;
  pose: (mode: HandMode, time: number, bob: number, swing: number) => void;
};

type Digit = { bones: THREE.Bone[]; rest: THREE.Euler[] };

function paint(geo: THREE.BufferGeometry, bone: number, tip: THREE.Vector3, color: THREE.Color, nail: boolean) {
  const pos = geo.getAttribute("position");
  const n = pos.count;
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    skinIndex[i * 4] = bone;
    skinWeight[i * 4] = 1;
    const d = Math.hypot(pos.getX(i) - tip.x, pos.getY(i) - tip.y, pos.getZ(i) - tip.z);
    const c = nail && d < 0.012 ? NAIL : color;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeight, 4));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

function capsule(from: THREE.Vector3, to: THREE.Vector3, r0: number, r1: number, bone: number, color: THREE.Color, nail = false) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = Math.max(0.004, dir.length());
  const geo = new THREE.CylinderGeometry(r1, r0, len, 8, 1, true);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
  const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
  geo.translate(mid.x, mid.y, mid.z);
  const cap = new THREE.SphereGeometry(r1, 8, 6);
  cap.translate(to.x, to.y, to.z);
  return [paint(geo, bone, to, color, nail), paint(cap, bone, to, color, nail)];
}

export function createHand(): HandRig {
  const bones: THREE.Bone[] = [];
  const wrist = new THREE.Bone();
  wrist.name = "wrist";
  bones.push(wrist);
  const sleeve = new THREE.Bone();
  sleeve.name = "sleeve";
  sleeve.position.set(0, -0.01, 0.06);
  wrist.add(sleeve);
  bones.push(sleeve);
  const palm = new THREE.Bone();
  palm.name = "palm";
  palm.position.set(0, 0.005, -0.02);
  wrist.add(palm);
  bones.push(palm);

  const specs = [
    { name: "thumb", x: -0.038, y: -0.008, z: 0.012, rot: [0.2, 0.85, 0.55], lens: [0.032, 0.024, 0.02], r: 0.013 },
    { name: "index", x: -0.03, y: 0.008, z: -0.055, rot: [0.15, 0.12, 0], lens: [0.036, 0.024, 0.018], r: 0.011 },
    { name: "middle", x: -0.006, y: 0.01, z: -0.06, rot: [0.18, 0, 0], lens: [0.04, 0.026, 0.018], r: 0.011 },
    { name: "ring", x: 0.018, y: 0.006, z: -0.054, rot: [0.2, -0.1, 0], lens: [0.036, 0.024, 0.017], r: 0.01 },
    { name: "pinky", x: 0.036, y: 0.0, z: -0.044, rot: [0.22, -0.22, 0], lens: [0.028, 0.02, 0.015], r: 0.009 },
  ];
  const digits: Digit[] = [];
  for (const s of specs) {
    const chain: THREE.Bone[] = [];
    const rest: THREE.Euler[] = [];
    let parent: THREE.Bone = palm;
    s.lens.forEach((len, i) => {
      const b = new THREE.Bone();
      b.name = `${s.name}${i}`;
      if (i === 0) b.position.set(s.x, s.y, s.z);
      else b.position.set(0, 0, -s.lens[i - 1]);
      b.rotation.set(s.rot[0] * (i === 0 ? 1 : 0.2), i === 0 ? s.rot[1] : 0, i === 0 ? s.rot[2] : 0);
      parent.add(b);
      bones.push(b);
      chain.push(b);
      rest.push(b.rotation.clone());
      parent = b;
    });
    digits.push({ bones: chain, rest });
  }

  wrist.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  const addBone = (bone: THREE.Bone, index: number, len: number, r0: number, r1: number, color: THREE.Color, nail = false) => {
    const from = new THREE.Vector3();
    const to = new THREE.Vector3(0, 0, -len);
    bone.getWorldPosition(from);
    bone.localToWorld(to);
    parts.push(...capsule(from, to, r0, r1, index, color, nail));
  };
  addBone(sleeve, 1, 0.11, 0.038, 0.034, SLEEVE);
  const cuff = new THREE.TorusGeometry(0.036, 0.006, 6, 10);
  cuff.rotateX(Math.PI / 2);
  cuff.translate(0, -0.01, 0.045);
  parts.push(paint(cuff, 1, new THREE.Vector3(0, -0.01, 0.02), STITCH, false));
  const palmBox = new THREE.BoxGeometry(0.092, 0.028, 0.078);
  palmBox.translate(-0.002, 0.004, -0.055);
  parts.push(paint(palmBox, 2, new THREE.Vector3(0, 0, -0.09), SKIN, false));

  digits.forEach((d, di) => {
    const spec = specs[di];
    d.bones.forEach((b, i) => {
      addBone(b, bones.indexOf(b), spec.lens[i], spec.r * (i === 2 ? 0.85 : 1), spec.r * (i === 2 ? 0.72 : 0.9), SKIN, i === 2);
    });
  });

  const geo = mergeGeometries(parts, false);
  if (!geo) throw new Error("hand merge failed");
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.58,
    metalness: 0.04,
  });
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.add(wrist);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.frustumCulled = false;
  mesh.castShadow = false;

  const pose = (mode: HandMode, time: number, bob: number, swing: number) => {
    const curl =
      mode === "punch" || mode === "grip" ? [1.15, 1.35, 1.15] : mode === "jump" ? [0.12, 0.18, 0.1] : mode === "run" ? [0.45, 0.55, 0.35] : mode === "walk" ? [0.32, 0.4, 0.22] : [0.28, 0.36, 0.2];
    const breathe = mode === "idle" ? Math.sin(time * 1.6) * 0.05 : Math.sin(bob) * 0.04;
    const fist = mode === "punch" ? swing : 0;
    wrist.rotation.x = (mode === "jump" ? -0.35 : mode === "grip" ? 0.15 : 0.05) + fist * 0.4 + breathe;
    wrist.rotation.z = mode === "walk" || mode === "run" ? Math.sin(bob) * (mode === "run" ? 0.12 : 0.06) : 0;
    digits.forEach((d, di) => {
      d.bones.forEach((b, i) => {
        const rest = d.rest[i];
        const close = di === 0 ? curl[i] * 0.55 : curl[i];
        b.rotation.set(rest.x + close + breathe + fist * 0.25, rest.y, rest.z);
      });
    });
  };
  pose("idle", 0, 0, 0);
  return { mesh, pose };
}
