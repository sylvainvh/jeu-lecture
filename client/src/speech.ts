import { fullText, type Word } from '../../shared/types';
import { audioUrl } from './api';

let current: HTMLAudioElement | null = null;

function speakBrowser(text: string) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  u.rate = 0.85;
  const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('fr'));
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}

/**
 * Lit le mot : son enregistré ou synthétisé par le serveur, sinon voix du navigateur.
 * `bySyllable` : version dite syllabe par syllabe, quand elle existe.
 */
export function speak(word: Pick<Word, 'audio' | 'syllables' | 'determiner'>, bySyllable = false) {
  current?.pause();
  const file = bySyllable ? word.audio?.syllables : word.audio?.file;
  if (!file) return speakBrowser(fullText(word));
  current = new Audio(audioUrl(file));
  current.play().catch(() => speakBrowser(fullText(word)));
}

export function playBlob(blob: Blob) {
  current?.pause();
  current = new Audio(URL.createObjectURL(blob));
  current.play().catch(() => undefined);
}
