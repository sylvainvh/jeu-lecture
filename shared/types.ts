export interface WordAudio {
  file: string;
  source: 'tts' | 'recorded';
  /**
   * Le même mot dit syllabe par syllabe (voix de synthèse seulement).
   * null : essayé, mais le découpage de la prononciation n'était pas sûr.
   */
  syllables?: string | null;
}

export interface Word {
  id: string;
  enabled: boolean;
  /** Déterminant affiché avant le mot ("un", "le", "l'"…), en violet. */
  determiner?: string;
  /** Syllabes écrites ; concaténées, elles redonnent le mot. */
  syllables: string[];
  /** Un drapeau par caractère du mot : lettre muette (noir souligné). */
  silent: boolean[];
  image?: string;
  audio?: WordAudio;
}

export type WordDraft = Omit<Word, 'id'> & { id?: string };

export interface Colors {
  a: string;
  b: string;
  determiner: string;
  silent: string;
}

export interface Settings {
  colors: Colors;
  boardSize: 20 | 30 | 40;
  /** Nombre de réussites à partir duquel un mot est considéré comme acquis. */
  acquiredAfter: number;
}

export const DEFAULT_SETTINGS: Settings = {
  colors: { a: '#d6203f', b: '#5a9a2e', determiner: '#6b3fa0', silent: '#1c1c28' },
  boardSize: 30,
  acquiredAfter: 10,
};

export interface Info {
  tts: boolean;
}

export interface WordProgress {
  success: number;
  fail: number;
}

/** Un enfant : un prénom, un code secret, et son avancement mot par mot. */
export interface Child {
  id: string;
  name: string;
  /** Code secret qui permet de retrouver l'enfant sur un autre navigateur. */
  token: string;
  createdAt: string;
  progress: Record<string, WordProgress>;
}

export interface AdminConfig {
  classCode: string;
}

export interface Picto {
  id: number;
  url: string;
}

export const wordText = (w: Pick<Word, 'syllables'>) => w.syllables.join('');

/** Texte complet, déterminant compris ("un squelette", "l'hiver"). */
export function fullText(w: Pick<Word, 'syllables' | 'determiner'>): string {
  const det = w.determiner?.trim();
  if (!det) return wordText(w);
  return det + (/['’]$/.test(det) ? '' : ' ') + wordText(w);
}
