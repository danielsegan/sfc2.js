# Tutorial capture

Two lessons, from the repo root:

```sh
pnpm tutorial
pnpm tutorial:v2
```

Each command builds the web app, serves the production build with Vite preview on port **1701**, drives the synthetic skirmish in headless Chromium at 1920×1080, speaks the script, and muxes a captioned MP4.

The page is opened at `/?hudScale=1` with no `install` query. `SFC2_INSTALL`, `SFC2_REFERENCE`, and `SFC2_EXTRACTED` are removed from the server environment. The capture stops if `/__dev/install/manifest` returns a file list. No game files are read.

`pnpm tutorial` is the v1 key lesson. `pnpm tutorial:v2` is the longer concept lesson. `--tts piper` on v2 uses the v1 voice instead of Kokoro.

## Output

| Path | What it is |
| --- | --- |
| `tools/tutorial/out/sfc2js-tutorial-1080p.mp4` | v1, 1920×1080 |
| `docs/tutorial/script.md` | v1 narration and timestamps |
| `tools/tutorial/out-v2/sfc2js-tutorial-v2.mp4` | v2, 1920×1080 |
| `docs/tutorial/script-v2.md` | v2 narration, timestamps, and source lines |

Intermediate media and voice models stay under `tools/tutorial/.cache/`, `tools/tutorial/out/`, and `tools/tutorial/out-v2/`. Those directories are gitignored. Do not commit an MP4, a WAV, or a model.

`TUTORIAL_OUT` or `--out` changes the MP4 path. `TUTORIAL_PORT` or `--port` changes the preview port. `--skip-build` reuses `web/dist`. `--screenshot` saves a layout still instead of recording.

## Voices

v1 uses Piper 2023.11.14-2 (MIT) and `en_US-ljspeech-medium`, trained from scratch on the LJ Speech dataset, which is public domain. https://keithito.com/LJ-Speech-Dataset/

v2 uses Kokoro-82M v1.0, voice `af_heart`.

- Weights: Apache-2.0, https://www.apache.org/licenses/LICENSE-2.0
- Model card: https://huggingface.co/hexgrad/Kokoro-82M
- The card says the model was trained on permissive and non-copyrighted audio: public domain, Apache and MIT licensed audio, and synthetic audio from closed systems. It also names two CC BY sets used for under twelve hours (Koniwa, CC BY 3.0; SIWIS, CC BY 4.0). `af_heart` is a stock American English voice shipped with that release, graded A. It is not a clone of a named person.
- This capture runs the ONNX export of those weights (`kokoro-v1.0.onnx` and `voices-v1.0.bin`) through `kokoro-onnx` 0.6.1. The files are downloaded on first run into `tools/tutorial/.cache/kokoro/` and checked against the hashes in `tts-kokoro.mjs`.

There is no music. Gaps are silence. Captions are burned in with ffmpeg and an ASS file, in DejaVu Sans.

## What you need locally

Node and pnpm as in the repo root, `ffmpeg`, `ffprobe`, and network the first time a voice is fetched. v2 also needs `espeak-ng` and `python3-venv` so Kokoro can phonemize. The script installs Playwright's Chromium if it is missing. On a fresh machine that also needs Chromium's system libraries, install them once with `pnpm exec playwright install --with-deps chromium`.

The capture sets UI scale to 1× so the field and the console both fit in the 1080p frame. The page would otherwise pick 1.25× at this size.
