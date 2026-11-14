import { go } from '../App';
import { useData } from '../data';
import { useGame } from '../game/store';
import { WordText } from '../ui/WordText';

export function Home() {
  const hasGame = useGame((s) => !!s.board && s.phase !== 'won');
  const { settings } = useData();
  const title = [
    { syllables: ['Le ', 'jeu '], silent: Array(7).fill(false) },
    { syllables: ['de ', "l'oie"], silent: Array(8).fill(false) },
  ];
  return (
    <div className="page center home">
      <div className="goose-logo">🪿</div>
      <h1 className="title">
        {title.map((t, i) => (
          <WordText key={i} word={t} colors={settings.colors} font="script" />
        ))}
        <span className="title-sub">des mots</span>
      </h1>
      <div className="stack">
        {hasGame && (
          <button className="btn big green" onClick={() => go('/partie')}>
            ▶ Reprendre la partie
          </button>
        )}
        <button className={`btn big ${hasGame ? 'ghost' : 'green'}`} onClick={() => go('/jouer')}>
          {hasGame ? 'Nouvelle partie' : '▶ Jouer'}
        </button>
        <button className="btn ghost" onClick={() => go('/enfants')}>
          👧 Les enfants
        </button>
      </div>
      <button className="link" onClick={() => go('/admin')}>Administration</button>
    </div>
  );
}
