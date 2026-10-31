import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

function paint(geo: THREE.BufferGeometry, hex: number) {
  const c = new THREE.Color(hex);
  const n = geo.getAttribute("position").count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}

/** Unit-tall pine. Base at y=0, crown reaches y=1. Vertex colors: bark and needles. */
export function pineGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = paint(new THREE.CylinderGeometry(0.022, 0.048, 0.62, 8, 3), 0x6d4a32);
  trunk.translate(0, 0.31, 0);
  parts.push(trunk);

  const layers = 8;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const y = 0.28 + t * 0.66;
    const reach = 0.2 * (1 - t * 0.78);
    const arms = i === layers - 1 ? 5 : 7;
    const green = i % 2 === 0 ? 0x2f6b30 : 0x3c8140;
    for (let b = 0; b < arms; b++) {
      const a = (b / arms) * Math.PI * 2 + i * 0.38;
      const branch = paint(new THREE.CylinderGeometry(0.004, 0.009, reach, 4, 1), 0x5a3b28);
      branch.translate(0, reach * 0.5, 0);
      branch.rotateZ(Math.PI / 2 + 0.42);
      branch.rotateY(a);
      branch.translate(0, y, 0);
      parts.push(branch);
      for (const along of [0.55, 0.92]) {
        const puff = paint(new THREE.ConeGeometry(reach * 0.42, 0.11 + (1 - t) * 0.05, 6), green);
        puff.translate(0, 0.04, 0);
        puff.rotateZ(0.55);
        puff.rotateY(a);
        puff.translate(Math.cos(a) * reach * along, y + 0.02, Math.sin(a) * reach * along);
        parts.push(puff);
      }
    }
  }
  const spear = paint(new THREE.ConeGeometry(0.045, 0.18, 7), 0x3f8a42);
  spear.translate(0, 0.96, 0);
  parts.push(spear);

  const geo = mergeGeometries(parts, false);
  if (!geo) throw new Error("pine merge failed");
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  if (!box) return geo;
  const h = Math.max(0.01, box.max.y - box.min.y);
  geo.translate(0, -box.min.y, 0);
  geo.scale(1 / h, 1 / h, 1 / h);
  geo.computeVertexNormals();
  return geo;
}
