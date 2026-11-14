import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type { Colors } from '../../../shared/types';
import { TILE_D, TILE_W, rowsOf, type Board as BoardData, type Layout } from '../game/board';
import { Board } from './Board';
import { Pawn } from './Pawn';
import { Scenery } from './Scenery';

const FOV = 38;

/** Cadre tout le plateau, quelle que soit la forme de l'écran. */
function CameraRig({ layout }: { layout: Layout }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: { set: (x: number, y: number, z: number) => void }; update: () => void } | null;
  const aspect = useThree((s) => s.size.width / s.size.height);
  const height = useThree((s) => s.size.height);
  useEffect(() => {
    const halfW = (layout.cols * TILE_W) / 2 + 0.8;
    const halfD = (rowsOf(layout) * TILE_D) / 2 + 0.6;
    // place réservée en bas de l'écran pour le dé et le message du tour
    const reserved = Math.min(0.42, 215 / height);
    const tan = Math.tan((FOV * Math.PI) / 360);
    const angle = (54 * Math.PI) / 180;
    const dist = Math.max(halfW / (tan * aspect), halfD / (tan * (1 - reserved))) + 2.5;
    // viser un point devant le plateau le fait remonter à l'écran, au-dessus du dé
    const used = halfD / (tan * dist);
    const shift = Math.max(0.1, used - (1 - 2 * reserved));
    const tz = (shift * dist * tan) / Math.sin(angle);
    camera.position.set(0, 1 + Math.sin(angle) * dist, tz + Math.cos(angle) * dist);
    camera.lookAt(0, 1, tz);
    controls?.target.set(0, 1, tz);
    controls?.update();
  }, [camera, controls, aspect, height, layout]);
  return null;
}

export function Scene({ board, colors, players }: { board: BoardData; colors: Colors; players: number }) {
  return (
    <Canvas shadows camera={{ fov: FOV, near: 0.5, far: 300 }} dpr={[1, 2]}>
      <color attach="background" args={['#aee3ff']} />
      <fog attach="fog" args={['#aee3ff', 60, 160]} />
      <ambientLight intensity={1.6} />
      <directionalLight
        position={[9, 18, 10]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0004}
      />
      <CameraRig layout={board} />
      <OrbitControls
        makeDefault
        enablePan={false}
        minPolarAngle={0.15}
        maxPolarAngle={1.3}
        minDistance={7}
        maxDistance={60}
        minAzimuthAngle={-1.1}
        maxAzimuthAngle={1.1}
      />
      <Scenery layout={board} />
      <Board board={board} colors={colors} />
      {Array.from({ length: players }, (_, i) => (
        <Pawn key={i} index={i} />
      ))}
    </Canvas>
  );
}
