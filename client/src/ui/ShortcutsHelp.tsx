import type { DiceMode } from '../game/store';

/** Panneau d'aide : les touches du clavier qui remplacent la souris. */
export function ShortcutsHelp({ diceMode, onClose }: { diceMode: DiceMode; onClose: () => void }) {
  const rows: [string[], string][] = [
    diceMode === 'virtual' ? [['Entrée'], 'Lancer le dé'] : [['1', '…', '6'], 'Indiquer le chiffre du vrai dé'],
    [['Espace'], 'Écouter le mot'],
    [['S'], 'Écouter le mot syllabe par syllabe'],
    [['I'], "Voir l'image, puis revenir au mot"],
    [['↑'], '👍 Le mot est réussi'],
    [['↓'], "👎 Le mot n'est pas réussi"],
    [['Entrée'], 'Continuer (joueur invité) · Rejouer à la fin'],
    [['?'], 'Ouvrir ou fermer cette aide'],
    [['Échap'], 'Fermer cette aide · Quitter la partie'],
  ];
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel shortcuts" role="dialog" aria-label="Touches du clavier">
        <h2>⌨ Les touches du clavier</h2>
        <table>
          <tbody>
            {rows.map(([keys, label], i) => (
              <tr key={i}>
                <td>{keys.map((k, j) => (k === '…' ? <span key={j}> … </span> : <kbd key={j}>{k}</kbd>))}</td>
                <td>{label}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">Les pouces 👍 👎 sont pour l'adulte : la touche Entrée ne valide jamais un mot.</p>
        <div className="row end">
          <button className="btn green" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
