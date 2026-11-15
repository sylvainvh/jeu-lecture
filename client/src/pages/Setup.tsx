import { useState } from 'react';
import { go } from '../App';
import { wordWeights } from '../../../shared/progress';
import { useData } from '../data';
import { DEFAULT_FOCUS, useGame, type DiceMode, type Focus } from '../game/store';

export const GOOSE_COLORS = ['#f6a609', '#2f8fe6', '#e0569b', '#17a589'];
const KEY = 'jeu-config-v2';
const MAX_PLAYERS = 4;

interface Saved {
  /** Enfants cochés lors de la dernière partie (absent : tous). */
  selected?: string[];
  guests: string[];
  diceMode: DiceMode;
  size?: number;
  focus?: Partial<Focus>;
}

const FOCUS_OPTIONS: [keyof Focus, string, string][] = [
  ['movableBoard', 'Plateau mobile', 'On peut tourner et zoomer le plateau'],
  ['animations', 'Animations', 'Pions qui sautent, dé qui roule, effets, confettis'],
  ['scenery', 'Décor', 'Arbres, nuages et mer autour du plateau'],
  ['links', 'Serpents et échelles', 'Raccourcis et retours en arrière'],
  ['tileWords', 'Mots sur les cases', 'Sinon, le mot n\'apparaît que sur la carte'],
];

function loadSaved(): Saved {
  try {
    return { guests: [], diceMode: 'virtual', ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { guests: [], diceMode: 'virtual' };
  }
}

export function Setup() {
  const { words, settings, children } = useData();
  const start = useGame((s) => s.start);
  const [cfg, setCfg] = useState(loadSaved);
  const size = cfg.size ?? settings.boardSize;
  const active = words.filter((w) => w.enabled).length;
  const focus: Focus = { ...DEFAULT_FOCUS, ...cfg.focus };

  const selected = children.filter((c) => (cfg.selected ? cfg.selected.includes(c.id) : true)).slice(0, MAX_PLAYERS);
  const guests = cfg.guests.slice(0, MAX_PLAYERS - selected.length);
  const total = selected.length + guests.length;

  const toggle = (id: string) => {
    const ids = selected.map((c) => c.id);
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    if (next.length + guests.length <= MAX_PLAYERS) setCfg({ ...cfg, selected: next });
  };
  const setGuests = (g: string[]) => setCfg({ ...cfg, guests: g });

  const play = () => {
    const saved: Saved = { ...cfg, selected: selected.map((c) => c.id), guests };
    try {
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {
      /* stockage indisponible : sans importance */
    }
    const players = [
      ...selected.map((c) => ({ name: c.name, childId: c.id })),
      ...guests.map((g, i) => ({ name: g.trim() || `Invité ${i + 1}` })),
    ].map((p, i) => ({ ...p, color: GOOSE_COLORS[i] }));
    start({ players, size, diceMode: cfg.diceMode, focus }, words, wordWeights(words, selected, settings.acquiredAfter));
    go('/partie');
  };

  return (
    <div className="page center">
      <div className="panel setup">
        <h2>Nouvelle partie</h2>

        <h3>Qui joue ?</h3>
        {children.length > 0 && (
          <div className="choices">
            {children.map((c) => {
              const on = selected.some((s) => s.id === c.id);
              return (
                <button key={c.id} className={`choice ${on ? 'on' : ''}`} onClick={() => toggle(c.id)} aria-pressed={on}>
                  {on ? '✓ ' : ''}{c.name}
                </button>
              );
            })}
          </div>
        )}
        <div className="players">
          {guests.map((g, i) => (
            <div key={i} className="player-row">
              <input value={g} maxLength={14} placeholder={`Invité ${i + 1}`} onChange={(e) => setGuests(guests.map((x, k) => (k === i ? e.target.value : x)))} />
              <button className="btn small ghost" onClick={() => setGuests(guests.filter((_, k) => k !== i))} aria-label="Retirer cet invité">✕</button>
            </div>
          ))}
          {total < MAX_PLAYERS && (
            <button className="btn small ghost add-guest" onClick={() => setGuests([...guests, ''])}>＋ Ajouter un invité</button>
          )}
        </div>
        <p className="hint">
          {children.length === 0
            ? "Aucun enfant inscrit sur cet appareil : les réussites d'un invité ne sont pas retenues."
            : guests.length > 0 ? "Les réussites des invités ne sont pas retenues." : ''}
        </p>

        <h3>Le dé</h3>
        <div className="choices">
          <button className={`choice wide ${cfg.diceMode === 'virtual' ? 'on' : ''}`} onClick={() => setCfg({ ...cfg, diceMode: 'virtual' })}>
            🎲 Dé à l'écran
          </button>
          <button className={`choice wide ${cfg.diceMode === 'real' ? 'on' : ''}`} onClick={() => setCfg({ ...cfg, diceMode: 'real' })}>
            ✋ Vrai dé
          </button>
        </div>

        <h3>Taille du plateau</h3>
        <div className="choices">
          {[20, 30, 40].map((n) => (
            <button key={n} className={`choice wide ${size === n ? 'on' : ''}`} onClick={() => setCfg({ ...cfg, size: n })}>
              {n} cases
            </button>
          ))}
        </div>

        <h3>Concentration</h3>
        <p className="hint">Désactive ce qui distrait l'enfant.</p>
        <div className="focus-list">
          {FOCUS_OPTIONS.map(([key, label, detail]) => (
            <button
              key={key}
              className="focus-row"
              role="switch"
              aria-checked={focus[key]}
              onClick={() => setCfg({ ...cfg, focus: { ...focus, [key]: !focus[key] } })}
            >
              <span className={`switch ${focus[key] ? 'on' : ''}`}><i /></span>
              <span>
                <b>{label}</b>
                <small>{detail}</small>
              </span>
            </button>
          ))}
        </div>

        {active === 0 && <p className="warn">Il n'y a pas encore de mots dans le jeu : les cases seront vides.</p>}

        <div className="row end">
          <button className="btn ghost" onClick={() => go('/')}>Retour</button>
          <button className="btn big green" onClick={play} disabled={total === 0}>C'est parti !</button>
        </div>
      </div>
    </div>
  );
}
