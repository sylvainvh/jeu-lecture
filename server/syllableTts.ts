import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fullText, type Word } from '../shared/types';
import { spokenUnits, stressed } from './phonemes';

/**
 * Son « syllabe par syllabe » (« la … mai … son »). On demande à Piper la
 * prononciation du mot entier, on la découpe en syllabes (voir phonemes.ts), puis
 * chaque syllabe est synthétisée à part, directement depuis ses phonèmes, avec le
 * modèle ONNX de la voix.
 */

const PIPER_DIR = dirname(process.env.PIPER_BIN ?? '/opt/piper/piper');
const PHONEMIZER = join(PIPER_DIR, 'piper_phonemize');
const MODEL = process.env.PIPER_MODEL ?? '/opt/piper-voices/fr_FR-siwis-medium.onnx';

const PAUSE_SECONDS = 0.35;
/** Un peu plus lent que la voix normale, pour bien détacher les sons. */
const LENGTH_SCALE = 1.25;

export const syllableTtsAvailable = () => existsSync(PHONEMIZER) && existsSync(MODEL) && existsSync(MODEL + '.json');

interface VoiceConfig {
  audio: { sample_rate: number };
  inference: { noise_scale: number; noise_w: number };
  phoneme_id_map: Record<string, number[]>;
}
interface Voice {
  config: VoiceConfig;
  run: (ids: number[]) => Promise<Float32Array>;
}

let voice: Promise<Voice> | null = null;
function loadVoice(): Promise<Voice> {
  return (voice ??= (async () => {
    const ort = await import('onnxruntime-node');
    const config = JSON.parse(readFileSync(MODEL + '.json', 'utf8')) as VoiceConfig;
    const session = await ort.InferenceSession.create(MODEL);
    const scales = new ort.Tensor('float32', Float32Array.from([config.inference.noise_scale, LENGTH_SCALE, config.inference.noise_w]), [3]);
    return {
      config,
      run: async (ids) => {
        const out = await session.run({
          input: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
          input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
          scales,
        });
        return out[session.outputNames[0]].data as Float32Array;
      },
    };
  })());
}

/** Phonèmes API du texte, tels que Piper les prononce. */
function phonemize(text: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const p = spawn(PHONEMIZER, ['-l', 'fr', '--espeak-data', join(PIPER_DIR, 'espeak-ng-data')], {
      env: { ...process.env, LD_LIBRARY_PATH: PIPER_DIR },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => {
      try {
        if (code !== 0) throw new Error(err.slice(-300));
        // une ligne JSON par phrase ; un mot n'en donne qu'une
        resolve(out.trim().split('\n').flatMap((line) => (JSON.parse(line) as { phonemes: string[] }).phonemes));
      } catch (e) {
        reject(new Error(`piper_phonemize (${code}) : ${e instanceof Error ? e.message : e}`));
      }
    });
    p.stdin.end(text + '\n');
  });
}

/** Même encodage que Piper : début, puis chaque phonème suivi d'un séparateur, fin. */
function toIds(unit: string[], map: Record<string, number[]>): number[] | null {
  const ids = [...map['^'], ...map['_']];
  for (const ch of [...unit.join('')]) {
    if (!map[ch]) return null;
    ids.push(...map[ch], ...map['_']);
  }
  return [...ids, ...map['$']];
}

function wav(samples: Int16Array, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + samples.length * 2, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(samples.length * 2, 40);
  return Buffer.concat([header, Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)]);
}

/**
 * Écrit le son syllabé du mot dans `outFile`. Renvoie false, sans rien écrire, si les
 * syllabes prononcées ne correspondent pas aux syllabes écrites : mieux vaut pas
 * de son qu'un son faux.
 */
export async function synthesizeSyllables(word: Pick<Word, 'determiner' | 'syllables'>, outFile: string): Promise<boolean> {
  const units = spokenUnits(await phonemize(fullText(word)), word.determiner, word.syllables);
  if (!units) return false;
  const { config, run } = await loadVoice();
  const rate = config.audio.sample_rate;
  const pause = new Int16Array(Math.round(rate * PAUSE_SECONDS));
  const parts: Int16Array[] = [];
  for (const unit of units) {
    const ids = toIds(stressed(unit), config.phoneme_id_map);
    if (!ids) return false;
    const audio = await run(ids);
    // même normalisation que Piper : chaque syllabe au même volume
    const peak = audio.reduce((m, v) => Math.max(m, Math.abs(v)), 0.01);
    if (parts.length) parts.push(pause);
    parts.push(Int16Array.from(audio, (v) => Math.round((v / peak) * 32767 * 0.9)));
  }
  const all = new Int16Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    all.set(p, offset);
    offset += p.length;
  }
  writeFileSync(outFile, wav(all, rate));
  return true;
}
