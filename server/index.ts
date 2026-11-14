import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { randomUUID } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fullText, type AdminConfig, type Child, type Info, type Picto, type Settings, type Word } from '../shared/types';
import {
  AUDIO_DIR, DATA_DIR, IMAGES_DIR, collectGarbage, initStorage, readAdminConfig, readChildren, readSettings, readWords,
  writeAdminConfig, writeChildren, writeSettings, writeWords,
} from './storage';
import {
  SESSION_HOURS, checkPassword, createSession, dropSession, generatedPassword, isSession, makeLimiter, newChildToken, newClassCode,
  normalizeClassCode, normalizeToken,
} from './auth';
import { synthesize, ttsAvailable } from './tts';
import { synthesizeSyllables, syllableTtsAvailable } from './syllableTts';

const PORT = Number(process.env.PORT ?? 8080);
const CLIENT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../client');

initStorage();

// code de classe : variable d'environnement au premier démarrage, sinon tiré au hasard
if (!readAdminConfig().classCode) writeAdminConfig({ classCode: normalizeClassCode(process.env.CLASS_CODE) || newClassCode() });
const classCode = () => readAdminConfig().classCode ?? '';

// trustProxy : derrière un reverse proxy, on veut la vraie adresse du visiteur et savoir si l'on est en HTTPS
const app = Fastify({ logger: { level: 'info' }, bodyLimit: 20 * 1024 * 1024, trustProxy: true });
app.register(fastifyCookie);

// images et sons envoyés tels quels dans le corps de la requête
app.addContentTypeParser(/^(image|audio|video)\//, { parseAs: 'buffer' }, (_req, body, done) => done(null, body));

app.register(fastifyStatic, { root: DATA_DIR, prefix: '/media/', decorateReply: false, allowedPath: (p) => /^\/(images|audio)\//.test(p) });
if (existsSync(CLIENT_DIR)) app.register(fastifyStatic, { root: CLIENT_DIR, prefix: '/' });

// --- administration : session par cookie ------------------------------------------
const ADMIN_COOKIE = 'admin';
const isAdminRoute = (method: string, url: string) => {
  if (url.startsWith('/api/admin/')) return !/^\/api\/admin\/(login|session)\b/.test(url);
  if (url.startsWith('/api/pictos')) return true;
  return method !== 'GET' && /^\/api\/(words|settings|images|audio)\b/.test(url);
};
app.addHook('preHandler', async (req, reply) => {
  if (isAdminRoute(req.method, req.url) && !isSession(req.cookies[ADMIN_COOKIE]))
    return reply.code(401).send({ error: 'Connexion administrateur requise' });
});

const TOO_MANY = { error: 'Trop de tentatives. Réessaie dans quelques minutes.' };
const loginLimiter = makeLimiter(8, 15 * 60_000);
const codeLimiter = makeLimiter(12, 15 * 60_000);

app.get('/api/info', async (): Promise<Info> => ({ tts: ttsAvailable() }));

app.get('/api/admin/session', async (req) => ({ admin: isSession(req.cookies[ADMIN_COOKIE]) }));
app.post('/api/admin/login', async (req, reply) => {
  if (loginLimiter.blocked(req.ip)) return reply.code(429).send(TOO_MANY);
  if (!checkPassword((req.body as { password?: string } | null)?.password)) {
    loginLimiter.fail(req.ip);
    return reply.code(401).send({ error: 'Mot de passe incorrect' });
  }
  reply.setCookie(ADMIN_COOKIE, createSession(), {
    path: '/', httpOnly: true, sameSite: 'lax', secure: req.protocol === 'https', maxAge: SESSION_HOURS * 3600,
  });
  return { ok: true };
});
app.post('/api/admin/logout', async (req, reply) => {
  dropSession(req.cookies[ADMIN_COOKIE]);
  reply.clearCookie(ADMIN_COOKIE, { path: '/' });
  return { ok: true };
});

// --- enfants : chaque navigateur ne voit que les enfants dont il détient le code ------
const CHILD_COOKIE = 'enfants';
const MAX_PER_BROWSER = 12;
type Req = { cookies: Record<string, string | undefined>; protocol: string };
type Rep = { setCookie: (name: string, value: string, opts: object) => unknown };

const tokensOf = (req: Req) => (req.cookies[CHILD_COOKIE] ?? '').split('.').filter(Boolean).slice(0, MAX_PER_BROWSER);
const setTokens = (req: Req, reply: Rep, tokens: string[]) =>
  reply.setCookie(CHILD_COOKIE, [...new Set(tokens)].join('.'), {
    path: '/', httpOnly: true, sameSite: 'lax', secure: req.protocol === 'https', maxAge: 400 * 24 * 3600,
  });
/** Les enfants de ce navigateur, dans l'ordre du cookie. */
const mine = (req: Req, all = readChildren()) =>
  tokensOf(req).map((t) => all.find((c) => c.token === t)).filter((c): c is Child => !!c);
const cleanName = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, 24) : '');

app.get('/api/me', async (req) => mine(req));

app.post('/api/children', async (req, reply) => {
  const body = req.body as { name?: string; classCode?: string } | null;
  if (codeLimiter.blocked(req.ip)) return reply.code(429).send(TOO_MANY);
  if (normalizeClassCode(body?.classCode) !== classCode()) {
    codeLimiter.fail(req.ip);
    return reply.code(403).send({ error: 'Code de classe incorrect' });
  }
  const name = cleanName(body?.name);
  if (!name) return reply.code(400).send({ error: 'Il manque le prénom' });
  const tokens = tokensOf(req);
  if (tokens.length >= MAX_PER_BROWSER) return reply.code(400).send({ error: "Trop d'enfants sur cet appareil" });
  const child: Child = { id: randomUUID(), name, token: newChildToken(), createdAt: new Date().toISOString(), progress: {} };
  writeChildren([...readChildren(), child]);
  setTokens(req, reply, [...tokens, child.token]);
  return child;
});

app.post('/api/children/claim', async (req, reply) => {
  if (codeLimiter.blocked(req.ip)) return reply.code(429).send(TOO_MANY);
  const token = normalizeToken((req.body as { token?: string } | null)?.token);
  const child = token ? readChildren().find((c) => c.token === token) : undefined;
  if (!child) {
    codeLimiter.fail(req.ip);
    return reply.code(404).send({ error: 'Code inconnu' });
  }
  const tokens = tokensOf(req);
  if (!tokens.includes(token) && tokens.length >= MAX_PER_BROWSER) return reply.code(400).send({ error: "Trop d'enfants sur cet appareil" });
  setTokens(req, reply, [...tokens, token]);
  return child;
});

app.post('/api/children/:id/forget', async (req, reply) => {
  const { id } = req.params as { id: string };
  const child = mine(req).find((c) => c.id === id);
  if (child) setTokens(req, reply, tokensOf(req).filter((t) => t !== child.token));
  return { ok: true };
});

app.post('/api/progress', async (req, reply) => {
  const body = req.body as { childId?: string; wordId?: string; success?: boolean } | null;
  const all = readChildren();
  const child = mine(req, all).find((c) => c.id === body?.childId);
  if (!child) return reply.code(403).send({ error: "Cet enfant n'est pas enregistré sur cet appareil" });
  const wordId = body?.wordId ?? '';
  if (!readWords().some((w) => w.id === wordId)) return reply.code(404).send({ error: 'Mot introuvable' });
  const p = (child.progress[wordId] ??= { success: 0, fail: 0 });
  if (body?.success) p.success++;
  else p.fail++;
  writeChildren(all);
  return p;
});

// --- administration des enfants -------------------------------------------------------
app.get('/api/admin/children', async () => readChildren());

app.put('/api/admin/children/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  const all = readChildren();
  const child = all.find((c) => c.id === id);
  const name = cleanName((req.body as { name?: string } | null)?.name);
  if (!child) return reply.code(404).send({ error: 'Enfant introuvable' });
  if (!name) return reply.code(400).send({ error: 'Il manque le prénom' });
  child.name = name;
  writeChildren(all);
  return child;
});

app.delete('/api/admin/children/:id', async (req) => {
  const { id } = req.params as { id: string };
  writeChildren(readChildren().filter((c) => c.id !== id));
  return { ok: true };
});

app.put('/api/admin/children/:id/progress/:wordId', async (req, reply) => {
  const { id, wordId } = req.params as { id: string; wordId: string };
  const success = Number((req.body as { success?: number } | null)?.success);
  const all = readChildren();
  const child = all.find((c) => c.id === id);
  if (!child) return reply.code(404).send({ error: 'Enfant introuvable' });
  if (!Number.isInteger(success) || success < 0 || success > 9999) return reply.code(400).send({ error: 'Compteur invalide' });
  if (!readWords().some((w) => w.id === wordId)) return reply.code(404).send({ error: 'Mot introuvable' });
  child.progress[wordId] = { success, fail: child.progress[wordId]?.fail ?? 0 };
  writeChildren(all);
  return child;
});

app.get('/api/admin/config', async (): Promise<AdminConfig> => ({ classCode: classCode() }));
app.put('/api/admin/config', async (req, reply): Promise<AdminConfig | void> => {
  const code = normalizeClassCode((req.body as { classCode?: string } | null)?.classCode);
  if (!/^[A-Z0-9-]{4,20}$/.test(code)) return reply.code(400).send({ error: 'Le code de classe doit contenir 4 à 20 lettres ou chiffres' });
  writeAdminConfig({ classCode: code });
  return { classCode: code };
});

// --- réglages -----------------------------------------------------------------
app.get('/api/settings', async () => readSettings());
app.put('/api/settings', async (req, reply) => {
  const b = req.body as Settings;
  const hex = (v: unknown) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
  if (!b?.colors || !['a', 'b', 'determiner', 'silent'].every((k) => hex((b.colors as any)[k])) || ![20, 30, 40].includes(b.boardSize) || !Number.isInteger(b.acquiredAfter) || b.acquiredAfter < 1 || b.acquiredAfter > 100)
    return reply.code(400).send({ error: 'Réglages invalides' });
  const s: Settings = { colors: { a: b.colors.a, b: b.colors.b, determiner: b.colors.determiner, silent: b.colors.silent }, boardSize: b.boardSize, acquiredAfter: b.acquiredAfter };
  writeSettings(s);
  return s;
});

// --- mots ---------------------------------------------------------------------
const FILE_RE = /^[\w-]+\.\w+$/;

function validateWord(b: any): Omit<Word, 'id'> | string {
  if (!b || !Array.isArray(b.syllables) || !b.syllables.length || !b.syllables.every((s: unknown) => typeof s === 'string' && s.length > 0))
    return 'Le mot est vide';
  const text: string = b.syllables.join('');
  if ([...text].length > 60) return 'Le mot est trop long';
  if (!Array.isArray(b.silent) || b.silent.length !== [...text].length) return 'Lettres muettes incohérentes';
  const w: Omit<Word, 'id'> = { enabled: b.enabled !== false, syllables: b.syllables, silent: b.silent.map(Boolean) };
  if (typeof b.determiner === 'string' && b.determiner.trim()) w.determiner = b.determiner.trim().slice(0, 20);
  if (b.image) {
    if (!FILE_RE.test(b.image) || !existsSync(join(IMAGES_DIR, b.image))) return 'Image introuvable';
    w.image = b.image;
  }
  if (b.audio?.source === 'recorded') {
    if (!FILE_RE.test(b.audio.file) || !existsSync(join(AUDIO_DIR, b.audio.file))) return 'Son introuvable';
    w.audio = { file: b.audio.file, source: 'recorded' };
  }
  return w;
}

/** Sans enregistrement du parent, on (re)génère la voix de synthèse. */
async function ensureTts(w: Word) {
  if (w.audio?.source === 'recorded' || !ttsAvailable()) return;
  const file = `${randomUUID()}.wav`;
  try {
    await synthesize(fullText(w) + '.', join(AUDIO_DIR, file));
    w.audio = { file, source: 'tts' };
  } catch (e) {
    app.log.error(e, 'synthèse vocale impossible');
    return;
  }
  // version syllabe par syllabe : facultative, absente si le découpage n'est pas sûr
  if (!syllableTtsAvailable()) return;
  try {
    const syllables = `${randomUUID()}.wav`;
    w.audio.syllables = (await synthesizeSyllables(w, join(AUDIO_DIR, syllables))) ? syllables : null;
  } catch (e) {
    app.log.error(e, 'synthèse syllabe par syllabe impossible');
  }
}

app.get('/api/words', async () => readWords());

app.post('/api/words', async (req, reply) => {
  const v = validateWord(req.body);
  if (typeof v === 'string') return reply.code(400).send({ error: v });
  const word: Word = { id: randomUUID(), ...v };
  await ensureTts(word);
  writeWords([...readWords(), word]);
  return word;
});

app.put('/api/words/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  const words = readWords();
  const i = words.findIndex((w) => w.id === id);
  if (i < 0) return reply.code(404).send({ error: 'Mot introuvable' });
  const v = validateWord(req.body);
  if (typeof v === 'string') return reply.code(400).send({ error: v });
  const word: Word = { id, ...v };
  const old = words[i];
  // on garde la voix de synthèse existante si le texte n'a pas changé
  const sameSpeech = fullText(old) === fullText(word) && old.syllables.join('|') === word.syllables.join('|');
  if (!word.audio && old.audio?.source === 'tts' && sameSpeech && existsSync(join(AUDIO_DIR, old.audio.file))) word.audio = old.audio;
  else await ensureTts(word);
  words[i] = word;
  writeWords(words);
  collectGarbage();
  return word;
});

app.delete('/api/words/:id', async (req) => {
  const { id } = req.params as { id: string };
  writeWords(readWords().filter((w) => w.id !== id));
  // l'avancement des enfants sur ce mot n'a plus de sens
  const children = readChildren();
  for (const c of children) delete c.progress[id];
  writeChildren(children);
  collectGarbage();
  return { ok: true };
});

// --- images -------------------------------------------------------------------
const IMAGE_EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const AUDIO_EXT: Record<string, string> = {
  'audio/webm': 'webm', 'video/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
  'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav',
};
const baseType = (h: string | undefined) => (h ?? '').split(';')[0].trim().toLowerCase();

app.post('/api/images', async (req, reply) => {
  const ext = IMAGE_EXT[baseType(req.headers['content-type'])];
  if (!ext || !Buffer.isBuffer(req.body) || !req.body.length) return reply.code(400).send({ error: "Format d'image non pris en charge" });
  const file = `${randomUUID()}.${ext}`;
  writeFileSync(join(IMAGES_DIR, file), req.body);
  return { file };
});

app.post('/api/audio', async (req, reply) => {
  const ext = AUDIO_EXT[baseType(req.headers['content-type'])];
  if (!ext || !Buffer.isBuffer(req.body) || !req.body.length) return reply.code(400).send({ error: 'Format audio non pris en charge' });
  const file = `${randomUUID()}.${ext}`;
  writeFileSync(join(AUDIO_DIR, file), req.body);
  return { file };
});

// --- pictogrammes ARASAAC -------------------------------------------------------
app.get('/api/pictos', async (req, reply): Promise<Picto[] | void> => {
  const q = String((req.query as { q?: string }).q ?? '').trim();
  if (!q) return [];
  try {
    const r = await fetch(`https://api.arasaac.org/v1/pictograms/fr/search/${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(10_000) });
    if (r.status === 404) return [];
    if (!r.ok) throw new Error(`ARASAAC ${r.status}`);
    const list = (await r.json()) as { _id: number }[];
    return list.slice(0, 24).map((p) => ({ id: p._id, url: `https://static.arasaac.org/pictograms/${p._id}/${p._id}_300.png` }));
  } catch (e) {
    req.log.warn(e);
    return reply.code(502).send({ error: 'Recherche de pictogrammes indisponible (pas de connexion internet ?)' });
  }
});

app.post('/api/images/picto', async (req, reply) => {
  const id = Number((req.body as { id?: number } | null)?.id);
  if (!Number.isInteger(id) || id <= 0) return reply.code(400).send({ error: 'Pictogramme invalide' });
  try {
    const r = await fetch(`https://static.arasaac.org/pictograms/${id}/${id}_500.png`, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`ARASAAC ${r.status}`);
    const file = `${randomUUID()}.png`;
    writeFileSync(join(IMAGES_DIR, file), Buffer.from(await r.arrayBuffer()));
    return { file };
  } catch (e) {
    req.log.warn(e);
    return reply.code(502).send({ error: 'Téléchargement du pictogramme impossible' });
  }
});

/** Au démarrage : synthétise la voix des mots qui n'ont pas encore de son (mots d'exemple, voix ajoutée après coup). */
async function fillMissingAudio() {
  if (!ttsAvailable()) return;
  for (const w of readWords()) {
    if (w.audio?.source === 'recorded') continue;
    if (w.audio && existsSync(join(AUDIO_DIR, w.audio.file)) && (w.audio.syllables !== undefined || !syllableTtsAvailable())) continue;
    const target: Word = { ...w, audio: undefined };
    await ensureTts(target);
    if (!target.audio) return;
    // relecture avant écriture : la liste a pu changer pendant la synthèse
    writeWords(readWords().map((x) => (x.id === w.id && x.audio?.source !== 'recorded' ? { ...x, audio: target.audio } : x)));
  }
}

for (const sig of ['SIGTERM', 'SIGINT'] as const) process.on(sig, () => app.close().finally(() => process.exit(0)));

app
  .listen({ port: PORT, host: '0.0.0.0' })
  .then(() => {
    if (generatedPassword)
      app.log.warn(`Aucun ADMIN_PASSWORD défini : mot de passe administrateur provisoire pour ce démarrage → ${generatedPassword}`);
    return fillMissingAudio();
  })
  .catch((e) => {
    app.log.error(e);
    process.exit(1);
  });
