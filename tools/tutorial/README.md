# Tutorial capture

One command, from the repo root:

```sh
pnpm tutorial
```

That builds the web app, serves the production build with Vite preview on port **1701**, drives the synthetic skirmish in headless Chromium at 1920×1080, speaks `docs/tutorial/script.md` with Piper, and muxes a captioned MP4.

The page is opened at `/?hudScale=1` with no `install` query. `SFC2_INSTALL`, `SFC2_REFERENCE`, and `SFC2_EXTRACTED` are removed from the server environment. The capture refuses to continue if `/__dev/install/manifest` returns a file list. Preview does not mount the dev install route. No game files are read.

## Output

| Path | What it is |
| --- | --- |
| `tools/tutorial/out/sfc2js-tutorial-1080p.mp4` | 1920×1080 H.264 video and AAC narration |
| `docs/tutorial/script.md` | Narration, timestamps, and the key or mouse action for each segment |

Intermediate media and the voice model stay in `tools/tutorial/out/` and `tools/tutorial/.cache/`. Both directories are gitignored. Do not commit the MP4, the WAV files, or the ONNX voice.

`TUTORIAL_OUT` or `--out` changes the MP4 path. `TUTORIAL_PORT` or `--port` changes the preview port. `--skip-build` reuses `web/dist`. `--screenshot` saves a layout still and a one-key probe instead of recording.

## Voice

Piper 2023.11.14-2 (MIT) and the `en_US-ljspeech-medium` voice are downloaded on first run into `tools/tutorial/.cache/`. The voice was trained from scratch on the LJ Speech dataset, which is public domain. The model is not a finetune of a research-licensed voice. Hashes are pinned in `tts.mjs`.

There is no music. Gaps are silence. Captions are burned in with ffmpeg and an ASS file, in DejaVu Sans, and the upper caption line names the keys.

## What you need locally

Node and pnpm as in the repo root, `ffmpeg`, `ffprobe`, and a network path the first time the voice is fetched. The script installs Playwright's Chromium if it is missing. On a fresh machine that also needs the Chromium system libraries, install them once with `pnpm exec playwright install --with-deps chromium`.

The capture sets UI scale to 1× so the field and the console both fit in the 1080p frame. The page would otherwise pick 1.25× at this size.
