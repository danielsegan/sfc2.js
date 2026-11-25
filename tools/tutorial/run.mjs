#!/usr/bin/env node
/**
 * Tutorial capture.
 *
 * Builds the web app, serves the production build on port 1701, drives
 * it with Playwright at 1920x1080, speaks the script, and muxes a
 * captioned MP4. No game install is mounted.
 *
 *   pnpm tutorial        v1, Piper
 *   pnpm tutorial:v2     v2, Kokoro (pass --tts piper to fall back)
 */
import { spawn } from 'node:child_process';
import { copyFileSync, createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordSession } from './capture.mjs';
import { buildNarration, ffprobe, grabFrames, muxVideo, writeCaptions, writeScript } from './mux.mjs';
import * as v1 from './segments.mjs';
import * as v2 from './segments-v2.mjs';
import { ensureKokoro, synthesizeKokoro, VOICE_ID as KOKORO_VOICE_ID } from './tts-kokoro.mjs';
import { VOICE_ID as PIPER_VOICE_ID, ensurePiper, probeDuration, synthesize } from './tts.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cacheDir = join(root, 'tools/tutorial/.cache');
const TAIL_MS = 400;

const v1Doc = {
  title: 'SFC2.js control tutorial',
  lede: 'Narration for the 1080p capture of the production web build. Vite preview serves it on port 1701. The page boots the synthetic skirmish and the banner names `engine/duel/fixture.ts`. No install is mounted and no game files are read.',
  voiceNote: 'Piper sentence gap is 0.12 s. There is no music. Captions are burned in, and the key line names the control for that segment.',
  notes: 'The capture selects UI scale 1× before the first paint so the field and the console both fit in 1920×1080. The page\'s own fit at this size is 1.25×. Time scale stays on the page default of 4× until the high-energy-turn segment sets it to 1×, then puts it back to 4×.',
  skipped: v1.skipped,
  notInCut: v1.notInCut,
  sources: v1.sources,
};

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

function lessonFromArgs() {
  const name = argValue('--lesson') ?? process.env.TUTORIAL_LESSON ?? 'v1';
  if (name === 'v1') {
    return {
      id: 'v1',
      segments: v1.segments,
      openMs: v1.OPEN_MS,
      padMs: v1.PAD_MS,
      minMs: 120_000,
      maxMs: 240_000,
      targetMs: 175_000,
      outDir: join(root, 'tools/tutorial/out'),
      scriptPath: join(root, 'docs/tutorial/script.md'),
      mp4Name: 'sfc2js-tutorial-1080p.mp4',
      artifactMp4: 'sfc2js-tutorial-1080p.mp4',
      artifactScript: 'sfc2js-tutorial-script.md',
      framePrefix: 'tutorial-',
      frameNames: ['intro', 'weapons', 'shields', 'mouse', 'het', 'close'],
      tts: 'piper',
      doc: v1Doc,
    };
  }
  if (name === 'v2') {
    return {
      id: 'v2',
      segments: v2.segments,
      openMs: v2.OPEN_MS,
      padMs: v2.PAD_MS,
      minMs: 240_000,
      maxMs: 360_000,
      targetMs: 300_000,
      outDir: join(root, 'tools/tutorial/out-v2'),
      scriptPath: join(root, 'docs/tutorial/script-v2.md'),
      mp4Name: 'sfc2js-tutorial-v2.mp4',
      artifactMp4: 'sfc2js-tutorial-v2.mp4',
      artifactScript: 'script-v2.md',
      framePrefix: 'tutorial-v2-',
      frameNames: ['intro', 'presets', 'arming', 'shields', 'arcs', 'het', 'close'],
      tts: argValue('--tts') ?? 'kokoro',
      doc: v2.doc,
    };
  }
  throw new Error(`unknown lesson ${name}`);
}

async function speakPiper(lesson, chosen, lengthScale) {
  const piper = await ensurePiper(cacheDir);
  const voiceDir = join(lesson.outDir, 'voice');
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
  return { total, voiceId: PIPER_VOICE_ID };
}

async function speakKokoro(lesson, chosen, speed) {
  const kokoro = await ensureKokoro(cacheDir);
  const voiceDir = join(lesson.outDir, 'voice');
  mkdirSync(voiceDir, { recursive: true });
  let total = 0;
  for (const segment of chosen) {
    const dest = join(voiceDir, `${segment.id}.wav`);
    await synthesizeKokoro({ ...kokoro, text: segment.narration, dest, speed });
    segment.wav = dest;
    segment.audioMs = await probeDuration(dest);
    total += segment.audioMs;
  }
  return { total, voiceId: KOKORO_VOICE_ID };
}

function estimate(lesson, chosen) {
  return lesson.openMs + TAIL_MS + chosen.reduce((sum, segment) => sum + segment.audioMs + lesson.padMs, 0);
}

async function main() {
  const port = Number(argValue('--port') ?? process.env.TUTORIAL_PORT ?? '1701');
  if (!Number.isInteger(port) || port < 1) throw new Error('bad port');
  const screenshot = hasFlag('--screenshot');
  const skipBuild = hasFlag('--skip-build');
  const lesson = lessonFromArgs();
  const outDir = lesson.outDir;
  const scriptPath = lesson.scriptPath;
  const only = argValue('--only');
  const chosen = only
    ? lesson.segments.filter((segment) => only.split(',').includes(segment.id))
    : lesson.segments;
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
      const result = await recordSession({
        origin,
        segments: chosen,
        outDir,
        screenshot: shot,
        openMs: lesson.openMs,
        padMs: lesson.padMs,
      });
      console.log(`layout ${JSON.stringify(result.layout)}`);
      console.log(`screenshot ${shot}`);
      return;
    }

    const engine = lesson.tts;
    if (engine !== 'piper' && engine !== 'kokoro') throw new Error(`unknown tts ${engine}`);
    let pace = Number(argValue('--length-scale') ?? (engine === 'kokoro' ? '1' : '1'));
    console.log(`Lesson ${lesson.id}. Synthesizing with ${engine} at ${pace}`);
    let spoken = engine === 'kokoro'
      ? await speakKokoro(lesson, chosen, pace)
      : await speakPiper(lesson, chosen, pace);
    if (!only && !argValue('--length-scale')) {
      const plannedNow = estimate(lesson, chosen);
      if (plannedNow < lesson.minMs || plannedNow > lesson.maxMs) {
        const ratio = engine === 'kokoro' ? spoken.total / lesson.targetMs : lesson.targetMs / spoken.total;
        const next = Math.round(pace * ratio * 100) / 100;
        pace = Math.min(1.15, Math.max(engine === 'kokoro' ? 0.75 : 0.86, next));
        console.log(`Speech is ${Math.round(spoken.total / 1000)}s. Resynthesizing at ${pace}.`);
        spoken = engine === 'kokoro'
          ? await speakKokoro(lesson, chosen, pace)
          : await speakPiper(lesson, chosen, pace);
      }
    }
    const planned = estimate(lesson, chosen);
    console.log(`Planned duration ${Math.round(planned / 1000)}s (speech ${Math.round(spoken.total / 1000)}s)`);
    if (!only && (planned < lesson.minMs || planned > lesson.maxMs)) {
      throw new Error(`Planned duration ${planned}ms is outside ${lesson.minMs}-${lesson.maxMs}.`);
    }

    rmSync(join(outDir, 'capture.webm'), { force: true });
    const recorded = await recordSession({
      origin,
      segments: chosen,
      outDir,
      openMs: lesson.openMs,
      padMs: lesson.padMs,
    });
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
      openMs: lesson.openMs,
      marginV,
    });
    const narration = join(outDir, 'narration.wav');
    await buildNarration({
      segments: chosen,
      walls: recorded.walls,
      openMs: lesson.openMs,
      tailMs: contentMs,
      dest: narration,
    });
    const mp4 = argValue('--out') ?? process.env.TUTORIAL_OUT ?? join(outDir, lesson.mp4Name);
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
        openMs: lesson.openMs,
        voice: spoken.voiceId,
        lengthScale: pace,
        port,
        doc: lesson.doc,
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
    if (!only && (duration < lesson.minMs / 1000 || duration > lesson.maxMs / 1000)) {
      throw new Error(`duration ${duration}s is outside ${lesson.minMs / 1000}-${lesson.maxMs / 1000}s`);
    }
    let cursor = lesson.openMs;
    const frames = [['open', 300]];
    for (const [index, segment] of chosen.entries()) {
      frames.push([segment.id, cursor + Math.min(800, recorded.walls[index] / 3)]);
      cursor += recorded.walls[index];
    }
    const frameDir = join(outDir, 'frames');
    await grabFrames(mp4, frames, frameDir);
    const artifactDir = '/opt/cursor/artifacts';
    if (existsSync(artifactDir)) {
      copyFileSync(mp4, join(artifactDir, lesson.artifactMp4));
      if (existsSync(scriptPath)) copyFileSync(scriptPath, join(artifactDir, lesson.artifactScript));
      for (const name of lesson.frameNames) {
        const src = join(frameDir, `${name}.png`);
        if (existsSync(src)) copyFileSync(src, join(artifactDir, `${lesson.framePrefix}${name}.png`));
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
