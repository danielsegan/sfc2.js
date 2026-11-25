/**
 * Local Piper speech. The voice model is downloaded on demand and
 * checked against a pinned hash. It is not stored in git.
 *
 * Voice: en_US-ljspeech-medium.
 * Dataset: LJ Speech, public domain (https://keithito.com/LJ-Speech-Dataset/).
 * Trained from scratch for Piper (MIT). Not a finetune of a research-only voice.
 */
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';

const PIPER_URL = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz';
const PIPER_SHA = 'a50cb45f355b7af1f6d758c1b360717877ba0a398cc8cbe6d2a7a3a26e225992';
const VOICE_BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/ljspeech/medium';
const VOICE_NAME = 'en_US-ljspeech-medium';
const VOICE_SHA = {
  onnx: '6f52a751e2349abe7a76735eb09dc1875298c77ea2342ffd2fef79ff81b87f22',
  json: '141d612cc0a95ed7efc1ca936b845c2364967f2e9217c5dbfcf69fc4d6c65860',
};

export const VOICE_ID = `${VOICE_NAME} (LJ Speech, public domain)`;

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
      else reject(new Error(`${cmd} exited ${code}\n${err}`));
    });
  });
}

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
    throw new Error(`checksum mismatch for ${dest}`);
  }
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`download failed ${response.status} ${url}`);
  const file = createWriteStream(dest);
  await pipeline(response.body, file);
  const got = await sha256(dest);
  if (got !== expected) {
    throw new Error(`checksum mismatch for ${dest}: ${got}`);
  }
}

export async function ensurePiper(cacheDir) {
  const piperDir = join(cacheDir, 'piper');
  const binary = join(piperDir, 'piper');
  const voiceDir = join(cacheDir, 'voices');
  const model = join(voiceDir, `${VOICE_NAME}.onnx`);
  const config = join(voiceDir, `${VOICE_NAME}.onnx.json`);
  if (!existsSync(binary)) {
    const tar = join(cacheDir, 'piper_linux_x86_64.tar.gz');
    await download(PIPER_URL, tar, PIPER_SHA);
    mkdirSync(piperDir, { recursive: true });
    await run('tar', ['-xzf', tar, '-C', cacheDir]);
  }
  if (!existsSync(binary)) throw new Error('piper binary missing after extract');
  await download(`${VOICE_BASE}/${VOICE_NAME}.onnx`, model, VOICE_SHA.onnx);
  await download(`${VOICE_BASE}/${VOICE_NAME}.onnx.json`, config, VOICE_SHA.json);
  if (statSync(model).size < 1_000_000) throw new Error('voice model is unexpectedly small');
  return { binary, model, config };
}

export async function synthesize({ binary, model, text, dest, lengthScale }) {
  mkdirSync(dirname(dest), { recursive: true });
  await new Promise((resolve, reject) => {
    const child = spawn(
      binary,
      [
        '--model', model,
        '--output_file', dest,
        '--length_scale', String(lengthScale),
        '--sentence_silence', '0.12',
        '--quiet',
      ],
      { stdio: ['pipe', 'ignore', 'pipe'] },
    );
    let err = '';
    child.stderr.on('data', (chunk) => {
      err += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`piper exited ${code}\n${err}`));
    });
    child.stdin.end(text);
  });
}

export async function probeDuration(path) {
  const out = await new Promise((resolve, reject) => {
    const child = spawn(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let text = '';
    let err = '';
    child.stdout.on('data', (chunk) => {
      text += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      err += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(text.trim());
      else reject(new Error(`ffprobe exited ${code}\n${err}`));
    });
  });
  const seconds = Number(out);
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`bad duration for ${path}`);
  return Math.round(seconds * 1000);
}
