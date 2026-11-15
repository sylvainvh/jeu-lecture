import { useState, type ReactNode } from 'react';
import { acquiredCount, lastAttempt, relativeDay, sortForSheet, successCount, wordState, type WordState } from '../../../shared/progress';
import type { Child, Settings, Word } from '../../../shared/types';
import { imageUrl } from '../api';
import { WordText } from './WordText';

type Filter = 'all' | WordState;
const FILTERS: [Filter, string][] = [
  ['all', 'Tous'],
  ['learning', 'En cours'],
  ['acquired', 'Acquis'],
  ['new', 'Pas commencés'],
];
/** Nombre de réponses récentes montrées sous forme de pastilles. */
const DOTS = 12;

interface Props {
  child: Child;
  words: Word[];
  settings: Settings;
  /** Boutons propres à l'administration (marquer acquis, remettre à zéro). */
  actions?: (word: Word, success: number) => ReactNode;
}

/** La fiche d'un enfant : tous les mots, leur avancement et les dernières réponses. */
export function ChildProgress({ child, words, settings, actions }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const target = settings.acquiredAfter;
  const state = (w: Word) => wordState(child, w.id, target);
  const acquired = acquiredCount(child, words, target);
  const shown = sortForSheet(words, child, target).filter((w) => filter === 'all' || state(w) === filter);

  return (
    <div className="sheet">
      <div className="sheet-summary">
        <b>★ {acquired} mot{acquired > 1 ? 's' : ''} acquis sur {words.length}</b>
        <div className="bar big" role="img" aria-label={`${acquired} mots acquis sur ${words.length}`}>
          <i style={{ width: `${words.length ? (acquired / words.length) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="filters">
        {FILTERS.map(([f, label]) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {label} <span>{f === 'all' ? words.length : words.filter((w) => state(w) === f).length}</span>
          </button>
        ))}
      </div>

      <ul className="sheet-words">
        {shown.map((w) => {
          const ok = successCount(child, w.id);
          const p = child.progress[w.id];
          const last = lastAttempt(child, w.id);
          const done = ok >= target;
          return (
            <li key={w.id} className={done ? 'acquired' : ''}>
              <div className="thumb">{w.image ? <img src={imageUrl(w.image)} alt="" loading="lazy" /> : <span>?</span>}</div>
              <div className="sheet-word">
                <WordText word={w} colors={settings.colors} font="script" />
                <div className="sheet-line">
                  <div className="bar"><i style={{ width: `${Math.min(1, ok / target) * 100}%` }} /></div>
                  <span className="count">{done ? `★ acquis · ${ok} réussites` : `${ok} / ${target}`}</span>
                </div>
                <div className="sheet-line">
                  {p?.history?.length ? (
                    <span className="dots" role="img" aria-label="Dernières réponses, de la plus ancienne à la plus récente">
                      {p.history.slice(-DOTS).map((a, i) => (
                        <i key={i} className={a.ok ? 'ok' : 'ko'} title={`${a.ok ? 'Réussi' : 'Pas réussi'} ${relativeDay(a.t)}`} />
                      ))}
                    </span>
                  ) : null}
                  <span className="hint">
                    {last ? `lu ${relativeDay(last.t)}` : p && (p.success || p.fail) ? `${p.fail} échec${p.fail > 1 ? 's' : ''}` : 'pas encore lu'}
                  </span>
                </div>
              </div>
              {actions && <div className="sheet-actions">{actions(w, ok)}</div>}
            </li>
          );
        })}
        {shown.length === 0 && <li className="empty">Aucun mot ici.</li>}
      </ul>
      <p className="hint legend"><i className="dot-legend ok" /> réussi <i className="dot-legend ko" /> pas réussi — les pastilles vont de la réponse la plus ancienne à la plus récente.</p>
    </div>
  );
}
