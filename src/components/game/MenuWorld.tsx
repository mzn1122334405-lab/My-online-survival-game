import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { pineGeometry } from "@/game/pine";
import { OUTFITS } from "@/game/data";

export function MenuWorld({ outfit, reduce }: { outfit: number; reduce: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const yaw = useRef(0.6);
  const dragging = useRef(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let dead = false;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x8ebbd4, 1);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x9ec3d4, 22, 78);
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 140);
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x3d6a40, 1.15));
    const sun = new THREE.DirectionalLight(0xfff1d2, 1.35);
    sun.position.set(-12, 18, 8);
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(28, 40),
      new THREE.MeshStandardMaterial({ color: 0x6f9a48, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const sand = new THREE.Mesh(
      new THREE.RingGeometry(16, 28, 40),
      new THREE.MeshStandardMaterial({ color: 0xd8c394, roughness: 1 }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.y = 0.02;
    scene.add(sand);
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(60, 32),
      new THREE.MeshStandardMaterial({ color: 0x3f93b0, roughness: 0.2, metalness: 0.05 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.35;
    scene.add(water);

    const scout = new THREE.Group();
    scout.position.set(1.2, 0, 0.4);
    scene.add(scout);
    const loader = new GLTFLoader();
    const tint = OUTFITS[outfit] ?? OUTFITS[0];

    void loader.loadAsync("/models/scout.glb").then((gltf) => {
      if (dead) return;
      const mesh = gltf.scene;
      mesh.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = false;
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat?.color) mat.color.lerp(new THREE.Color(tint.arm), 0.18);
      });
      const box = new THREE.Box3().setFromObject(mesh);
      const h = Math.max(0.01, box.max.y - box.min.y);
      mesh.scale.setScalar(1.85 / h);
      mesh.position.y = -box.min.y * (1.85 / h);
      scout.add(mesh);
    }).catch(() => undefined);

    const pineMat = new THREE.MeshStandardMaterial({ roughness: 0.86, vertexColors: true });
    const pineGeo = pineGeometry();
    for (const [x, z, s] of [[-6, -3, 4.4], [-4.2, 4.5, 3.6], [5.5, -4, 4.8], [7, 2.4, 3.8], [-8, 1, 3.2]] as const) {
      const tree = new THREE.Mesh(pineGeo, pineMat);
      tree.scale.setScalar(s);
      tree.position.set(x, 0, z);
      tree.rotation.y = x;
      scene.add(tree);
    }

    void loader.loadAsync("/models/rock_l.glb").then((gltf) => {
      if (dead) return;
      for (const [x, z, s] of [[-2.4, -5.2, 1.6], [4.2, 3.6, 1.2], [-7.5, -2, 1.1]] as const) {
        const rock = gltf.scene.clone(true);
        rock.scale.setScalar(s);
        rock.position.set(x, 0, z);
        scene.add(rock);
      }
    }).catch(() => undefined);

    const fit = () => {
      const w = canvas.clientWidth || 1;
      const h = canvas.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    const down = (e: PointerEvent) => {
      dragging.current = true;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      yaw.current += e.movementX * 0.01;
    };
    const up = () => {
      dragging.current = false;
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);

    let raf = 0;
    const loop = (t: number) => {
      if (dead) return;
      const orbit = reduce ? 0.7 : t * 0.00007;
      camera.position.set(Math.sin(orbit) * 14 + 2, 5.4, Math.cos(orbit) * 14);
      camera.lookAt(0.4, 1.3, 0);
      scout.rotation.y = yaw.current;
      if (!reduce) scout.position.y = Math.sin(t * 0.0016) * 0.035;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      renderer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    };
  }, [outfit, reduce]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}
