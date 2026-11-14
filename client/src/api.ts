import type { AdminConfig, Child, Info, Picto, Settings, Word, WordDraft, WordProgress } from '../../shared/types';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;
  if (body instanceof Blob) {
    headers['content-type'] = body.type;
    payload = body;
  } else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const r = await fetch(url, { method, headers, body: payload });
  if (!r.ok) {
    const msg = await r.json().then((j) => j.error as string).catch(() => '');
    throw new ApiError(r.status, msg || `Erreur ${r.status}`);
  }
  return r.json();
}

export const api = {
  info: () => request<Info>('GET', '/api/info'),

  // les enfants de ce navigateur (identifiés par cookie)
  me: () => request<Child[]>('GET', '/api/me'),
  createChild: (name: string, classCode: string) => request<Child>('POST', '/api/children', { name, classCode }),
  claimChild: (token: string) => request<Child>('POST', '/api/children/claim', { token }),
  forgetChild: (id: string) => request<{ ok: true }>('POST', `/api/children/${id}/forget`, {}),
  progress: (childId: string, wordId: string, success: boolean) => request<WordProgress>('POST', '/api/progress', { childId, wordId, success }),

  // administration
  adminSession: () => request<{ admin: boolean }>('GET', '/api/admin/session'),
  adminLogin: (password: string) => request<{ ok: true }>('POST', '/api/admin/login', { password }),
  adminLogout: () => request<{ ok: true }>('POST', '/api/admin/logout', {}),
  adminChildren: () => request<Child[]>('GET', '/api/admin/children'),
  renameChild: (id: string, name: string) => request<Child>('PUT', `/api/admin/children/${id}`, { name }),
  deleteChild: (id: string) => request<{ ok: true }>('DELETE', `/api/admin/children/${id}`),
  setProgress: (id: string, wordId: string, success: number) => request<Child>('PUT', `/api/admin/children/${id}/progress/${wordId}`, { success }),
  adminConfig: () => request<AdminConfig>('GET', '/api/admin/config'),
  saveAdminConfig: (c: AdminConfig) => request<AdminConfig>('PUT', '/api/admin/config', c),

  words: () => request<Word[]>('GET', '/api/words'),
  saveWord: (w: WordDraft) => (w.id ? request<Word>('PUT', `/api/words/${w.id}`, w) : request<Word>('POST', '/api/words', w)),
  deleteWord: (id: string) => request<{ ok: true }>('DELETE', `/api/words/${id}`),
  settings: () => request<Settings>('GET', '/api/settings'),
  saveSettings: (s: Settings) => request<Settings>('PUT', '/api/settings', s),
  pictos: (q: string) => request<Picto[]>('GET', `/api/pictos?q=${encodeURIComponent(q)}`),
  usePicto: (id: number) => request<{ file: string }>('POST', '/api/images/picto', { id }),
  uploadImage: (b: Blob) => request<{ file: string }>('POST', '/api/images', b),
  uploadAudio: (b: Blob) => request<{ file: string }>('POST', '/api/audio', b),
};

export const imageUrl = (file: string) => `/media/images/${file}`;
export const audioUrl = (file: string) => `/media/audio/${file}`;
