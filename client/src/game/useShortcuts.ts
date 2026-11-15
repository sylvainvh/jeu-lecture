import { useEffect, useRef } from 'react';

/** Une action par touche ; renvoyer `false` signifie « touche non utilisée ici ». */
export type KeyHandler = (key: string) => boolean | void;

/**
 * Touche normalisée : 'enter', 'space', 'escape', 'up', 'down', '?', une lettre,
 * ou un chiffre '1'…'6'. Les chiffres sont reconnus par leur position sur le clavier,
 * car sur un clavier AZERTY la rangée du haut ne donne un chiffre qu'avec Maj.
 */
function normalize(e: KeyboardEvent): string {
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
  if (digit) return digit[1];
  switch (e.key) {
    case 'Enter': return 'enter';
    case ' ': return 'space';
    case 'Escape': return 'escape';
    case 'ArrowUp': return 'up';
    case 'ArrowDown': return 'down';
    default: return e.key.toLowerCase();
  }
}

/** Écoute le clavier tant que le composant est affiché. */
export function useShortcuts(handler: KeyHandler) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      // un clavier est manifestement branché : on affiche les rappels de touches sur les boutons
      document.documentElement.classList.add('has-keyboard');
      const target = e.target as HTMLElement | null;
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
      if (latest.current(normalize(e)) === false) return;
      // la touche est prise par le jeu : elle ne doit pas, en plus, activer le bouton qui a le focus
      e.preventDefault();
      (document.activeElement as HTMLElement | null)?.blur?.();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
}
