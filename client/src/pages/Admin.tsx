import { useEffect, useState } from 'react';
import { go } from '../App';
import { acquiredCount } from '../../../shared/progress';
import { DEFAULT_SETTINGS, type Child, type Settings, type Word } from '../../../shared/types';
import { api, imageUrl } from '../api';
import { useData } from '../data';
import { speak } from '../speech';
import { ChildProgress } from '../ui/ChildProgress';
import { WordEditor } from '../ui/WordEditor';
import { WordText } from '../ui/WordText';

function Login({ onOk }: { onOk: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.adminLogin(password);
      onOk();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible');
    }
  };
  return (
    <div className="page center">
      <form className="panel" onSubmit={submit}>
        <h2>Administration</h2>
        <label className="field">
          <span>Mot de passe</span>
          <input autoFocus type="password" value={password} onChange={(e) => (setPassword(e.target.value), setError(''))} />
        </label>
        {error && <p className="warn">{error}</p>}
        <div className="row end">
          <button type="button" className="btn ghost" onClick={() => go('/')}>Retour</button>
          <button className="btn green">Entrer</button>
        </div>
      </form>
    </div>
  );
}

function Words() {
  const { words, settings, setWords } = useData();
  const [editing, setEditing] = useState<Word | null | 'new'>(null);
  const [error, setError] = useState('');

  const guard = async (fn: () => Promise<void>) => {
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue');
    }
  };
  const toggle = (w: Word) =>
    guard(async () => {
      const saved = await api.saveWord({ ...w, enabled: !w.enabled });
      setWords(useData.getState().words.map((x) => (x.id === w.id ? saved : x)));
    });
  const remove = (w: Word) =>
    confirm(`Supprimer « ${w.syllables.join('')} » ?`) &&
    guard(async () => {
      await api.deleteWord(w.id);
      setWords(useData.getState().words.filter((x) => x.id !== w.id));
    });
  const saved = (w: Word) => {
    const list = useData.getState().words;
    setWords(list.some((x) => x.id === w.id) ? list.map((x) => (x.id === w.id ? w : x)) : [...list, w]);
    setEditing(null);
  };

  return (
    <>
      <div className="row between">
        <p className="hint">{words.filter((w) => w.enabled).length} mot(s) actif(s) sur {words.length}</p>
        <button className="btn green" onClick={() => setEditing('new')}>＋ Ajouter un mot</button>
      </div>
      {error && <p className="warn">{error}</p>}
      <ul className="word-list">
        {words.map((w) => (
          <li key={w.id} className={w.enabled ? '' : 'off'}>
            <div className="thumb">{w.image ? <img src={imageUrl(w.image)} alt="" /> : <span>?</span>}</div>
            <div className="word-texts">
              <WordText word={w} colors={settings.colors} font="script" />
              <WordText word={w} colors={settings.colors} font="cursive" />
            </div>
            <div className="row">
              <button className="btn small ghost" onClick={() => speak(w)} aria-label="Écouter">🔊</button>
              {w.audio?.syllables && <button className="btn small ghost" onClick={() => speak(w, true)} aria-label="Écouter syllabe par syllabe" title="Syllabe par syllabe">🐢</button>}
              <button className={`switch ${w.enabled ? 'on' : ''}`} onClick={() => toggle(w)} aria-label={w.enabled ? 'Désactiver' : 'Activer'} title={w.enabled ? 'Actif dans le jeu' : 'Inactif'}>
                <i />
              </button>
              <button className="btn small ghost" onClick={() => setEditing(w)} aria-label="Modifier">✏️</button>
              <button className="btn small ghost" onClick={() => remove(w)} aria-label="Supprimer">🗑</button>
            </div>
          </li>
        ))}
        {words.length === 0 && <li className="empty">Aucun mot pour l'instant.</li>}
      </ul>
      {editing && <WordEditor word={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={saved} />}
    </>
  );
}

function ChildrenTab() {
  const { words, settings } = useData();
  const [list, setList] = useState<Child[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [codes, setCodes] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const target = settings.acquiredAfter;

  const guard = async (fn: () => Promise<void>) => {
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue');
    }
  };
  useEffect(() => {
    guard(async () => setList(await api.adminChildren()));
  }, []);
  const replace = (c: Child) => setList((l) => l && l.map((x) => (x.id === c.id ? c : x)));

  const rename = (c: Child) => {
    const name = prompt('Nouveau prénom :', c.name)?.trim();
    if (name && name !== c.name) guard(async () => replace(await api.renameChild(c.id, name)));
  };
  const remove = (c: Child) =>
    confirm(`Supprimer ${c.name} et tout son avancement ? C'est définitif.`) &&
    guard(async () => {
      await api.deleteChild(c.id);
      setList((l) => l && l.filter((x) => x.id !== c.id));
    });
  const setCount = (c: Child, w: Word, n: number) => guard(async () => replace(await api.setProgress(c.id, w.id, n)));
  const toggleCode = (id: string) => {
    const next = new Set(codes);
    next.has(id) ? next.delete(id) : next.add(id);
    setCodes(next);
  };

  if (!list) return error ? <p className="warn">{error}</p> : <p className="hint">Chargement…</p>;
  return (
    <>
      <p className="hint">{list.length} enfant(s) inscrit(s). Un mot est acquis après {target} réussite(s).</p>
      {error && <p className="warn">{error}</p>}
      <ul className="word-list">
        {list.map((c) => (
          <li key={c.id} className="child-admin">
            <div className="row between wrap">
              <button className="child-name" onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id}>
                <span>{open === c.id ? '▾' : '▸'}</span> <b>{c.name}</b>
                <span className="hint">
                  ★ {acquiredCount(c, words, target)} / {words.length} · inscrit le {new Date(c.createdAt).toLocaleDateString('fr-BE')}
                </span>
              </button>
              <div className="row">
                <button className="btn small ghost" onClick={() => toggleCode(c.id)}>{codes.has(c.id) ? c.token : '🔑 Code'}</button>
                <button className="btn small ghost" onClick={() => rename(c)} aria-label="Renommer">✏️</button>
                <button className="btn small ghost" onClick={() => remove(c)} aria-label="Supprimer">🗑</button>
              </div>
            </div>
            {open === c.id && (
              <ChildProgress
                child={c}
                words={words}
                settings={settings}
                actions={(w, ok) => (
                  <>
                    {ok < target && <button className="btn small ghost" onClick={() => setCount(c, w, target)}>Marquer acquis</button>}
                    {ok > 0 && <button className="btn small ghost" onClick={() => setCount(c, w, 0)}>Remettre à zéro</button>}
                  </>
                )}
              />
            )}
          </li>
        ))}
        {list.length === 0 && <li className="empty">Aucun enfant inscrit pour l'instant.</li>}
      </ul>
    </>
  );
}

function SettingsTab() {
  const { settings, setSettings } = useData();
  const [s, setS] = useState<Settings>(settings);
  const [state, setState] = useState('');
  const [classCode, setClassCode] = useState('');
  const [codeState, setCodeState] = useState('');
  useEffect(() => {
    api.adminConfig().then((c) => setClassCode(c.classCode), () => setCodeState('Code de classe illisible'));
  }, []);
  const saveCode = async () => {
    try {
      setClassCode((await api.saveAdminConfig({ classCode })).classCode);
      setCodeState('Enregistré ✓');
    } catch (e) {
      setCodeState(e instanceof Error ? e.message : 'Erreur');
    }
  };
  const sample = { determiner: 'un', syllables: ['hi', 'ver'], silent: [true, false, false, false, false] };
  const labels: [keyof Settings['colors'], string][] = [
    ['a', '1re, 3e, 5e… syllabe'],
    ['b', '2e, 4e, 6e… syllabe'],
    ['determiner', 'Déterminant'],
    ['silent', 'Lettre muette (soulignée)'],
  ];
  const save = async () => {
    try {
      setSettings(await api.saveSettings(s));
      setState('Enregistré ✓');
    } catch (e) {
      setState(e instanceof Error ? e.message : 'Erreur');
    }
  };
  return (
    <div className="settings">
      <h3>Couleurs des mots</h3>
      {labels.map(([k, label]) => (
        <label key={k} className="color-row">
          <input type="color" value={s.colors[k]} onChange={(e) => (setS({ ...s, colors: { ...s.colors, [k]: e.target.value } }), setState(''))} />
          {label}
        </label>
      ))}
      <div className="preview">
        <WordText word={sample} colors={s.colors} font="script" />
        <WordText word={sample} colors={s.colors} font="cursive" />
      </div>
      <h3>Taille du plateau par défaut</h3>
      <div className="choices">
        {([20, 30, 40] as const).map((n) => (
          <button key={n} className={`choice wide ${s.boardSize === n ? 'on' : ''}`} onClick={() => (setS({ ...s, boardSize: n }), setState(''))}>
            {n} cases
          </button>
        ))}
      </div>
      <h3>Mot acquis après…</h3>
      <label className="field inline">
        <input
          type="number"
          min={1}
          max={100}
          value={s.acquiredAfter}
          onChange={(e) => (setS({ ...s, acquiredAfter: Math.max(1, Math.min(100, Math.round(Number(e.target.value)) || 1)) }), setState(''))}
        />
        <span>réussites. Un mot acquis apparaît environ quatre fois moins souvent sur le plateau.</span>
      </label>
      <div className="row end">
        <span className="hint grow">{state}</span>
        <button className="btn ghost" onClick={() => (setS({ ...s, colors: DEFAULT_SETTINGS.colors }), setState(''))}>Couleurs d'origine</button>
        <button className="btn green" onClick={save}>Enregistrer</button>
      </div>

      <h3>Code de la classe</h3>
      <p className="hint">À communiquer aux parents : il est demandé pour inscrire un enfant. Le changer n'affecte pas les enfants déjà inscrits.</p>
      <div className="row">
        <input className="code-input" value={classCode} maxLength={20} onChange={(e) => (setClassCode(e.target.value.toUpperCase()), setCodeState(''))} />
        <span className="hint grow">{codeState}</span>
        <button className="btn green" onClick={saveCode}>Changer le code</button>
      </div>
    </div>
  );
}

function About() {
  return (
    <div className="about">
      <p>
        Les pictogrammes proposés sont la propriété du Gouvernement d'Aragon et ont été créés par Sergio Palao pour{' '}
        <a href="https://arasaac.org" target="_blank" rel="noreferrer">ARASAAC</a>, qui les distribue sous licence Creative Commons BY-NC-SA
        (usage non commercial).
      </p>
      <p>Polices : Andika (SIL), Playwrite FR Trad (TypeTogether) et Fredoka, toutes sous licence libre OFL.</p>
      <p>Voix de synthèse : Piper, voix française « siwis ».</p>
      <p>Les mots, images, sons, enfants et avancements sont enregistrés dans le dossier <code>/data</code> du conteneur.</p>
    </div>
  );
}

export function Admin() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'words' | 'children' | 'settings' | 'about'>('words');

  useEffect(() => {
    api.adminSession().then((r) => setOk(r.admin), () => setOk(false));
  }, []);

  if (ok === null) return <div className="page center"><div className="loader">🪿</div></div>;
  if (!ok) return <Login onOk={() => setOk(true)} />;
  const logout = () => api.adminLogout().finally(() => go('/'));
  return (
    <div className="page parents">
      <div className="panel wide-panel">
        <div className="row between wrap">
          <h2>Administration</h2>
          <div className="row">
            <button className="btn small ghost" onClick={logout}>Se déconnecter</button>
            <button className="btn ghost" onClick={() => go('/')}>← Retour au jeu</button>
          </div>
        </div>
        <div className="tabs">
          <button className={tab === 'words' ? 'on' : ''} onClick={() => setTab('words')}>Les mots</button>
          <button className={tab === 'children' ? 'on' : ''} onClick={() => setTab('children')}>Les enfants</button>
          <button className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}>Réglages</button>
          <button className={tab === 'about' ? 'on' : ''} onClick={() => setTab('about')}>À propos</button>
        </div>
        {tab === 'words' ? <Words /> : tab === 'children' ? <ChildrenTab /> : tab === 'settings' ? <SettingsTab /> : <About />}
      </div>
    </div>
  );
}
