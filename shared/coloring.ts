import type { Word } from './types';
import { fullText } from './types';

export type RunKind = 'determiner' | 'a' | 'b' | 'silent';
export interface Run {
  text: string;
  kind: RunKind;
}

const isLetter = (c: string) => /\p{L}/u.test(c);

/**
 * Découpe un mot en tronçons de couleur.
 * - déterminant : couleur « déterminant »
 * - lettre muette : couleur « muette » (soulignée)
 * - sinon couleur de la syllabe, en alternance a / b. Une syllabe sans aucune
 *   lettre prononcée ne fait pas avancer l'alternance.
 */
export function colorRuns(word: Pick<Word, 'determiner' | 'syllables' | 'silent'>): Run[] {
  const runs: Run[] = [];
  const push = (text: string, kind: RunKind) => {
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) last.text += text;
    else runs.push({ text, kind });
  };

  const full = fullText(word);
  const prefix = full.slice(0, full.length - word.syllables.join('').length);
  if (prefix) push(prefix, 'determiner');

  let offset = 0;
  let spoken = 0;
  for (const syl of word.syllables) {
    const chars = [...syl];
    const hasSpoken = chars.some((c, i) => isLetter(c) && !word.silent[offset + i]);
    const kind: RunKind = spoken % 2 === 0 ? 'a' : 'b';
    chars.forEach((c, i) => push(c, word.silent[offset + i] && isLetter(c) ? 'silent' : kind));
    offset += chars.length;
    if (hasSpoken) spoken++;
  }
  return runs;
}
