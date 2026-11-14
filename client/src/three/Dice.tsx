import { RoundedBox } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

const P = 0.25;
const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-P, P], [P, -P]],
  3: [[-P, P], [0, 0], [P, -P]],
  4: [[-P, P], [P, P], [-P, -P], [P, -P]],
  5: [[-P, P], [P, P], [0, 0], [-P, -P], [P, -P]],
  6: [[-P, P], [P, P], [-P, 0], [P, 0], [-P, -P], [P, -P]],
};
const H = Math.PI / 2;
/** Orientation de chaque face sur le dé (son +z local devient la normale de la face). */
const FACE_ROT: Record<number, [number, number, number]> = {
  1: [0, 0, 0], 6: [0, Math.PI, 0], 2: [0, H, 0], 5: [0, -H, 0], 3: [-H, 0, 0], 4: [H, 0, 0],
};
/** Rotation du dé pour présenter la face voulue vers la caméra. */
const SHOW_ROT: Record<number, [number, number, number]> = {
  1: [0, 0, 0], 6: [0, Math.PI, 0], 2: [0, -H, 0], 5: [0, H, 0], 3: [H, 0, 0], 4: [-H, 0, 0],
};
const DURATION = 1.9;

interface RollState {
  value: number;
  t: number;
  spin: [number, number, number];
  done: (n: number) => void;
}

function Die({ shown, roll, waiting }: { shown: number; roll: React.RefObject<RollState | null>; waiting: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }, delta) => {
    const g = ref.current;
    if (!g) return;
    const r = roll.current;
    if (!r) {
      const [x, y, z] = SHOW_ROT[shown];
      const wobble = waiting ? Math.sin(clock.elapsedTime * 2.4) * 0.12 : 0;
      g.rotation.set(x + wobble, y + wobble * 0.7, z);
      g.position.y = waiting ? Math.abs(Math.sin(clock.elapsedTime * 2.4)) * 0.1 : 0;
      return;
    }
    r.t = Math.min(1, r.t + Math.min(delta, 0.1) / DURATION);
    const rest = (1 - r.t) ** 2;
    const [x, y, z] = SHOW_ROT[r.value];
    g.rotation.set(x + rest * r.spin[0], y + rest * r.spin[1], z + rest * r.spin[2]);
    g.position.y = Math.abs(Math.sin(r.t * Math.PI * 3)) * (1 - r.t) * 0.7;
    if (r.t >= 1) {
      roll.current = null;
      r.done(r.value);
    }
  });
  return (
    <group rotation={[0.42, -0.5, 0]}>
      <group ref={ref}>
        <RoundedBox args={[1, 1, 1]} radius={0.14} smoothness={4}>
          <meshStandardMaterial color="#ffffff" roughness={0.35} />
        </RoundedBox>
        {Object.entries(PIPS).map(([face, pips]) => (
          <group key={face} rotation={FACE_ROT[Number(face)]}>
            {pips.map(([x, y], i) => (
              <mesh key={i} position={[x, y, 0.503]}>
                <circleGeometry args={[0.09, 20]} />
                <meshBasicMaterial color={Number(face) === 1 ? '#e63946' : '#2b2440'} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}

/** Dé virtuel 3D : un clic le lance, `onResult` reçoit la valeur une fois le dé arrêté. */
export function Dice({ lastRoll, enabled, onResult }: { lastRoll: number | null; enabled: boolean; onResult: (n: number) => void }) {
  const roll = useRef<RollState | null>(null);
  const start = () => {
    if (!enabled || roll.current) return;
    const turns = () => (2 + Math.floor(Math.random() * 3)) * Math.PI * 2 * (Math.random() < 0.5 ? -1 : 1);
    roll.current = { value: 1 + Math.floor(Math.random() * 6), t: 0, spin: [turns(), turns(), turns() / 2], done: onResult };
  };
  return (
    <button className={`dice3d ${enabled ? 'ready' : ''}`} onClick={start} disabled={!enabled} aria-label="Lancer le dé">
      <Canvas camera={{ position: [0, 0, 4.2], fov: 32 }} dpr={[1, 2]}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[3, 5, 4]} intensity={2} />
        <Die shown={lastRoll ?? 1} roll={roll} waiting={enabled} />
      </Canvas>
    </button>
  );
}
