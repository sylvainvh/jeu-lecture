import { useEffect, useMemo, useRef, useState } from 'react';
import { colorRuns, type RunKind } from '../../../shared/coloring';
import { propose, splitAt } from '../../../shared/syllabify';
import { fullText, type Picto, type Word, type WordAudio, type WordDraft } from '../../../shared/types';
import { api, audioUrl, imageUrl } from '../api';
import { useData } from '../data';
import { speak } from '../speech';
import { WordText } from './WordText';

interface Draft {
  text: string;
  determiner: string;
  chars: string[];
  cuts: Set<number>;
  silent: boolean[];
  image?: string;
  audio?: WordAudio;
}

const isLetter = (c: string) => /\p{L}/u.test(c);

function fromParts(determiner: string, syllables: string[], silent: boolean[]): Pick<Draft, 'determiner' | 'chars' | 'cuts' | 'silent'> {
  const cuts = new Set<number>();
  let n = 0;
  for (const s of syllables.slice(0, -1)) cuts.add((n += [...s].length));
  return { determiner, chars: [...syllables.join('')], cuts, silent };
}

function fromText(text: string) {
  const p = propose(text);
  return fromParts(p.determiner, p.syllables, p.silent);
}

/** Réduit une photo avant l'envoi (les photos de téléphone sont très lourdes). */
async function shrinkImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error('conversion impossible'))), type, 0.88));
}

export function WordEditor({ word, onClose, onSaved }: { word: Word | null; onClose: () => void; onSaved: (w: Word) => void }) {
  const { settings, info } = useData();
  const [d, setD] = useState<Draft>(() =>
    word
      ? { text: fullText(word), ...fromParts(word.determiner ?? '', word.syllables, word.silent), image: word.image, audio: word.audio }
      : { text: '', determiner: '', chars: [], cuts: new Set(), silent: [] },
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const syllables = useMemo(() => splitAt(d.chars, d.cuts), [d.chars, d.cuts]);
  const preview = { determiner: d.determiner || undefined, syllables, silent: d.silent };
  const body = d.chars.join('');

  // couleur de chaque lettre, pour l'éditeur
  const kinds = useMemo(() => {
    const out: RunKind[] = [];
    for (const r of colorRuns({ syllables, silent: d.silent })) for (const _ of r.text) out.push(r.kind);
    return out;
  }, [syllables, d.silent]);

  const setText = (text: string) => setD({ ...d, text, ...fromText(text) });
  const toggleCut = (i: number) => {
    const cuts = new Set(d.cuts);
    cuts.has(i) ? cuts.delete(i) : cuts.add(i);
    setD({ ...d, cuts });
  };
  const toggleSilent = (i: number) => setD({ ...d, silent: d.silent.map((v, k) => (k === i ? !v : v)) });

  const run = async (fn: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue');
    } finally {
      setBusy(false);
    }
  };

  // --- image ---
  const [query, setQuery] = useState('');
  const [pictos, setPictos] = useState<Picto[] | null>(null);
  const [searching, setSearching] = useState(false);
  const search = async (q: string) => {
    if (!q.trim()) return setPictos(null);
    setSearching(true);
    setError('');
    try {
      setPictos(await api.pictos(q.trim()));
    } catch (e) {
      setPictos(null);
      setError(e instanceof Error ? e.message : 'Recherche impossible');
    } finally {
      setSearching(false);
    }
  };
  // recherche automatique un instant après la saisie du mot
  useEffect(() => {
    setQuery(body);
    if (d.image || !body.trim()) return;
    const t = setTimeout(() => search(body), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);

  const pickPicto = (id: number) => run(async () => {
      const { file } = await api.usePicto(id);
      setD((cur) => ({ ...cur, image: file }));
    });
  const uploadImage = (file?: File) =>
    file &&
    run(async () => {
      const { file: saved } = await api.uploadImage(await shrinkImage(file));
      setD((cur) => ({ ...cur, image: saved }));
    });

  // --- son ---
  const recorder = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const canRecord = window.isSecureContext && !!navigator.mediaDevices?.getUserMedia && 'MediaRecorder' in window;
  const sendAudio = (blob: Blob) =>
    run(async () => {
      const { file } = await api.uploadAudio(blob);
      setD((cur) => ({ ...cur, audio: { file, source: 'recorded' } }));
    });
  const toggleRecord = async () => {
    if (recording) return recorder.current?.stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        sendAudio(new Blob(chunks, { type: rec.mimeType.split(';')[0] || 'audio/webm' }));
      };
      recorder.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError("Impossible d'accéder au micro");
    }
  };
  useEffect(() => () => recorder.current?.state === 'recording' ? recorder.current.stop() : undefined, []);

  const textUnchanged = !!word && fullText(word) === fullText(preview);
  const listen = () => {
    if (d.audio?.source === 'recorded') new Audio(audioUrl(d.audio.file)).play();
    else speak({ ...preview, audio: textUnchanged ? word!.audio : undefined });
  };

  const save = () =>
    run(async () => {
      const draft: WordDraft = {
        id: word?.id,
        enabled: word?.enabled ?? true,
        determiner: d.determiner.trim() || undefined,
        syllables,
        silent: d.silent,
        image: d.image,
        audio: d.audio?.source === 'recorded' ? d.audio : undefined,
      };
      onSaved(await api.saveWord(draft));
    });

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel editor">
        <h2>{word ? 'Modifier le mot' : 'Nouveau mot'}</h2>

        <label className="field">
          <span>Le mot (avec son déterminant s'il y en a un)</span>
          <input autoFocus value={d.text} maxLength={60} placeholder="un squelette" onChange={(e) => setText(e.target.value)} />
        </label>

        {d.chars.length > 0 && (
          <>
            <h3>1. Vérifie le découpage</h3>
            <p className="hint">
              Clique <b>entre deux lettres</b> pour couper ou recoller une syllabe, et <b>sur une lettre</b> pour la marquer muette.
            </p>
            <div className="letters">
              {d.determiner && <span className="det" style={{ color: settings.colors.determiner }}>{d.determiner}</span>}
              {d.chars.map((c, i) => (
                <span key={i} className="letter-group">
                  {i > 0 && (
                    <button className={`cut ${d.cuts.has(i) ? 'on' : ''}`} onClick={() => toggleCut(i)} aria-label="Couper ou recoller ici">
                      <i />
                    </button>
                  )}
                  {isLetter(c) ? (
                    <button
                      className={`letter ${d.silent[i] ? 'silent' : ''}`}
                      style={{ color: settings.colors[kinds[i] ?? 'a'] }}
                      onClick={() => toggleSilent(i)}
                      title={d.silent[i] ? 'Lettre muette' : 'Lettre prononcée'}
                    >
                      {c}
                    </button>
                  ) : (
                    <span className="letter sep">{c === ' ' ? '␣' : c}</span>
                  )}
                </span>
              ))}
            </div>
            <label className="field inline">
              <span>Déterminant</span>
              <input value={d.determiner} maxLength={20} placeholder="aucun" onChange={(e) => setD({ ...d, determiner: e.target.value })} />
            </label>

            <div className="preview">
              <WordText word={preview} colors={settings.colors} font="script" />
              <WordText word={preview} colors={settings.colors} font="cursive" />
            </div>

            <h3>2. Choisis l'image</h3>
            <div className="image-row">
              <div className="thumb big">{d.image ? <img src={imageUrl(d.image)} alt="" /> : <span>pas d'image</span>}</div>
              <div className="grow">
                <form className="row" onSubmit={(e) => (e.preventDefault(), search(query))}>
                  <input value={query} placeholder="Chercher un pictogramme" onChange={(e) => setQuery(e.target.value)} />
                  <button className="btn small" disabled={searching}>{searching ? '…' : 'Chercher'}</button>
                </form>
                <div className="row">
                  <label className="btn small ghost">
                    📁 Ma propre image
                    <input type="file" accept="image/*" hidden onChange={(e) => (uploadImage(e.target.files?.[0]), (e.target.value = ''))} />
                  </label>
                  {d.image && <button className="btn small ghost" onClick={() => setD({ ...d, image: undefined })}>Retirer l'image</button>}
                </div>
              </div>
            </div>
            {pictos && (
              <div className="pictos">
                {pictos.length === 0 && <p className="hint">Aucun pictogramme trouvé. Essaie un autre mot, ou envoie ta propre image.</p>}
                {pictos.map((p) => (
                  <button key={p.id} onClick={() => pickPicto(p.id)} disabled={busy}>
                    <img src={p.url} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}

            <h3>3. Le son</h3>
            <div className="row wrap">
              <span className="hint grow">
                {d.audio?.source === 'recorded'
                  ? 'Son enregistré par toi.'
                  : info.tts
                    ? "Voix de synthèse, générée à l'enregistrement du mot."
                    : 'Voix du navigateur (pas de synthèse sur ce serveur).'}
              </span>
              <button className="btn small ghost" onClick={listen}>🔊 Écouter</button>
              {canRecord && (
                <button className={`btn small ${recording ? 'red' : 'ghost'}`} onClick={toggleRecord}>
                  {recording ? '⏹ Arrêter' : '🎙 Enregistrer ma voix'}
                </button>
              )}
              <label className="btn small ghost">
                📁 Importer un son
                <input type="file" accept="audio/*" hidden onChange={(e) => (e.target.files?.[0] && sendAudio(e.target.files[0]), (e.target.value = ''))} />
              </label>
              {d.audio?.source === 'recorded' && (
                <button className="btn small ghost" onClick={() => setD({ ...d, audio: undefined })}>Revenir à la voix de synthèse</button>
              )}
            </div>
            {!canRecord && <p className="hint">L'enregistrement au micro n'est possible que si le jeu est ouvert en HTTPS. L'import d'un fichier son fonctionne toujours.</p>}
          </>
        )}

        {error && <p className="warn">{error}</p>}
        <div className="row end">
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn green" disabled={busy || !body.trim()} onClick={save}>
            {busy ? 'Un instant…' : 'Valider et enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
