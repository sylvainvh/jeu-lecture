import { describe, expect, it } from 'vitest';
import { ACQUIRED_WEIGHT, HISTORY_LIMIT, acquiredCount, addAttempt, isAcquired, relativeDay, sortForSheet, wordState, wordWeights } from './progress';

const child = (p: Record<string, number>) => ({ progress: Object.fromEntries(Object.entries(p).map(([k, success]) => [k, { success, fail: 0 }])) });
const words = [{ id: 'a' }, { id: 'b' }];

describe('progress', () => {
  it('un mot est acquis à partir du seuil', () => {
    expect(isAcquired(child({ a: 9 }), 'a', 10)).toBe(false);
    expect(isAcquired(child({ a: 10 }), 'a', 10)).toBe(true);
    expect(isAcquired(child({}), 'a', 10)).toBe(false);
    expect(acquiredCount(child({ a: 12, b: 3 }), words, 10)).toBe(1);
  });
  it('poids : 1 sans enfant, réduit pour un mot acquis, moyenne à plusieurs', () => {
    expect(wordWeights(words, [], 10)).toEqual({ a: 1, b: 1 });
    expect(wordWeights(words, [child({ a: 10 })], 10)).toEqual({ a: ACQUIRED_WEIGHT, b: 1 });
    expect(wordWeights(words, [child({ a: 10 }), child({})], 10).a).toBe((ACQUIRED_WEIGHT + 1) / 2);
  });

  it("l'historique est daté et plafonné", () => {
    const p = { success: 0, fail: 0 };
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) addAttempt(p, i % 2 === 0, new Date(2026, 0, 1, 12, i));
    expect(p).toMatchObject({ success: 18, fail: 17 });
    const h = (p as { history?: { t: string; ok: boolean }[] }).history!;
    expect(h).toHaveLength(HISTORY_LIMIT);
    expect(h.at(-1)).toEqual({ t: new Date(2026, 0, 1, 12, HISTORY_LIMIT + 4).toISOString(), ok: true });
  });
  it('état et tri des mots de la fiche', () => {
    const c = { progress: { a: { success: 10, fail: 0 }, b: { success: 2, fail: 1 }, c: { success: 0, fail: 3 }, d: { success: 6, fail: 0 } } };
    expect(['a', 'b', 'c', 'e'].map((id) => wordState(c, id, 10))).toEqual(['acquired', 'learning', 'learning', 'new']);
    const sorted = sortForSheet(['a', 'b', 'c', 'd', 'e'].map((id) => ({ id })), c, 10).map((w) => w.id);
    expect(sorted).toEqual(['d', 'b', 'c', 'e', 'a']);
  });
  it('date relative', () => {
    const now = new Date(2026, 10, 15, 12);
    expect(relativeDay(new Date(2026, 10, 15, 8).toISOString(), now)).toBe("aujourd'hui");
    expect(relativeDay(new Date(2026, 10, 14, 23).toISOString(), now)).toBe('hier');
    expect(relativeDay(new Date(2026, 10, 10, 12).toISOString(), now)).toBe('il y a 5 jours');
    expect(relativeDay(new Date(2026, 8, 3, 12).toISOString(), now)).toMatch(/^le 3 sept/);
  });
});
