#!/usr/bin/env node
/**
 * One-command tutorial capture.
 *
 * Builds the web app, serves the production build on port 1701, drives
 * it with Playwright at 1920x1080, speaks the script with Piper, and
 * muxes a captioned MP4. No game install is mounted.
 *
 *   pnpm tutorial
 */
import { spawn } from 'node:child_process';
import { copyFileSync, createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordSession } from './capture.mjs';
import { buildNarration, ffprobe, grabFrames, muxVideo, writeCaptions, writeScript } from './mux.mjs';
import { OPEN_MS, PAD_MS, segments } from './segments.mjs';
import { VOICE_ID, ensurePiper, probeDuration, synthesize } from './tts.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cacheDir = join(root, 'tools/tutorial/.cache');
const outDir = join(root, 'tools/tutorial/out');
const scriptPath = join(root, 'docs/tutorial/script.md');
const TAIL_MS = 400;
const MIN_MS = 120_000;
const MAX_MS = 240_000;

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  return process.argv[index + 1] ?? null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanEnv() {
  const env = { ...process.env };
  for (const key of ['SFC2_INSTALL', 'SFC2_REFERENCE', 'SFC2_EXTRACTED']) {
    if (env[key]) console.log(`Ignoring ${key}. This capture does not mount an install.`);
    delete env[key];
  }
  return env;
}

function spawnLogged(cmd, args, { cwd, env, logPath }) {
  mkdirSync(dirname(logPath), { recursive: true });
  const log = createWriteStream(logPath);
  const child = spawn(cmd, args, {
    cwd,
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  return child;
}

function stop(child) {
  if (!child || child.exitCode !== null) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

async function waitForHttp(url, child) {
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`preview server exited ${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  throw new Error(`preview server did not answer ${url}`);
}

function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: root, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}`));
    });
  });
}

function fontsDir() {
  const candidates = ['/usr/share/fonts/truetype/dejavu', '/usr/share/fonts/dejavu'];
  for (const dir of candidates) if (existsSync(dir)) return dir;
  throw new Error('DejaVu Sans is required for the burned-in captions.');
}

async function speak(piper, chosen, lengthScale) {
  const voiceDir = join(outDir, 'voice');
  mkdirSync(voiceDir, { recursive: true });
  let total = 0;
  for (const segment of chosen) {
    const dest = join(voiceDir, `${segment.id}.wav`);
    await synthesize({
      binary: piper.binary,
      model: piper.model,
      text: segment.narration,
      dest,
      lengthScale,
    });
    segment.wav = dest;
    segment.audioMs = await probeDuration(dest);
    total += segment.audioMs;
  }
  return total;
}

function estimate(chosen) {
  return OPEN_MS + TAIL_MS + chosen.reduce((sum, segment) => sum + segment.audioMs + PAD_MS, 0);
}

async function main() {
  const port = Number(argValue('--port') ?? process.env.TUTORIAL_PORT ?? '1701');
  if (!Number.isInteger(port) || port < 1) throw new Error('bad port');
  const screenshot = hasFlag('--screenshot');
  const skipBuild = hasFlag('--skip-build');
  const only = argValue('--only');
  const chosen = only
    ? segments.filter((segment) => only.split(',').includes(segment.id))
    : segments;
  if (chosen.length === 0) throw new Error('no segments selected');
  const env = cleanEnv();
  const origin = `http://127.0.0.1:${port}`;

  if (!skipBuild) {
    console.log('Building the web app');
    await run('pnpm', ['build:web'], env);
  }
  console.log('Checking Playwright Chromium');
  await run('pnpm', ['exec', 'playwright', 'install', 'chromium'], env);

  mkdirSync(outDir, { recursive: true });
  const previewLog = join(outDir, 'preview.log');
  const preview = spawnLogged(
    'pnpm',
    ['exec', 'vite', 'preview', '--config', 'web/vite.config.ts', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: root, env, logPath: previewLog },
  );
  try {
    await waitForHttp(`${origin}/`, preview);
    console.log(`Preview is up at ${origin}`);
    if (screenshot) {
      const shot = join(outDir, 'layout.png');
      const result = await recordSession({ origin, segments: chosen, outDir, screenshot: shot });
      console.log(`layout ${JSON.stringify(result.layout)}`);
      console.log(`screenshot ${shot}`);
      return;
    }

    const piper = await ensurePiper(cacheDir);
    let lengthScale = Number(argValue('--length-scale') ?? '1');
    console.log(`Synthesizing narration at length scale ${lengthScale}`);
    let spoken = await speak(piper, chosen, lengthScale);
    if (!only && !argValue('--length-scale') && spoken > 200_000) {
      lengthScale = Math.max(0.86, 175_000 / spoken);
      lengthScale = Math.round(lengthScale * 100) / 100;
      console.log(`Speech is ${Math.round(spoken / 1000)}s. Resynthesizing at ${lengthScale}.`);
      spoken = await speak(piper, chosen, lengthScale);
    }
    const planned = estimate(chosen);
    console.log(`Planned duration ${Math.round(planned / 1000)}s (speech ${Math.round(spoken / 1000)}s)`);
    if (!only && (planned < MIN_MS || planned > MAX_MS)) {
      throw new Error(`Planned duration ${planned}ms is outside ${MIN_MS}-${MAX_MS}.`);
    }

    rmSync(join(outDir, 'capture.webm'), { force: true });
    const recorded = await recordSession({ origin, segments: chosen, outDir });
    const capturePath = join(outDir, 'capture.webm');
    copyFileSync(recorded.videoPath, capturePath);
    console.log(
      `Recorded lead ${Math.round(recorded.leadMs)}ms, tail ${Math.round(recorded.tailMs)}ms, skew ${Math.round(recorded.pageSkewMs)}ms`,
    );
    const contentMs = recorded.tailMs;
    const marginV = recorded.layout.height - recorded.layout.stageBottom + 10;
    const captions = join(outDir, 'captions.ass');
    writeCaptions({
      path: captions,
      segments: chosen,
      walls: recorded.walls,
      openMs: OPEN_MS,
      marginV,
    });
    const narration = join(outDir, 'narration.wav');
    await buildNarration({
      segments: chosen,
      walls: recorded.walls,
      openMs: OPEN_MS,
      tailMs: contentMs,
      dest: narration,
    });
    const mp4 = argValue('--out') ?? process.env.TUTORIAL_OUT ?? join(outDir, 'sfc2js-tutorial-1080p.mp4');
    console.log('Muxing');
    await muxVideo({
      videoPath: capturePath,
      leadMs: recorded.leadMs,
      durationMs: contentMs,
      narration,
      captions,
      fontsDir: fontsDir(),
      dest: mp4,
    });
    if (!only) {
      writeScript({
        path: scriptPath,
        segments: chosen,
        walls: recorded.walls,
        openMs: OPEN_MS,
        voice: VOICE_ID,
        lengthScale,
        port,
      });
    }
    const info = await ffprobe(mp4);
    const video = info.streams.find((stream) => stream.codec_type === 'video');
    const audio = info.streams.find((stream) => stream.codec_type === 'audio');
    const duration = Number(info.format.duration);
    console.log(
      `video ${video?.width}x${video?.height} ${video?.codec_name} ${duration.toFixed(2)}s audio ${audio?.codec_name ?? 'none'}`,
    );
    if (!video || video.width !== 1920 || video.height !== 1080) {
      throw new Error(`expected 1920x1080, got ${video?.width}x${video?.height}`);
    }
    if (!audio) throw new Error('mux produced no audio stream');
    if (!only && (duration < MIN_MS / 1000 || duration > MAX_MS / 1000)) {
      throw new Error(`duration ${duration}s is outside 120-240s`);
    }
    let cursor = OPEN_MS;
    const frames = [['open', 300]];
    for (const [index, segment] of chosen.entries()) {
      frames.push([segment.id, cursor + Math.min(800, recorded.walls[index] / 3)]);
      cursor += recorded.walls[index];
    }
    const frameDir = join(outDir, 'frames');
    await grabFrames(mp4, frames, frameDir);
    const artifactDir = '/opt/cursor/artifacts';
    if (existsSync(artifactDir)) {
      copyFileSync(mp4, join(artifactDir, 'sfc2js-tutorial-1080p.mp4'));
      if (existsSync(scriptPath)) copyFileSync(scriptPath, join(artifactDir, 'sfc2js-tutorial-script.md'));
      for (const name of ['intro', 'weapons', 'shields', 'mouse', 'het', 'close']) {
        const src = join(frameDir, `${name}.png`);
        if (existsSync(src)) copyFileSync(src, join(artifactDir, `tutorial-${name}.png`));
      }
    }
    console.log(`Wrote ${mp4}`);
    console.log(`Wrote ${scriptPath}`);
  } finally {
    stop(preview);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
