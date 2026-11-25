/**
 * Burn captions, mux the voice, and write the timestamped script.
 * No music. The only audio is the synthesized narration plus silence.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

function ffmpeg(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stderr.on('data', (chunk) => {
      err += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}\n${err.slice(-2000)}`));
    });
  });
}

export function ffprobe(path) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'ffprobe',
      ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => {
      out += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      err += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`ffprobe exited ${code}\n${err}`));
      else resolve(JSON.parse(out));
    });
  });
}

function assTime(ms) {
  const clamped = Math.max(0, ms);
  const cent = Math.floor(clamped / 10) % 100;
  const total = Math.floor(clamped / 1000);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cent).padStart(2, '0')}`;
}

export function clock(ms) {
  const total = Math.max(0, Math.round(ms / 100) / 10);
  const m = Math.floor(total / 60);
  const s = (total - m * 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

function escapeAss(text) {
  return text.replaceAll('\\', '\\\\').replaceAll('{', '\\{').replaceAll('}', '\\}').replaceAll('\n', '\\N');
}

export function writeCaptions({ path, segments, walls, openMs, marginV }) {
  const speechMargin = Math.max(36, Math.round(marginV));
  const keyMargin = speechMargin + 210;
  const lines = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1920',
    'PlayResY: 1080',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Keys,DejaVu Sans,40,&H00FFFFFF,&H000000FF,&H00000000,&HC0101820,-1,0,0,0,100,100,1,0,3,14,0,2,80,80,${keyMargin},1`,
    `Style: Speech,DejaVu Sans,30,&H00F2E8D8,&H000000FF,&H00000000,&HC0101820,0,0,0,0,100,100,0,0,3,12,0,2,100,100,${speechMargin},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    `Dialogue: 1,${assTime(0)},${assTime(openMs)},Keys,,0,0,0,,${escapeAss('SFC2.js')}`,
    `Dialogue: 0,${assTime(0)},${assTime(openMs)},Speech,,0,0,0,,${escapeAss('Synthetic fixture. No game install.')}`,
  ];
  let cursor = openMs;
  segments.forEach((segment, index) => {
    const end = cursor + walls[index];
    lines.push(`Dialogue: 1,${assTime(cursor)},${assTime(end)},Keys,,0,0,0,,${escapeAss(segment.keys)}`);
    lines.push(`Dialogue: 0,${assTime(cursor)},${assTime(end)},Speech,,0,0,0,,${escapeAss(segment.narration)}`);
    cursor = end;
  });
  writeFileSync(path, `${lines.join('\n')}\n`);
  return cursor;
}

export async function buildNarration({ segments, walls, openMs, tailMs, dest }) {
  const rate = 22050;
  const args = ['-y'];
  const filters = [];
  const labels = [];
  let index = 0;
  const addSilence = (ms) => {
    if (ms < 20) return;
    args.push('-f', 'lavfi', '-t', (ms / 1000).toFixed(3), '-i', `anullsrc=r=${rate}:cl=mono`);
    const label = `s${index}`;
    filters.push(`[${index}:a]aformat=sample_fmts=s16:sample_rates=${rate}:channel_layouts=mono[${label}]`);
    labels.push(`[${label}]`);
    index += 1;
  };
  const addFile = (file) => {
    args.push('-i', file);
    const label = `s${index}`;
    filters.push(`[${index}:a]aformat=sample_fmts=s16:sample_rates=${rate}:channel_layouts=mono[${label}]`);
    labels.push(`[${label}]`);
    index += 1;
  };
  addSilence(openMs);
  segments.forEach((segment, i) => {
    addFile(segment.wav);
    addSilence(walls[i] - segment.audioMs);
  });
  const used = openMs + walls.reduce((sum, ms) => sum + ms, 0);
  addSilence(tailMs - used);
  filters.push(`${labels.join('')}concat=n=${labels.length}:v=0:a=1[out]`);
  args.push('-filter_complex', filters.join(';'), '-map', '[out]', '-c:a', 'pcm_s16le', dest);
  await ffmpeg(args);
}

export async function muxVideo({ videoPath, leadMs, durationMs, narration, captions, fontsDir, dest }) {
  mkdirSync(dirname(dest), { recursive: true });
  const dir = dirname(captions);
  const vf = `scale=1920:1080:flags=lanczos,fps=30,ass=${captions.split('/').pop()}:fontsdir=${fontsDir}`;
  await ffmpeg([
    '-y',
    '-ss', (leadMs / 1000).toFixed(3),
    '-i', videoPath,
    '-i', narration,
    '-t', (durationMs / 1000).toFixed(3),
    '-vf', vf,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'medium',
    '-crf', '20',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-ar', '48000',
    '-ac', '1',
    '-movflags', '+faststart',
    '-shortest',
    dest,
  ], dir);
}

export function writeScript({ path, segments, walls, openMs, voice, lengthScale, port, doc }) {
  let cursor = openMs;
  const rows = segments.map((segment, index) => {
    const start = cursor;
    const end = cursor + walls[index];
    cursor = end;
    return `| ${clock(start)} | ${clock(end)} | ${segment.action} | ${segment.keys} | ${segment.narration} |`;
  });
  const skipRows = doc.skipped.map((item) => `| ${item.item} | ${item.why} |`);
  const sourceRows = doc.sources.map(([control, where, note]) => `| ${control} | \`${where}\` | ${note} |`);
  const cut = doc.notInCut.map((line) => `- ${line}`).join('\n');
  const body = `# ${doc.title}

${doc.lede}

Voice: ${voice}. Speed or length scale ${lengthScale}. ${doc.voiceNote}

${doc.notes}

Timestamps are the burned-in captions from this recording.

| Start | End | Action | Keys on screen | Narration |
| --- | --- | --- | --- | --- |
| ${clock(0)} | ${clock(openMs)} | Opening hold after the fixture is ready. | SFC2.js | Synthetic fixture. No game install. |
${rows.join('\n')}

## Said plainly because it is not in this duel

| Topic | Why the recording treats it this way |
| --- | --- |
${skipRows.join('\n')}

## Live keys not walked through in this cut

The default keymap has more working bindings than a four-minute lesson can show. They are real. This recording does not press them:

${cut}

## Where the controls live

| Control | Source | What it does |
| --- | --- | --- |
${sourceRows.join('\n')}
`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}

export async function grabFrames(video, times, dir) {
  mkdirSync(dir, { recursive: true });
  const paths = [];
  for (const [name, ms] of times) {
    const dest = `${dir}/${name}.png`;
    await ffmpeg([
      '-y',
      '-ss', (ms / 1000).toFixed(3),
      '-i', video,
      '-frames:v', '1',
      dest,
    ]);
    paths.push(dest);
  }
  return paths;
}
