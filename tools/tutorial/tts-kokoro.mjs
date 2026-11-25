/**
 * Kokoro-82M v1.0, voice af_heart, via the ONNX export.
 * Weights are downloaded at capture time and are not stored in git.
 *
 * Model card: https://huggingface.co/hexgrad/Kokoro-82M
 * License: Apache-2.0 https://www.apache.org/licenses/LICENSE-2.0
 * The card says training used permissive and non-copyrighted audio
 * (public domain, Apache, MIT, and synthetic audio from closed systems),
 * plus the CC BY sets named in the card. af_heart is a stock voice in
 * that release, not a clone of a named person.
 */
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const MODEL_URL = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx';
const VOICES_URL = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin';
const MODEL_SHA = '7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5';
const VOICES_SHA = 'bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d';

export const KOKORO_VOICE = 'af_heart';
export const VOICE_ID = 'Kokoro-82M v1.0, voice af_heart (Apache-2.0)';

const here = dirname(fileURLToPath(import.meta.url));

function sha256(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function download(url, dest, expected) {
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest)) {
    const got = await sha256(dest);
    if (got === expected) return;
  }
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`download failed ${response.status} ${url}`);
  const file = createWriteStream(dest);
  await pipeline(Readable.fromWeb(response.body), file);
  const got = await sha256(dest);
  if (got !== expected) throw new Error(`checksum mismatch for ${dest}: ${got}`);
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let err = '';
    child.stderr.on('data', (chunk) => {
      err += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(err);
      else reject(new Error(`${cmd} exited ${code}\n${err.slice(-1500)}`));
    });
  });
}

export async function ensureKokoro(cacheDir) {
  const dir = join(cacheDir, 'kokoro');
  const model = join(dir, 'kokoro-v1.0.onnx');
  const voices = join(dir, 'voices-v1.0.bin');
  const venv = join(cacheDir, 'venv');
  const python = join(venv, 'bin', 'python');
  await download(MODEL_URL, model, MODEL_SHA);
  await download(VOICES_URL, voices, VOICES_SHA);
  if (!existsSync(python)) {
    await run('python3', ['-m', 'venv', venv]);
    await run(python, ['-m', 'pip', 'install', '--quiet', 'kokoro-onnx==0.6.1', 'soundfile==0.14.0']);
  }
  return { python, model, voices, script: join(here, 'kokoro_say.py') };
}

export async function synthesizeKokoro({ python, model, voices, script, text, dest, speed }) {
  mkdirSync(dirname(dest), { recursive: true });
  await new Promise((resolve, reject) => {
    const child = spawn(python, [script, model, voices, KOKORO_VOICE, String(speed), dest], {
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    let err = '';
    child.stderr.on('data', (chunk) => {
      err += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`kokoro exited ${code}\n${err.slice(-1500)}`));
    });
    child.stdin.end(text);
  });
}
