import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { tilePosition, type Layout } from '../game/board';
import { useGame, type Anim } from '../game/store';

const slotOf = (tile: number, l: Layout, index: number, count: number) => {
  const [x, y, z] = tilePosition(tile, l);
  return new THREE.Vector3(x + (index - (count - 1) / 2) * 0.55, y, z - 0.5);
};

/** Durées volontairement lentes : un jeune enfant doit pouvoir suivre le pion des yeux. */
const HOP_SECONDS = 0.65;
const SLIDE_SECONDS = 2.4;
/** Petite pause à l'arrivée, avant que la carte-mot ne s'ouvre. */
const LANDING_PAUSE = 0.5;

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Une oie, modelée avec des formes simples. Elle regarde vers +z. */
function Goose({ color }: { color: string }) {
  return (
    <group scale={0.8}>
      <mesh position={[0, 0.5, 0]} scale={[0.85, 0.75, 1.2]} castShadow>
        <sphereGeometry args={[0.5, 24, 18]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.62, -0.55]} rotation={[-0.9, 0, 0]} castShadow>
        <coneGeometry args={[0.2, 0.5, 12]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.0, 0.36]} rotation={[0.25, 0, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.17, 0.75, 14]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.42, 0.46]} castShadow>
        <sphereGeometry args={[0.23, 20, 16]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.38, 0.75]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.1, 0.32, 12]} />
        <meshStandardMaterial color="#ff9f1c" roughness={0.5} />
      </mesh>
      {[-0.12, 0.12].map((x) => (
        <mesh key={x} position={[x, 1.5, 0.62]}>
          <sphereGeometry args={[0.04, 10, 10]} />
          <meshStandardMaterial color="#1b1b1b" />
        </mesh>
      ))}
      {[-0.18, 0.18].map((x) => (
        <mesh key={x} position={[x, 0.06, 0.12]} scale={[1, 0.3, 1.5]} castShadow>
          <sphereGeometry args={[0.13, 12, 8]} />
          <meshStandardMaterial color="#ff9f1c" />
        </mesh>
      ))}
    </group>
  );
}

export function Pawn({ index }: { index: number }) {
  const player = useGame((s) => s.players[index]);
  const count = useGame((s) => s.players.length);
  const size = useGame((s) => s.board!);
  const anim = useGame((s) => s.anim);
  const active = useGame((s) => s.current === index && s.phase === 'roll');

  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const marker = useRef<THREE.Mesh>(null);
  const run = useRef<{ anim: Anim; queue: THREE.Vector3[]; from: THREE.Vector3; t: number; pause: number } | null>(null);
  const placed = useRef(false);

  useEffect(() => {
    const g = group.current!;
    if (anim && anim.player === index) {
      if (run.current?.anim.id === anim.id) return;
      if (!placed.current) g.position.copy(slotOf(anim.kind === 'hop' ? anim.path[0] - 1 : player.pos, size, index, count));
      run.current = { anim, queue: anim.path.map((t) => slotOf(t, size, index, count)), from: g.position.clone(), t: 0, pause: 0 };
    } else {
      run.current = null;
      g.position.copy(slotOf(player.pos, size, index, count));
      if (body.current) body.current.rotation.set(0, 0, 0);
    }
    placed.current = true;
  }, [anim, player.pos, size, index, count]);

  useFrame(({ clock }, delta) => {
    const g = group.current;
    const r = run.current;
    if (marker.current) marker.current.position.y = 1.55 + Math.abs(Math.sin(clock.elapsedTime * 3.2)) * 0.25;
    if (body.current && !r) body.current.position.y = active ? Math.abs(Math.sin(clock.elapsedTime * 3.2)) * 0.08 : 0;
    if (!g || !r) return;
    if (!r.queue.length) {
      // arrivé : on attend un instant, puis on prévient le jeu (une seule fois)
      if (r.pause > 0 && (r.pause -= delta) <= 0) useGame.getState().animDone(r.anim.id);
      return;
    }

    const hop = r.anim.kind === 'hop';
    r.t = Math.min(1, r.t + Math.min(delta, 0.1) / (hop ? HOP_SECONDS : SLIDE_SECONDS));
    const to = r.queue[0];
    const k = hop ? r.t : ease(r.t);
    g.position.lerpVectors(r.from, to, k);
    g.position.y += Math.sin(Math.PI * k) * (hop ? 0.55 : r.anim.kind === 'ladder' ? 0.9 : 0.5);
    if (body.current) {
      body.current.position.y = 0;
      body.current.rotation.y = Math.atan2(to.x - r.from.x, to.z - r.from.z);
      body.current.rotation.z = r.anim.kind === 'snake' ? Math.sin(r.t * Math.PI * 6) * 0.35 : 0;
    }
    if (r.t >= 1) {
      r.from = r.queue.shift()!;
      r.t = 0;
      if (!r.queue.length) {
        if (body.current) body.current.rotation.set(0, 0, 0);
        r.pause = LANDING_PAUSE;
      }
    }
  });

  return (
    <group ref={group}>
      <group ref={body}>
        <Goose color={player.color} />
      </group>
      {active && (
        <mesh ref={marker} position={[0, 1.6, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.22, 0.42, 4]} />
          <meshStandardMaterial color="#ffdd00" emissive="#ffaa00" emissiveIntensity={0.6} />
        </mesh>
      )}
    </group>
  );
}
