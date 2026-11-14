import { create } from 'zustand';
import { DEFAULT_SETTINGS, type Child, type Info, type Settings, type Word } from '../../shared/types';
import { api } from './api';

interface Data {
  loaded: boolean;
  error: boolean;
  words: Word[];
  settings: Settings;
  info: Info;
  /** Les enfants enregistrés dans ce navigateur. */
  children: Child[];
  load: () => Promise<void>;
  setWords: (w: Word[]) => void;
  setSettings: (s: Settings) => void;
  setChildren: (c: Child[]) => void;
  refreshChildren: () => Promise<Child[]>;
}

export const useData = create<Data>((set) => ({
  loaded: false,
  error: false,
  words: [],
  settings: DEFAULT_SETTINGS,
  info: { tts: false },
  children: [],
  load: async () => {
    try {
      const [words, settings, info, children] = await Promise.all([api.words(), api.settings(), api.info(), api.me()]);
      set({ words, settings, info, children, loaded: true, error: false });
    } catch {
      set({ error: true });
    }
  },
  setWords: (words) => set({ words }),
  setSettings: (settings) => set({ settings }),
  setChildren: (children) => set({ children }),
  refreshChildren: async () => {
    const children = await api.me();
    set({ children });
    return children;
  },
}));
