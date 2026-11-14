import * as THREE from 'three';
import { colorRuns } from '../../../shared/coloring';
import type { Colors, Word } from '../../../shared/types';

const W = 512;
const H = 368;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Dessus d'une case : numéro + mot coloré en écriture script. */
export function makeTileTexture(index: number, size: number, word: Word | null, colors: Colors): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const special = index === 0 ? 'Départ' : index === size - 1 ? 'Arrivée' : null;

  // numéro de la case
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(60, 60, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a4063';
  ctx.font = '600 54px "Fredoka Variable", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(special ? (index === 0 ? '▶' : '★') : String(index), 60, 64);

  if (special) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 84px "Fredoka Variable", sans-serif';
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(60,40,90,0.55)';
    ctx.strokeText(special, W / 2, 236);
    ctx.fillText(special, W / 2, 236);
  } else if (word) {
    // étiquette blanche, comme une carte-mot
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, 22, 150, W - 44, 190, 28);
    ctx.fill();

    const runs = colorRuns(word);
    const text = runs.map((r) => r.text).join('');
    let px = 96;
    ctx.font = `${px}px Andika, sans-serif`;
    const max = W - 84;
    const width = ctx.measureText(text).width;
    if (width > max) {
      px = Math.floor((px * max) / width);
      ctx.font = `${px}px Andika, sans-serif`;
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const baseline = 245 + px * 0.3;
    let x = (W - ctx.measureText(text).width) / 2;
    for (const r of runs) {
      const w = ctx.measureText(r.text).width;
      ctx.fillStyle = colors[r.kind];
      ctx.fillText(r.text, x, baseline);
      if (r.kind === 'silent') ctx.fillRect(x, baseline + px * 0.16, w, Math.max(4, px * 0.07));
      x += w;
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Attend que les polices utilisées sur les cases soient chargées. */
export function loadTileFonts(): Promise<unknown> {
  return Promise.all([
    document.fonts.load('96px Andika', 'châtaigne'),
    document.fonts.load('600 40px "Fredoka Variable"', 'Départ 12'),
  ]).catch(() => undefined);
}
