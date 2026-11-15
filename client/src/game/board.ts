import type { Word } from '../../../shared/types';

export interface Link {
  from: number;
  to: number;
  type: 'ladder' | 'snake';
}

export interface Board {
  size: number;
  /** Nombre de cases par rangée (plateau plus étroit sur un écran en hauteur). */
  cols: number;
  /** Mot de chaque case ; null pour le départ, l'arrivée ou s'il n'y a aucun mot. */
  tiles: (Word | null)[];
  links: Link[];
}
export type Layout = Pick<Board, 'size' | 'cols'>;

export const TILE_W = 2.5;
export const TILE_D = 1.9;
export const STEP_H = 0.35;

export const columnsFor = (size: number, portrait: boolean) =>
  portrait ? (size <= 20 ? 4 : 5) : size <= 20 ? 5 : size <= 30 ? 6 : 8;
export const rowsOf = (l: Layout) => Math.ceil(l.size / l.cols);
export const rowOf = (i: number, l: Layout) => Math.floor(i / l.cols);
/** Colonne de la case i : le chemin serpente, une rangée sur deux est inversée. */
export const colOf = (i: number, l: Layout) => (rowOf(i, l) % 2 === 0 ? i % l.cols : l.cols - 1 - (i % l.cols));

/** Centre du dessus de la case i : chemin en serpentin, en terrasses qui montent. */
export function tilePosition(i: number, l: Layout): [number, number, number] {
  const row = rowOf(i, l);
  return [(colOf(i, l) - (l.cols - 1) / 2) * TILE_W, 0.3 + row * STEP_H, ((rowsOf(l) - 1) / 2 - row) * TILE_D];
}

function shuffle<T>(a: T[], rng: () => number): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

const randInt = (min: number, max: number, rng: () => number) => min + Math.floor(rng() * (max - min + 1));

/**
 * Échelles et serpents : jamais sur le départ ni l'arrivée, aucune case commune
 * (donc pas d'enchaînement), et plutôt « verticaux » pour ne pas barrer tout le plateau.
 */
export function generateLinks(l: Layout, rng: () => number = Math.random): Link[] {
  const { size } = l;
  const count = Math.min(3, Math.max(1, Math.round(size / 10)));
  const used = new Set<number>();
  const links: Link[] = [];
  const add = (type: Link['type']) => {
    for (let attempt = 0; attempt < 600; attempt++) {
      const low = randInt(1, size - 5, rng);
      const high = randInt(low + 3, Math.min(size - 2, low + l.cols * 3), rng);
      const rows = rowOf(high, l) - rowOf(low, l);
      if (used.has(low) || used.has(high) || rows < 1 || rows > 3 || Math.abs(colOf(low, l) - colOf(high, l)) > 1) continue;
      used.add(low).add(high);
      links.push(type === 'ladder' ? { type, from: low, to: high } : { type, from: high, to: low });
      return;
    }
  };
  for (let k = 0; k < count; k++) {
    add('ladder');
    add('snake');
  }
  return links;
}

/**
 * `weights` : probabilité qu'un mot entre dans chaque tour de sac (1 par défaut).
 * Les mots non acquis sortent donc tous, les mots acquis plus rarement.
 */
export function generateBoard(
  words: Word[],
  size: number,
  cols: number,
  weights: Record<string, number> = {},
  links = true,
  rng: () => number = Math.random,
): Board {
  const pool = words.filter((w) => w.enabled);
  const tiles: (Word | null)[] = Array(size).fill(null);
  let bag: Word[] = [];
  let previous: Word | null = null;
  const refill = () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      bag = shuffle(pool.filter((w) => rng() < (weights[w.id] ?? 1)), rng);
      if (!bag.length) bag = shuffle(pool, rng); // tout est acquis : tirage uniforme
      // évite deux fois le même mot à la suite d'un tirage au suivant
      if (bag.length > 1 && bag[bag.length - 1] === previous) bag.reverse();
      if (bag[bag.length - 1] !== previous || pool.length === 1) return;
    }
  };
  for (let i = 1; i < size - 1 && pool.length; i++) {
    if (!bag.length) refill();
    previous = bag.pop()!;
    tiles[i] = previous;
  }
  return { size, cols, tiles, links: links ? generateLinks({ size, cols }, rng) : [] };
}
