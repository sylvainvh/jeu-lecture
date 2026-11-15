import { describe, expect, it } from 'vitest';
import type { Word } from '../../../shared/types';
import { colOf, columnsFor, generateBoard, rowOf, tilePosition } from './board';

const word = (id: string, enabled = true): Word => ({ id, enabled, syllables: [id], silent: [...id].map(() => false) });

describe('generateBoard', () => {
  it.each([[20, false], [30, false], [40, false], [20, true], [30, true], [40, true]])('plateau de %i cases valide (portrait : %s)', (size, portrait) => {
    const cols = columnsFor(size, portrait);
    for (let n = 0; n < 200; n++) {
      const b = generateBoard([word('a'), word('b'), word('c'), word('x', false)], size, cols);
      expect(b.tiles).toHaveLength(size);
      expect(b.tiles[0]).toBeNull();
      expect(b.tiles[size - 1]).toBeNull();
      b.tiles.slice(1, -1).forEach((t, i, all) => {
        expect(t).not.toBeNull();
        expect(t!.enabled).toBe(true);
        if (i > 0) expect(t).not.toBe(all[i - 1]);
      });
      const ends = b.links.flatMap((l) => [l.from, l.to]);
      expect(new Set(ends).size).toBe(ends.length); // pas d'enchaînement
      expect(b.links.length).toBe(2 * Math.min(3, Math.round(size / 10)));
      for (const l of b.links) {
        expect(l.from).toBeGreaterThan(0);
        expect(l.from).toBeLessThan(size - 1);
        expect(l.to).toBeGreaterThan(0);
        expect(l.to).toBeLessThan(size - 1);
        if (l.type === 'ladder') expect(l.to).toBeGreaterThan(l.from);
        else expect(l.to).toBeLessThan(l.from);
        expect(rowOf(l.from, b)).not.toBe(rowOf(l.to, b));
        expect(Math.abs(colOf(l.from, b) - colOf(l.to, b))).toBeLessThanOrEqual(1);
      }
    }
  });

  it('un mot acquis sort nettement moins souvent, les autres sont tous présents', () => {
    const words = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => word(id));
    const count: Record<string, number> = {};
    for (let n = 0; n < 1000; n++) {
      const b = generateBoard(words, 30, 6, { a: 0.25 });
      const seen = new Set(b.tiles.filter(Boolean).map((t) => t!.id));
      for (const id of ['b', 'c', 'd', 'e', 'f']) expect(seen.has(id)).toBe(true);
      for (const t of b.tiles) if (t) count[t.id] = (count[t.id] ?? 0) + 1;
    }
    expect(count.a).toBeLessThan(count.b * 0.45);
    expect(count.a).toBeGreaterThan(0);
  });

  it('tout est acquis : le plateau reste rempli', () => {
    const b = generateBoard([word('a'), word('b')], 20, 5, { a: 0, b: 0 });
    expect(b.tiles.slice(1, -1).every(Boolean)).toBe(true);
  });

  it('sans serpents ni échelles', () => {
    expect(generateBoard([word('a')], 30, 6, {}, false).links).toEqual([]);
  });

  it('fonctionne sans aucun mot', () => {
    expect(generateBoard([], 20, 5).tiles.every((t) => t === null)).toBe(true);
  });

  it('les cases voisines se touchent (serpentin)', () => {
    for (let i = 0; i + 1 < 30; i++) {
      const [x1, , z1] = tilePosition(i, { size: 30, cols: 6 });
      const [x2, , z2] = tilePosition(i + 1, { size: 30, cols: 6 });
      expect(Math.abs(x1 - x2) + Math.abs(z1 - z2)).toBeLessThan(2.6);
    }
  });
});
