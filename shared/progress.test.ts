import { describe, expect, it } from 'vitest';
import { ACQUIRED_WEIGHT, acquiredCount, isAcquired, wordWeights } from './progress';

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
});
