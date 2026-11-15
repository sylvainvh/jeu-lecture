import { useState } from 'react';
import { go } from '../App';
import { acquiredCount } from '../../../shared/progress';
import { api } from '../api';
import { useData } from '../data';

/** Les enfants de ce navigateur : inscription, reprise par code, retrait. */
export function Profiles({ welcome = false }: { welcome?: boolean }) {
  const { children, words, settings, refreshChildren } = useData();
  const [name, setName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [token, setToken] = useState('');
  const [mode, setMode] = useState<'new' | 'code'>('new');
  const [shown, setShown] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = words.filter((w) => w.enabled);

  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    setBusy(true);
    try {
      await fn();
      // première inscription : on reste sur cette page pour pouvoir ajouter un frère ou une sœur
      if (welcome) go('/enfants');
      await refreshChildren();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue');
    } finally {
      setBusy(false);
    }
  };
  const create = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.createChild(name, classCode);
      setName('');
    });
  };
  const claim = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.claimChild(token);
      setToken('');
    });
  };
  const forget = (id: string, childName: string) =>
    confirm(`Retirer ${childName} de cet appareil ?\n\nSon avancement est conservé, mais il faudra son code pour le retrouver : note-le d'abord.`) &&
    run(() => api.forgetChild(id));

  return (
    <div className="page center">
      <div className="panel profiles">
        {welcome && children.length === 0 ? (
          <>
            <div className="goose-logo small">🪿</div>
            <h2>Bienvenue !</h2>
            <p className="hint">Pour commencer, inscris l'enfant qui va jouer. Son avancement sera retenu d'une partie à l'autre.</p>
          </>
        ) : (
          <h2>Les enfants</h2>
        )}

        {children.length > 0 && (
          <ul className="child-list">
            {children.map((c) => (
              <li key={c.id}>
                <div className="row between">
                  <b>{c.name}</b>
                  <span className="hint">
                    ★ {acquiredCount(c, active, settings.acquiredAfter)} / {active.length} mots acquis
                  </span>
                </div>
                <div className="row wrap">
                  <button className="btn small" onClick={() => go(`/enfants/${c.id}`)}>📈 Voir les mots</button>
                  <button className="btn small ghost" onClick={() => setShown(shown === c.id ? null : c.id)}>
                    {shown === c.id ? 'Masquer le code' : '🔑 Voir le code'}
                  </button>
                  <button className="btn small ghost" onClick={() => forget(c.id, c.name)} disabled={busy}>Retirer de cet appareil</button>
                </div>
                {shown === c.id && (
                  <p className="code-box">
                    <code>{c.token}</code>
                    <span className="hint">Note ce code : il permet de retrouver {c.name} sur un autre appareil ou un autre navigateur.</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="tabs">
          <button className={mode === 'new' ? 'on' : ''} onClick={() => (setMode('new'), setError(''))}>Inscrire un enfant</button>
          <button className={mode === 'code' ? 'on' : ''} onClick={() => (setMode('code'), setError(''))}>J'ai déjà un code</button>
        </div>

        {mode === 'new' ? (
          <form onSubmit={create}>
            <label className="field">
              <span>Prénom de l'enfant</span>
              <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              <span>Code de la classe (communiqué par l'administrateur du jeu)</span>
              <input value={classCode} maxLength={20} autoCapitalize="characters" autoComplete="off" onChange={(e) => setClassCode(e.target.value)} />
            </label>
            <p className="disclaimer">
              En inscrivant un enfant, vous acceptez que l'administrateur du jeu ait accès à son prénom, à ses mots et à son avancement.
            </p>
            <div className="row end">
              <button className="btn green" disabled={busy || !name.trim() || !classCode.trim()}>Inscrire</button>
            </div>
          </form>
        ) : (
          <form onSubmit={claim}>
            <label className="field">
              <span>Code de l'enfant (affiché sur l'appareil où il a été inscrit)</span>
              <input value={token} maxLength={20} placeholder="XXXX-XXXX-XXXX" autoCapitalize="characters" autoComplete="off" onChange={(e) => setToken(e.target.value)} />
            </label>
            <div className="row end">
              <button className="btn green" disabled={busy || !token.trim()}>Retrouver l'enfant</button>
            </div>
          </form>
        )}
        {error && <p className="warn">{error}</p>}

        <div className="row between footer-row">
          {children.length > 0 ? (
            <button className="btn ghost" onClick={() => go('/')}>← Retour</button>
          ) : (
            <button className="link" onClick={() => go('/admin')}>Administration</button>
          )}
          <button className={`btn ${children.length ? 'green' : 'ghost'}`} onClick={() => go('/jouer')}>
            {children.length ? '▶ Jouer' : 'Jouer sans inscription'}
          </button>
        </div>
      </div>
    </div>
  );
}
