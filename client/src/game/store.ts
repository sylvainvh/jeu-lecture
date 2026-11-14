import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Word } from '../../../shared/types';
import { columnsFor, generateBoard, type Board } from './board';

export type Phase = 'roll' | 'moving' | 'word' | 'jump' | 'won';
export type DiceMode = 'virtual' | 'real';

export interface Player {
  name: string;
  color: string;
  pos: number;
  /** Enfant inscrit ; absent pour un invité (réussites non comptées). */
  childId?: string;
}

export interface Anim {
  id: number;
  player: number;
  path: number[];
  kind: 'hop' | 'ladder' | 'snake';
}

export interface Config {
  players: { name: string; color: string; childId?: string }[];
  size: number;
  diceMode: DiceMode;
}

interface Game {
  board: Board | null;
  players: Player[];
  current: number;
  phase: Phase;
  diceMode: DiceMode;
  lastRoll: number | null;
  anim: Anim | null;
  start: (cfg: Config, words: Word[], weights?: Record<string, number>) => void;
  roll: (n: number) => void;
  animDone: (id: number) => void;
  continueAfterWord: () => void;
  quit: () => void;
}

let animSeq = 1;

export const useGame = create<Game>()(
  persist(
    (set, get) => {
      const next = () => set((s) => ({ current: (s.current + 1) % s.players.length, phase: 'roll', anim: null }));

      /** Le pion est arrivé sur sa case : victoire, mot à lire, ou suite du tour. */
      const landed = () => {
        const { board, players, current } = get();
        if (!board) return;
        const pos = players[current].pos;
        if (pos >= board.size - 1) set({ phase: 'won', anim: null });
        else if (board.tiles[pos]) set({ phase: 'word', anim: null });
        else get().continueAfterWord();
      };

      return {
        board: null,
        players: [],
        current: 0,
        phase: 'roll',
        diceMode: 'virtual',
        lastRoll: null,
        anim: null,

        start: (cfg, words, weights) =>
          set({
            board: generateBoard(words, cfg.size, columnsFor(cfg.size, innerHeight > innerWidth), weights),
            players: cfg.players.map((p) => ({ ...p, pos: 0 })),
            current: 0,
            phase: 'roll',
            diceMode: cfg.diceMode,
            lastRoll: null,
            anim: null,
          }),

        roll: (n) => {
          const { board, players, current, phase } = get();
          if (!board || phase !== 'roll') return;
          const from = players[current].pos;
          const to = Math.min(from + n, board.size - 1);
          const path = Array.from({ length: to - from }, (_, k) => from + k + 1);
          set({
            players: players.map((p, i) => (i === current ? { ...p, pos: to } : p)),
            lastRoll: n,
            phase: 'moving',
            anim: { id: animSeq++, player: current, path, kind: 'hop' },
          });
        },

        animDone: (id) => {
          const { anim, phase } = get();
          if (anim?.id !== id) return;
          if (phase === 'moving') landed();
          else if (phase === 'jump') next();
        },

        continueAfterWord: () => {
          const { board, players, current } = get();
          if (!board) return;
          const link = board.links.find((l) => l.from === players[current].pos);
          if (!link) return next();
          set({
            players: players.map((p, i) => (i === current ? { ...p, pos: link.to } : p)),
            phase: 'jump',
            anim: { id: animSeq++, player: current, path: [link.to], kind: link.type },
          });
        },

        quit: () => set({ board: null, players: [], anim: null, phase: 'roll', lastRoll: null }),
      };
    },
    {
      name: 'jeu-partie-v3',
      partialize: ({ board, players, current, phase, diceMode, lastRoll }) => ({ board, players, current, phase, diceMode, lastRoll }),
      // après un rechargement de page, on reprend sans rejouer l'animation interrompue
      onRehydrateStorage: () => (state) => {
        if (!state?.board) return;
        const pos = state.players[state.current]?.pos ?? 0;
        if (state.phase === 'moving') state.phase = pos >= state.board.size - 1 ? 'won' : state.board.tiles[pos] ? 'word' : 'roll';
        else if (state.phase === 'jump') {
          state.phase = 'roll';
          state.current = (state.current + 1) % state.players.length;
        }
      },
    },
  ),
);
