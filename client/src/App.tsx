import { useEffect, useState } from 'react';
import { useData } from './data';
import { Home } from './pages/Home';
import { Setup } from './pages/Setup';
import { Game } from './pages/Game';
import { Admin } from './pages/Admin';
import { ChildSheet } from './pages/ChildSheet';
import { Profiles } from './pages/Profiles';

export const go = (route: string) => {
  location.hash = route;
};

export function App() {
  const [route, setRoute] = useState(location.hash);
  const { loaded, error, load, children } = useData();

  useEffect(() => {
    const on = () => setRoute(location.hash);
    addEventListener('hashchange', on);
    load();
    return () => removeEventListener('hashchange', on);
  }, [load]);

  if (error) {
    return (
      <div className="page center">
        <div className="panel">
          <h2>Oups…</h2>
          <p>Impossible de joindre le serveur du jeu.</p>
          <button className="btn" onClick={() => load()}>Réessayer</button>
        </div>
      </div>
    );
  }
  if (!loaded) return <div className="page center"><div className="loader">🪿</div></div>;

  if (route.startsWith('#/partie')) return <Game />;
  if (route.startsWith('#/jouer')) return <Setup />;
  if (route.startsWith('#/admin')) return <Admin />;
  if (route.startsWith('#/enfants/')) return <ChildSheet id={route.slice('#/enfants/'.length)} />;
  if (route.startsWith('#/enfants')) return <Profiles />;
  // première visite : aucun enfant dans ce navigateur
  return children.length ? <Home /> : <Profiles welcome />;
}
