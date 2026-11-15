import { useEffect } from 'react';
import { go } from '../App';
import { useData } from '../data';
import { ChildProgress } from '../ui/ChildProgress';

/** Fiche d'un enfant, pour ses parents : seuls les enfants de ce navigateur sont visibles. */
export function ChildSheet({ id }: { id: string }) {
  const { children, words, settings, refreshChildren } = useData();
  const child = children.find((c) => c.id === id);

  useEffect(() => {
    refreshChildren().catch(() => undefined);
  }, [refreshChildren]);

  return (
    <div className="page parents">
      <div className="panel wide-panel">
        <div className="row between wrap">
          <h2>{child ? child.name : 'Enfant introuvable'}</h2>
          <button className="btn ghost" onClick={() => go('/enfants')}>← Retour</button>
        </div>
        {child ? (
          <ChildProgress child={child} words={words.filter((w) => w.enabled)} settings={settings} />
        ) : (
          <p className="hint">Cet enfant n'est pas enregistré sur cet appareil.</p>
        )}
      </div>
    </div>
  );
}
