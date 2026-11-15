import { RoundedBox } from '@react-three/drei';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { Colors } from '../../../shared/types';
import { TILE_D, TILE_W, tilePosition, type Board as BoardData, type Layout, type Link } from '../game/board';
import { loadTileFonts, makeTileTexture } from './tileTexture';

const PASTELS = ['#ffd166', '#ff9eb5', '#8fd3ff', '#b5e48c', '#cdb4f6', '#ffb97a'];
const SNAKE_COLORS = ['#8e44d6', '#e0569b', '#1fa3a3', '#e07b1f'];
const UP = new THREE.Vector3(0, 1, 0);

function Tile({ index, board, colors, showWord }: { index: number; board: BoardData; colors: Colors; showWord: boolean }) {
  const [x, top, z] = tilePosition(index, board);
  const word = board.tiles[index];
  const texture = useMemo(() => makeTileTexture(index, board.size, word, colors, showWord), [index, board.size, word, colors, showWord]);
  useEffect(() => () => texture.dispose(), [texture]);
  const special = index === 0 || index === board.size - 1;
  const color = index === 0 ? '#43c59e' : index === board.size - 1 ? '#f4b400' : PASTELS[index % PASTELS.length];
  const w = TILE_W - 0.14;
  const d = TILE_D - 0.14;
  return (
    <group position={[x, 0, z]}>
      <RoundedBox args={[w, top + 0.4, d]} radius={0.1} smoothness={3} position={[0, top / 2 - 0.2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.75} />
      </RoundedBox>
      <mesh position={[0, top + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w - 0.16, d - 0.16]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      {special && index > 0 && <Flag y={top} />}
    </group>
  );
}

function Flag({ y }: { y: number }) {
  return (
    <group position={[0.85, y, -0.55]}>
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 1.6, 8]} />
        <meshStandardMaterial color="#7a5230" />
      </mesh>
      <mesh position={[0.32, 1.35, 0]} castShadow>
        <boxGeometry args={[0.6, 0.4, 0.03]} />
        <meshStandardMaterial color="#e63946" />
      </mesh>
    </group>
  );
}

const anchor = (i: number, l: Layout, side: number) => {
  const [x, y, z] = tilePosition(i, l);
  return new THREE.Vector3(x + side * 0.92, y, z + 0.1);
};

function Ladder({ link, layout }: { link: Link; layout: Layout }) {
  const { mid, quat, length } = useMemo(() => {
    const a = anchor(link.from, layout, 1).setY(tilePosition(link.from, layout)[1] + 0.05);
    const b = anchor(link.to, layout, 1).setY(tilePosition(link.to, layout)[1] + 0.3);
    const dir = b.clone().sub(a);
    return {
      mid: a.clone().add(b).multiplyScalar(0.5),
      length: dir.length(),
      quat: new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()),
    };
  }, [link, layout]);
  const rungs = Math.max(2, Math.floor(length / 0.42));
  return (
    <group position={mid} quaternion={quat}>
      {[-0.2, 0.2].map((x) => (
        <mesh key={x} position={[x, 0, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.055, length, 8]} />
          <meshStandardMaterial color="#9c5a22" roughness={0.6} />
        </mesh>
      ))}
      {Array.from({ length: rungs }, (_, k) => (
        <mesh key={k} position={[0, -length / 2 + ((k + 0.5) * length) / rungs, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.42, 8]} />
          <meshStandardMaterial color="#d99a4e" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Snake({ link, layout, color }: { link: Link; layout: Layout; color: string }) {
  const { geometry, head, headQuat, tail } = useMemo(() => {
    const a = anchor(link.from, layout, -1); // tête (case haute)
    const b = anchor(link.to, layout, -1); // queue (case basse)
    const dir = b.clone().sub(a);
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const n = 14;
    const waves = Math.max(2, Math.round(dir.length() / 2.2));
    const pts = Array.from({ length: n + 1 }, (_, k) => {
      const t = k / n;
      const p = a.clone().lerp(b, t);
      p.addScaledVector(side, Math.sin(t * Math.PI * waves) * 0.3 * Math.sin(Math.PI * Math.min(1, t * 1.4 + 0.15)));
      p.y += 0.14 + Math.sin(t * Math.PI) * 0.45;
      return p;
    });
    const curve = new THREE.CatmullRomCurve3(pts);
    const tangent = curve.getTangent(0).negate();
    return {
      geometry: new THREE.TubeGeometry(curve, 80, 0.12, 10),
      head: pts[0],
      tail: pts[n],
      headQuat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent.setY(0).normalize()),
    };
  }, [link, layout]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={tail} castShadow>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <group position={head} quaternion={headQuat}>
        <mesh scale={[1, 0.8, 1.25]} castShadow>
          <sphereGeometry args={[0.22, 20, 16]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
        {[-0.1, 0.1].map((x) => (
          <group key={x} position={[x, 0.11, 0.14]}>
            <mesh>
              <sphereGeometry args={[0.065, 12, 12]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0, 0.01, 0.045]}>
              <sphereGeometry args={[0.032, 10, 10]} />
              <meshStandardMaterial color="#111111" />
            </mesh>
          </group>
        ))}
        <mesh position={[0, -0.03, 0.34]}>
          <boxGeometry args={[0.04, 0.012, 0.2]} />
          <meshStandardMaterial color="#e63946" />
        </mesh>
      </group>
    </group>
  );
}

export function Board({ board, colors, showWords = true }: { board: BoardData; colors: Colors; showWords?: boolean }) {
  const [fonts, setFonts] = useState(false);
  useEffect(() => {
    loadTileFonts().then(() => setFonts(true));
  }, []);
  let snake = 0;
  return (
    <group>
      {/* la clé force le redessin des étiquettes quand les polices sont prêtes */}
      {board.tiles.map((_, i) => (
        <Tile key={`${i}-${fonts}`} index={i} board={board} colors={colors} showWord={showWords} />
      ))}
      {board.links.map((l) =>
        l.type === 'ladder' ? (
          <Ladder key={l.from} link={l} layout={board} />
        ) : (
          <Snake key={l.from} link={l} layout={board} color={SNAKE_COLORS[snake++ % SNAKE_COLORS.length]} />
        ),
      )}
    </group>
  );
}
