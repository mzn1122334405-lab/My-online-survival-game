/**
 * Builds real triangle meshes from the reference sprites.
 * Each opaque span becomes an elliptical cross-section and those rings are lofted,
 * so the result has volume from every angle. The source painting is the base-color map.
 * Hidden sides are the same surface continued around the volume (one reference view).
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const SEG = 10;
const MAX_H = 76;

const JOBS = [
  { file: "palm.png", name: "palm", mode: "front", depth: 0.95 },
  { file: "oak.png", name: "oak", mode: "front", depth: 0.98 },
  { file: "pine.png", name: "pine", mode: "front", depth: 0.95 },
  { file: "dead.png", name: "dead", mode: "front", depth: 0.85 },
  { file: "rock_s.png", name: "rock_s", mode: "front", depth: 0.82 },
  { file: "rock_m.png", name: "rock_m", mode: "front", depth: 0.82 },
  { file: "rock_l.png", name: "rock_l", mode: "front", depth: 0.8 },
  { file: "rock_gold.png", name: "rock_gold", mode: "front", depth: 0.8 },
  { file: "deer.png", name: "deer", mode: "side", depth: 0.72 },
  { file: "boar.png", name: "boar", mode: "side", depth: 0.75 },
  { file: "wolf.png", name: "wolf", mode: "side", depth: 0.72 },
  { file: "bear.png", name: "bear", mode: "side", depth: 0.75 },
  { file: "scout.png", name: "scout", mode: "front", depth: 0.78 },
];

function raster(png) {
  const { width, height, data } = png;
  const th = Math.min(MAX_H, height);
  const tw = Math.max(12, Math.round(width * (th / height)));
  const a = new Uint8Array(tw * th);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const sx0 = Math.floor((x * width) / tw);
      const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * width) / tw));
      const sy0 = Math.floor((y * height) / th);
      const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * height) / th));
      let n = 0;
      let al = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * width + sx) * 4;
          const R = data[i];
          const G = data[i + 1];
          const B = data[i + 2];
          const A = data[i + 3];
          const magenta = R > 165 && B > 130 && G < 120;
          if (A > 48 && !magenta) al++;
          n++;
        }
      }
      if (al > n * 0.32) a[y * tw + x] = 1;
    }
  }
  keepLargest(tw, th, a);
  return { tw, th, a };
}

function keepLargest(tw, th, a) {
  const seen = new Uint8Array(tw * th);
  let best = [];
  const stack = [];
  for (let i = 0; i < a.length; i++) {
    if (!a[i] || seen[i]) continue;
    const comp = [];
    stack.push(i);
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop();
      comp.push(p);
      const x = p % tw;
      const y = (p - x) / tw;
      const nbs = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];
      for (const [nx, ny] of nbs) {
        if (nx < 0 || ny < 0 || nx >= tw || ny >= th) continue;
        const q = ny * tw + nx;
        if (a[q] && !seen[q]) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    if (comp.length > best.length) best = comp;
  }
  a.fill(0);
  for (const p of best) a[p] = 1;
}

function spansOf(row, tw, a) {
  const spans = [];
  let x = 0;
  while (x < tw) {
    if (!a[row * tw + x]) {
      x++;
      continue;
    }
    const x0 = x;
    while (x < tw && a[row * tw + x]) x++;
    spans.push({ x0, x1: x - 1 });
  }
  return spans;
}

function build(png, job) {
  const { tw, th, a } = raster(png);
  const positions = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  let tracks = [];

  const pushRing = (span, y) => {
    const cx = (span.x0 + span.x1) * 0.5;
    const rx = Math.max(0.75, (span.x1 - span.x0) * 0.5);
    const rz = Math.max(0.55, rx * job.depth);
    const start = positions.length / 3;
    for (let i = 0; i < SEG; i++) {
      const ang = (i / SEG) * Math.PI * 2;
      const x = cx + Math.cos(ang) * rx;
      const z = Math.sin(ang) * rz;
      const yUp = th - 1 - y;
      const shade = 0.58 + 0.42 * (Math.sin(ang) * 0.5 + 0.5);
      positions.push(x, yUp, z);
      colors.push(shade, shade, shade);
      uvs.push(x / tw, yUp / Math.max(1, th - 1));
    }
    return { start, cx, rx, y };
  };

  const stitch = (prev, cur) => {
    for (let i = 0; i < SEG; i++) {
      const i1 = (i + 1) % SEG;
      const a0 = prev.start + i;
      const b0 = prev.start + i1;
      const a1 = cur.start + i;
      const b1 = cur.start + i1;
      indices.push(a0, a1, b1, a0, b1, b0);
    }
  };

  const cap = (ring, up) => {
    const c = positions.length / 3;
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (let i = 0; i < SEG; i++) {
      sx += positions[(ring.start + i) * 3];
      sy += positions[(ring.start + i) * 3 + 1];
      sz += positions[(ring.start + i) * 3 + 2];
    }
    positions.push(sx / SEG, sy / SEG, sz / SEG);
    colors.push(0.82, 0.82, 0.82);
    uvs.push(sx / SEG / tw, sy / SEG / Math.max(1, th - 1));
    for (let i = 0; i < SEG; i++) {
      const i1 = (i + 1) % SEG;
      if (up) indices.push(c, ring.start + i, ring.start + i1);
      else indices.push(c, ring.start + i1, ring.start + i);
    }
  };

  for (let y = 0; y < th; y++) {
    const spans = spansOf(y, tw, a);
    const next = [];
    const used = new Set();
    for (const span of spans) {
      const ring = pushRing(span, y);
      let best = -1;
      let bestD = 1e9;
      tracks.forEach((tr, i) => {
        if (used.has(i)) return;
        const d = Math.abs(tr.cx - ring.cx);
        if (d < tr.rx + ring.rx && d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best >= 0) {
        used.add(best);
        stitch(tracks[best], ring);
      } else {
        cap(ring, false);
      }
      next.push(ring);
    }
    tracks.forEach((tr, i) => {
      if (!used.has(i)) cap(tr, true);
    });
    tracks = next;
  }
  for (const tr of tracks) cap(tr, true);

  if (positions.length < 9 || indices.length < 3) throw new Error(`empty mesh ${job.name}`);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]);
    maxX = Math.max(maxX, positions[i]);
    minY = Math.min(minY, positions[i + 1]);
    maxY = Math.max(maxY, positions[i + 1]);
  }
  const height = Math.max(1, maxY - minY);
  const midX = (minX + maxX) * 0.5;
  const world = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    const x = (positions[i] - midX) / height;
    const y = (positions[i + 1] - minY) / height;
    const z = positions[i + 2] / height;
    if (job.mode === "side") {
      world[i] = z;
      world[i + 1] = y;
      world[i + 2] = -x;
    } else {
      world[i] = x;
      world[i + 1] = y;
      world[i + 2] = z;
    }
  }

  const normals = new Float32Array(world.length);
  for (let t = 0; t < indices.length; t += 3) {
    const ia = indices[t] * 3;
    const ib = indices[t + 1] * 3;
    const ic = indices[t + 2] * 3;
    const ax = world[ib] - world[ia];
    const ay = world[ib + 1] - world[ia + 1];
    const az = world[ib + 2] - world[ia + 2];
    const bx = world[ic] - world[ia];
    const by = world[ic + 1] - world[ia + 1];
    const bz = world[ic + 2] - world[ia + 2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    normals[ia] += nx;
    normals[ia + 1] += ny;
    normals[ia + 2] += nz;
    normals[ib] += nx;
    normals[ib + 1] += ny;
    normals[ib + 2] += nz;
    normals[ic] += nx;
    normals[ic + 1] += ny;
    normals[ic + 2] += nz;
  }
  for (let i = 0; i < normals.length; i += 3) {
    const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= l;
    normals[i + 1] /= l;
    normals[i + 2] /= l;
  }

  return {
    positions: world,
    normals,
    uvs: new Float32Array(uvs),
    colors: new Float32Array(colors),
    indices: indices.length > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
    tris: indices.length / 3,
  };
}

function pad4(buf) {
  const extra = (4 - (buf.length % 4)) % 4;
  if (!extra) return buf;
  return Buffer.concat([buf, Buffer.alloc(extra)]);
}

function glb(mesh, pngBytes) {
  const pos = Buffer.from(mesh.positions.buffer);
  const nrm = Buffer.from(mesh.normals.buffer);
  const uv = Buffer.from(mesh.uvs.buffer);
  const col = Buffer.from(mesh.colors.buffer);
  const idx = Buffer.from(mesh.indices.buffer);
  const png = Buffer.from(pngBytes);
  const parts = [idx, pos, nrm, uv, col, png].map(pad4);
  let offset = 0;
  const raw = [idx, pos, nrm, uv, col, png];
  const bufferViews = raw.map((src, i) => {
    const view = { buffer: 0, byteOffset: offset, byteLength: src.length };
    offset += parts[i].length;
    return view;
  });
  const bin = Buffer.concat(parts);
  const vCount = mesh.positions.length / 3;
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], mesh.positions[i + k]);
      max[k] = Math.max(max[k], mesh.positions[i + k]);
    }
  }
  const idxType = mesh.indices instanceof Uint32Array ? 5125 : 5123;
  const json = {
    asset: { version: "2.0", generator: "wildra-reconstruct" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "solid" }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 1, NORMAL: 2, TEXCOORD_0: 3, COLOR_0: 4 },
            indices: 0,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        name: "ref",
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0 },
          metallicFactor: 0.02,
          roughnessFactor: 0.84,
        },
      },
    ],
    textures: [{ sampler: 0, source: 0 }],
    samplers: [{ magFilter: 9729, minFilter: 9986, wrapS: 33071, wrapT: 33071 }],
    images: [{ bufferView: 5, mimeType: "image/png" }],
    accessors: [
      { bufferView: 0, componentType: idxType, count: mesh.indices.length, type: "SCALAR" },
      { bufferView: 1, componentType: 5126, count: vCount, type: "VEC3", min, max },
      { bufferView: 2, componentType: 5126, count: vCount, type: "VEC3" },
      { bufferView: 3, componentType: 5126, count: vCount, type: "VEC2" },
      { bufferView: 4, componentType: 5126, count: vCount, type: "VEC3" },
    ],
    bufferViews,
    buffers: [{ byteLength: bin.length }],
  };
  const jsonBufRaw = Buffer.from(JSON.stringify(json));
  const jsonPad = (4 - (jsonBufRaw.length % 4)) % 4;
  const jsonBuf = Buffer.concat([jsonBufRaw, Buffer.alloc(jsonPad, 0x20)]);
  const header = Buffer.alloc(12);
  const total = 12 + 8 + jsonBuf.length + 8 + bin.length;
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(jsonBuf.length, 0);
  jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(bin.length, 0);
  bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jh, jsonBuf, bh, bin]);
}

mkdirSync("public/models", { recursive: true });
const report = [];
for (const job of JOBS) {
  const bytes = readFileSync(`public/sprites/${job.file}`);
  const png = PNG.sync.read(bytes);
  const mesh = build(png, job);
  const out = glb(mesh, bytes);
  writeFileSync(`public/models/${job.name}.glb`, out);
  const dx = mesh.positions.reduce((m, v, i) => (i % 3 === 0 ? Math.max(m, v) : m), -Infinity);
  report.push(`${job.name}: ${mesh.tris} tris, ${out.length} bytes, height 1, halfWidth ${dx.toFixed(3)}`);
}
console.log(report.join("\n"));
