import { useEffect, useMemo, useState } from 'react';
import { successCount, wordWeights } from '../../../shared/progress';
import { api } from '../api';
import { go } from '../App';
import { useData } from '../data';
import { useGame } from '../game/store';
import { Dice } from '../three/Dice';
import { Scene } from '../three/Scene';
import { WordCard } from '../ui/WordCard';

const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 3,
        duration: 2.8 + Math.random() * 2.5,
        color: ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#b388eb'][i % 5],
        rotate: Math.random() * 360,
      })),
    [],
  );
  return (
    <div className="confetti" aria-hidden>
      {bits.map((b, i) => (
        <i key={i} style={{ left: `${b.left}%`, background: b.color, animationDelay: `${b.delay}s`, animationDuration: `${b.duration}s`, transform: `rotate(${b.rotate}deg)` }} />
      ))}
    </div>
  );
}

export function Game() {
  const { board, players, current, phase, diceMode, lastRoll, roll, continueAfterWord, start, quit } = useGame();
  const { settings, words, children, refreshChildren } = useData();
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!board) go('/jouer');
  }, [board]);
  if (!board) return null;

  const player = players[current];
  const word = board.tiles[player.pos];
  const link = phase === 'jump' ? board.links.find((l) => l.to === player.pos) : undefined;
  const canRoll = phase === 'roll';

  // l'enfant inscrit dont c'est le tour (un invité, ou un enfant retiré de l'appareil, n'a pas de suivi)
  const child = children.find((c) => c.id === player.childId);

  /** Pouce levé ou baissé : on enregistre, et le tour continue sans attendre la réponse. */
  const answer = (success: boolean | null) => {
    if (child && word && success !== null) {
      setNotice('');
      api
        .progress(child.id, word.id, success)
        .then(refreshChildren)
        .catch(() => setNotice("Le résultat n'a pas pu être enregistré (connexion ?)."));
    }
    continueAfterWord();
  };

  const replay = async () => {
    // on relit l'avancement : les mots acquis pendant la partie sortiront moins
    const fresh = await refreshChildren().catch(() => children);
    const playing = fresh.filter((c) => players.some((p) => p.childId === c.id));
    start(
      { players: players.map(({ name, color, childId }) => ({ name, color, childId })), size: board.size, diceMode },
      words,
      wordWeights(words, playing, settings.acquiredAfter),
    );
  };
  const leave = () => {
    if (phase !== 'won' && !confirm('Arrêter la partie ?')) return;
    quit();
    go('/');
  };

  return (
    <div className="game">
      <Scene board={board} colors={settings.colors} players={players.length} />

      <div className="hud-top">
        <button className="btn small ghost" onClick={leave}>✕ Quitter</button>
        <div className="chips">
          {players.map((p, i) => (
            <div key={i} className={`chip ${i === current && phase !== 'won' ? 'on' : ''}`} style={{ borderColor: p.color }}>
              <span className="dot" style={{ background: p.color }} />
              {p.name}
              <b>{p.pos === 0 ? '▶' : p.pos >= board.size - 1 ? '★' : p.pos}</b>
            </div>
          ))}
        </div>
      </div>

      {phase !== 'won' && (
        <div className="hud-bottom">
          <div className="turn" style={{ background: player.color }}>
            {link
              ? link.type === 'ladder' ? '🪜 Une échelle, on monte !' : '🐍 Un serpent, on redescend…'
              : canRoll
                ? players.length > 1 ? `À toi, ${player.name} ! Lance le dé` : 'Lance le dé !'
                : lastRoll ? `${player.name} avance de ${lastRoll}` : ''}
          </div>
          {diceMode === 'virtual' ? (
            <Dice lastRoll={lastRoll} enabled={canRoll} onResult={roll} />
          ) : (
            <div className={`real-dice ${canRoll ? '' : 'off'}`}>
              {FACES.map((f, i) => (
                <button key={i} disabled={!canRoll} onClick={() => roll(i + 1)} aria-label={`Le dé indique ${i + 1}`}>
                  <span className="pip-face">{f}</span>
                  <span className="pip-num">{i + 1}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {phase === 'word' && word && (
        <WordCard
          key={`${current}-${player.pos}`}
          word={word}
          colors={settings.colors}
          score={child && { success: successCount(child, word.id), target: settings.acquiredAfter }}
          onResult={answer}
        />
      )}
      {notice && <div className="notice" onClick={() => setNotice('')}>{notice}</div>}

      {phase === 'won' && (
        <div className="overlay">
          <Confetti />
          <div className="panel win">
            <div className="trophy">🏆</div>
            <h2>Bravo {player.name} !</h2>
            <p>{players.length > 1 ? 'Tu as gagné la partie !' : "Tu as atteint l'arrivée !"}</p>
            <div className="row">
              <button className="btn ghost" onClick={leave}>Accueil</button>
              <button className="btn big green" onClick={replay}>Rejouer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
