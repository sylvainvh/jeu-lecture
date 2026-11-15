import type { Child, Word, WordProgress } from './types';

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

/** Nombre de réponses gardées par mot dans l'historique. */
export const HISTORY_LIMIT = 30;

/** Enregistre une réponse : compteur + historique daté, plafonné. */
export function addAttempt(p: WordProgress, ok: boolean, at: Date = new Date()): WordProgress {
  if (ok) p.success++;
  else p.fail++;
  p.history = [...(p.history ?? []), { t: at.toISOString(), ok }].slice(-HISTORY_LIMIT);
  return p;
}

export type WordState = 'learning' | 'new' | 'acquired';

export function wordState(child: Progress, wordId: string, threshold: number): WordState {
  const p = child.progress[wordId];
  if ((p?.success ?? 0) >= threshold) return 'acquired';
  return p && (p.success > 0 || p.fail > 0) ? 'learning' : 'new';
}

const STATE_ORDER: WordState[] = ['learning', 'new', 'acquired'];

/** Ordre de la fiche : mots en cours (les plus avancés d'abord), pas commencés, puis acquis. */
export function sortForSheet<W extends Pick<Word, 'id'>>(words: W[], child: Progress, threshold: number): W[] {
  return [...words].sort((a, b) => {
    const d = STATE_ORDER.indexOf(wordState(child, a.id, threshold)) - STATE_ORDER.indexOf(wordState(child, b.id, threshold));
    return d || successCount(child, b.id) - successCount(child, a.id);
  });
}

export const lastAttempt = (child: Progress, wordId: string) => child.progress[wordId]?.history?.at(-1);

/** « aujourd'hui », « hier », « il y a 5 jours », puis « le 3 nov. ». */
export function relativeDay(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((midnight(now) - midnight(d)) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days <= 30) return `il y a ${days} jours`;
  return `le ${d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })}`;
}
