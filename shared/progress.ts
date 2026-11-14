import type { Child, Word } from './types';

/** Un mot acquis reste dans le jeu, mais sort environ quatre fois moins souvent. */
export const ACQUIRED_WEIGHT = 0.25;

type Progress = Pick<Child, 'progress'>;

export const successCount = (child: Progress, wordId: string) => child.progress[wordId]?.success ?? 0;
export const isAcquired = (child: Progress, wordId: string, threshold: number) => successCount(child, wordId) >= threshold;
export const acquiredCount = (child: Progress, words: Pick<Word, 'id'>[], threshold: number) =>
  words.filter((w) => isAcquired(child, w.id, threshold)).length;

/**
 * Poids de tirage de chaque mot pour une partie : 1 si le mot n'est pas acquis,
 * ACQUIRED_WEIGHT s'il l'est, en moyenne sur les enfants qui jouent.
 */
export function wordWeights(words: Pick<Word, 'id'>[], children: Progress[], threshold: number): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const w of words) {
    weights[w.id] = children.length
      ? children.reduce((sum, c) => sum + (isAcquired(c, w.id, threshold) ? ACQUIRED_WEIGHT : 1), 0) / children.length
      : 1;
  }
  return weights;
}
