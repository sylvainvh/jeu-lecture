import { colorRuns } from '../../../shared/coloring';
import type { Colors, Word } from '../../../shared/types';

export const runColor = (kind: ReturnType<typeof colorRuns>[number]['kind'], c: Colors) => c[kind];

interface Props {
  word: Pick<Word, 'determiner' | 'syllables' | 'silent'>;
  colors: Colors;
  font: 'script' | 'cursive';
  className?: string;
}

/** Le mot coloré : syllabes en alternance, déterminant, lettres muettes soulignées. */
export function WordText({ word, colors, font, className = '' }: Props) {
  return (
    <span className={`wt wt-${font} ${className}`}>
      {colorRuns(word).map((r, i) => (
        <span key={i} className={r.kind === 'silent' ? 'wt-silent' : undefined} style={{ color: runColor(r.kind, colors) }}>
          {r.text}
        </span>
      ))}
    </span>
  );
}
