import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SETTINGS, type AdminConfig, type Child, type Settings, type Word } from '../shared/types';

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = resolve(process.env.DATA_DIR ?? 'data');
export const IMAGES_DIR = join(DATA_DIR, 'images');
export const AUDIO_DIR = join(DATA_DIR, 'audio');
const WORDS_FILE = join(DATA_DIR, 'words.json');
const SETTINGS_FILE = join(DATA_DIR, 'settings.json');
const CHILDREN_FILE = join(DATA_DIR, 'children.json');
const ADMIN_FILE = join(DATA_DIR, 'admin.json');
const SEED_DIR = join(here, 'seed');

export function initStorage() {
  mkdirSync(IMAGES_DIR, { recursive: true });
  mkdirSync(AUDIO_DIR, { recursive: true });
  if (!existsSync(WORDS_FILE)) {
    // premier démarrage : mots d'exemple
    cpSync(join(SEED_DIR, 'images'), IMAGES_DIR, { recursive: true });
    cpSync(join(SEED_DIR, 'words.json'), WORDS_FILE);
  }
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown) {
  const tmp = file + '.tmp';
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, file);
}

export const readWords = () => readJson<Word[]>(WORDS_FILE, []);
export const writeWords = (words: Word[]) => writeJson(WORDS_FILE, words);

export function readSettings(): Settings {
  const s = readJson<Partial<Settings>>(SETTINGS_FILE, {});
  return { ...DEFAULT_SETTINGS, ...s, colors: { ...DEFAULT_SETTINGS.colors, ...s.colors } };
}
export const writeSettings = (s: Settings) => writeJson(SETTINGS_FILE, s);

export const readChildren = () => readJson<Child[]>(CHILDREN_FILE, []);
export const writeChildren = (children: Child[]) => writeJson(CHILDREN_FILE, children);

/** Configuration privée (jamais servie au public) : code de classe. */
export const readAdminConfig = () => readJson<Partial<AdminConfig>>(ADMIN_FILE, {});
export const writeAdminConfig = (c: AdminConfig) => writeJson(ADMIN_FILE, c);

/** Supprime les images et sons qui ne sont plus liés à aucun mot (et vieux de plus d'une heure). */
export function collectGarbage() {
  const words = readWords();
  const keep = new Set<string>();
  for (const w of words) {
    if (w.image) keep.add(w.image);
    if (w.audio) keep.add(w.audio.file);
    if (w.audio?.syllables) keep.add(w.audio.syllables);
  }
  const limit = Date.now() - 3600_000;
  for (const dir of [IMAGES_DIR, AUDIO_DIR]) {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (!keep.has(f) && statSync(p).mtimeMs < limit) unlinkSync(p);
    }
  }
}
