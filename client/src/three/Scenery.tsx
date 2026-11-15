import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TILE_D, TILE_W, rowsOf, type Layout } from '../game/board';

/** Générateur pseudo-aléatoire déterministe : le décor ne change pas à chaque rendu. */
function mulberry(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Tree({ position, scale, hue }: { position: [number, number, number]; scale: number; hue: string }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.17, 0.9, 8]} />
        <meshStandardMaterial color="#8a5a33" />
      </mesh>
      <mesh position={[0, 1.3, 0]} castShadow>
        <coneGeometry args={[0.7, 1.3, 10]} />
        <meshStandardMaterial color={hue} roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.0, 0]} castShadow>
        <coneGeometry args={[0.5, 1.0, 10]} />
        <meshStandardMaterial color={hue} roughness={0.9} />
      </mesh>
    </group>
  );
}

function Cloud({ position, scale, speed }: { position: [number, number, number]; scale: number; speed: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    g.position.x += dt * speed;
    if (g.position.x > 34) g.position.x = -34;
  });
  return (
    <group ref={ref} position={position} scale={scale}>
      {[[0, 0, 0, 1], [1.1, -0.1, 0.1, 0.75], [-1.1, -0.15, 0, 0.7], [0.4, 0.45, -0.1, 0.7]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[r, 16, 12]} />
          <meshStandardMaterial color="#ffffff" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** `plain` : mode concentration, un simple socle neutre sans arbres, nuages ni mer. */
export function Scenery({ layout, plain = false }: { layout: Layout; plain?: boolean }) {
  const { size, cols } = layout;
  const rows = rowsOf(layout);
  const w = cols * TILE_W + 5;
  const d = rows * TILE_D + 5;

  const trees = useMemo(() => {
    const rng = mulberry(size * 7 + 3);
    const greens = ['#3fa34d', '#2d8a4e', '#57b85a', '#3b9c6b'];
    const out: { position: [number, number, number]; scale: number; hue: string }[] = [];
    const bw = (cols * TILE_W) / 2 + 0.9;
    const bd = (rows * TILE_D) / 2 + 0.9;
    for (let i = 0; i < 26; i++) {
      // sur le pourtour de l'île, jamais devant le plateau
      const sideRoll = rng();
      const x = sideRoll < 0.34 ? -bw - rng() * 1.1 : sideRoll < 0.68 ? bw + rng() * 1.1 : (rng() * 2 - 1) * (bw + 1);
      const z = sideRoll < 0.68 ? (rng() * 2 - 1) * bd : -bd - rng() * 1.1;
      out.push({ position: [x, 0, z], scale: 0.7 + rng() * 0.7, hue: greens[Math.floor(rng() * greens.length)] });
    }
    return out;
  }, [size, cols, rows]);

  if (plain)
    return (
      <mesh position={[0, -0.5, 0]} receiveShadow>
        <boxGeometry args={[w - 2.5, 1, d - 2.5]} />
        <meshStandardMaterial color="#dfe6ee" roughness={1} />
      </mesh>
    );

  return (
    <group>
      {/* île */}
      <mesh position={[0, -0.5, 0]} receiveShadow>
        <boxGeometry args={[w, 1, d]} />
        <meshStandardMaterial color="#8fd16a" roughness={1} />
      </mesh>
      <mesh position={[0, -1.25, 0]}>
        <boxGeometry args={[w + 1.2, 1, d + 1.2]} />
        <meshStandardMaterial color="#f0d9a0" roughness={1} />
      </mesh>
      {/* mer */}
      <mesh position={[0, -1.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#3fb0e8" roughness={0.3} metalness={0.1} />
      </mesh>
      {trees.map((t, i) => (
        <Tree key={i} {...t} />
      ))}
      <Cloud position={[-14, 9, -12]} scale={1.5} speed={0.35} />
      <Cloud position={[6, 11, -16]} scale={2} speed={0.22} />
      <Cloud position={[20, 8, -10]} scale={1.2} speed={0.3} />
    </group>
  );
}
