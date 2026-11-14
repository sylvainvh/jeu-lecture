import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

// --- mot de passe administrateur -------------------------------------------------
const configured = (process.env.ADMIN_PASSWORD ?? process.env.ADMIN_PIN ?? '').trim();
/** Sans mot de passe configuré, on en tire un au hasard : l'administration n'est jamais ouverte. */
export const generatedPassword = configured ? null : randomBytes(9).toString('base64url');
const ADMIN_PASSWORD = configured || generatedPassword!;

export function checkPassword(given: unknown): boolean {
  if (typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(ADMIN_PASSWORD);
  return a.length === b.length && timingSafeEqual(a, b);
}

// --- sessions administrateur (en mémoire : perdues au redémarrage) -----------------
export const SESSION_HOURS = 12;
const sessions = new Map<string, number>();

export function createSession(): string {
  const id = randomBytes(24).toString('base64url');
  sessions.set(id, Date.now() + SESSION_HOURS * 3600_000);
  return id;
}
export function isSession(id: string | undefined): boolean {
  if (!id) return false;
  const expiry = sessions.get(id);
  if (!expiry) return false;
  if (expiry < Date.now()) {
    sessions.delete(id);
    return false;
  }
  return true;
}
export const dropSession = (id: string | undefined) => id && sessions.delete(id);

// --- codes ------------------------------------------------------------------------
/** Sans 0/O, 1/I/L ni U : lisible et recopiable sans erreur. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const randomCode = (n: number) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

/** Code secret d'un enfant : 12 caractères (≈ 59 bits), ex. K7QF-9M2X-TB4H. */
export const newChildToken = () => randomCode(12).replace(/(.{4})(?=.)/g, '$1-');
export const newClassCode = () => randomCode(6);

/** Tolère minuscules, espaces et tirets manquants à la saisie. */
export function normalizeToken(input: unknown): string {
  if (typeof input !== 'string') return '';
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return raw.length === 12 ? raw.replace(/(.{4})(?=.)/g, '$1-') : '';
}
export const normalizeClassCode = (input: unknown) => (typeof input === 'string' ? input.trim().toUpperCase().replace(/\s+/g, '') : '');

// --- limite de tentatives ---------------------------------------------------------
/** Compte les échecs par clé (adresse IP) sur une fenêtre glissante. */
export function makeLimiter(max: number, windowMs: number) {
  const failures = new Map<string, number[]>();
  const recent = (key: string) => {
    const list = (failures.get(key) ?? []).filter((t) => t > Date.now() - windowMs);
    list.length ? failures.set(key, list) : failures.delete(key);
    return list;
  };
  return {
    blocked: (key: string) => recent(key).length >= max,
    fail: (key: string) => failures.set(key, [...recent(key), Date.now()]),
  };
}
