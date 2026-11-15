import { useLayoutEffect, useRef } from 'react';
import type { Colors, Word } from '../../../shared/types';
import { imageUrl } from '../api';
import { speak } from '../speech';
import { WordText } from './WordText';

interface Props {
  word: Word;
  colors: Colors;
  /** Enfant inscrit : le parent indique si le mot a été lu. Absent pour un invité. */
  score?: { success: number; target: number };
  /** Carte retournée (image visible). Piloté par le parent, qui gère aussi les raccourcis clavier. */
  flipped: boolean;
  onFlip: () => void;
  onResult: (success: boolean | null) => void;
}

/** Rappel de la touche du clavier, visible seulement sur un appareil à clavier. */
export const Key = ({ children }: { children: string }) => <kbd className="key">{children}</kbd>;

/** La carte-mot en grand : recto les deux écritures, verso l'image (bouton « Voir l'image »). */
export function WordCard({ word, colors, score, flipped, onFlip, onResult }: Props) {
  const front = useRef<HTMLDivElement>(null);

  // un mot long est rétréci pour tenir en entier dans la carte, jamais coupé
  useLayoutEffect(() => {
    const face = front.current;
    if (!face) return;
    const fit = () => {
      const room = face.clientWidth * 0.9;
      for (const el of face.querySelectorAll<HTMLElement>('.wt')) {
        el.style.transform = '';
        const width = el.offsetWidth;
        if (width > room) el.style.transform = `scale(${room / width})`;
      }
    };
    fit();
    document.fonts.ready.then(fit);
    const observer = new ResizeObserver(fit);
    observer.observe(face);
    return () => observer.disconnect();
  }, [word]);

  return (
    <div className="overlay">
      <div className="card-wrap">
        <div className={`flip ${flipped ? 'flipped' : ''}`}>
          <div className="face front" ref={front}>
            <WordText word={word} colors={colors} font="script" />
            <WordText word={word} colors={colors} font="cursive" />
          </div>
          <div className="face back">
            {word.image ? <img src={imageUrl(word.image)} alt="" draggable={false} /> : <span className="no-image">Pas d'image pour ce mot</span>}
          </div>
        </div>
        <div className="card-actions">
          <button className="btn round keyed" onClick={() => speak(word)} aria-label="Écouter le mot">🔊<Key>Espace</Key></button>
          {word.audio?.syllables && (
            <button className="btn round keyed" onClick={() => speak(word, true)} aria-label="Écouter le mot syllabe par syllabe" title="Syllabe par syllabe">🐢<Key>S</Key></button>
          )}
          <button className="btn keyed" onClick={onFlip}>{flipped ? '↩ Voir le mot' : "🖼 Voir l'image"}<Key>I</Key></button>
          {score ? (
            <>
              <span className="score" title="Réussites pour ce mot">
                {score.success >= score.target ? '★ acquis' : `${score.success} / ${score.target}`}
              </span>
              <button className="btn thumb down keyed" onClick={() => onResult(false)} aria-label="Pas réussi">👎<Key>↓</Key></button>
              <button className="btn thumb up keyed" onClick={() => onResult(true)} aria-label="Réussi">👍<Key>↑</Key></button>
            </>
          ) : (
            <button className="btn green keyed" onClick={() => onResult(null)}>Continuer ➜<Key>Entrée</Key></button>
          )}
        </div>
      </div>
    </div>
  );
}
