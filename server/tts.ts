import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const BIN = process.env.PIPER_BIN ?? '/opt/piper/piper';
const MODEL = process.env.PIPER_MODEL ?? '/opt/piper-voices/fr_FR-siwis-medium.onnx';

export const ttsAvailable = () => existsSync(BIN) && existsSync(MODEL);

let queue: Promise<unknown> = Promise.resolve();

/** Synthétise `text` en WAV avec Piper. Les appels sont traités un par un. */
export function synthesize(text: string, outFile: string): Promise<void> {
  const job = queue.then(
    () =>
      new Promise<void>((resolve, reject) => {
        const p = spawn(BIN, ['--model', MODEL, '--output_file', outFile], { stdio: ['pipe', 'ignore', 'pipe'] });
        let err = '';
        p.stderr.on('data', (d) => (err += d));
        p.on('error', reject);
        p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`piper (${code}) : ${err.slice(-400)}`))));
        p.stdin.end(text + '\n');
      }),
  );
  queue = job.catch(() => undefined);
  return job;
}
