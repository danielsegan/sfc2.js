# CE capture harness (private, observation only)

Measures how the original *Starfleet Command II* Community Edition 2.670
behaves, so the browser remake can be tuned against observed numbers instead
of guesses. It runs only on the private `sfc2-ci` VM, where Daniel's own
licensed install lives at `/srv/sfc2/reference/2.670`.

## Clean-room rules

- **Observation only.** The harness sends mouse and keyboard input with
  `xdotool`, takes screenshots, and reads on-screen numbers with OCR. It does
  not disassemble or decompile anything, read process memory, or use
  SFC2-decomp.
- **Nothing from the game leaves the VM.** That covers game files, bytes,
  textures, models, audio, table rows and screenshots. The CI artifact holds
  only `results.json` and `results.csv` with measured numbers. The workflow
  checks the artifact folder before it uploads.
- **The reference tree is read-only.** `prepare_workcopy.sh` copies it to a
  scratch folder and changes `sfc.ini` there. The changes are: windowed mode,
  Miles audio off, sound off, the heading overlay on, the grid on, and the space backdrop and space dust off. The bright nebula backdrop was confusing the pixel heading estimate.
- **No game data in git.** Nothing in this folder is derived from game data.
  The scripts contain only screen coordinates of UI controls.

## Parts

| File | Role |
|---|---|
| `docker/Dockerfile` | Ubuntu 24.04, Wine (32-bit prefix), Xvfb, xdotool, ImageMagick and Tesseract. No game data. |
| `session.sh` | Container entrypoint: starts Xvfb `:99` (1024x768x16) and runs `wine Starfleet2CE.exe` in `/game`. |
| `prepare_workcopy.sh` | Makes a writable working copy and sets the `sfc.ini` display and sound options. |
| `run_scenario.sh` | Starts the container, walks the menus to an Advanced Custom Skirmish, and picks the ship. `fed` flies F-CA and `klingon` flies K-D7. The opponent is one Klingon frigate at LOW BPV. Then it runs a port High-Energy Turn at each requested speed. |
| `capture_turn.py` | Sets the target speed with the S/A hotkeys, waits until the HUD speed settles, and snapshots the energy panel. Then it clicks a helm turn button and records timestamped frames. |
| `heading.py` | Finds the ship's heading on the overhead camera from screen pixels. It takes the principal axis of the bright, low-saturation hull pixels in a circle around the camera centre. |
| `analyze_turn.py` | Unwraps the heading, applies a median filter, and works out the total turn, the order delay and the 10/50/90% times. It also computes the mean turn rate (deg/s, wall clock and game clock) and reads the HUD clock, speed and energy panel with OCR. |
| `mouse_helm.py` | Clicks a point in the overhead tactical view and records the heading series. This is the normal mouse-set heading turn. |
| `weapons_probe.py` | Federation HUD only. Arms weapons (NORMAL), fires repeatedly, and OCRs the game's own on-screen volley readout and the target range tag. |
| `summarize.py` | Collects the per-run JSON files into `results.json` and `results.csv`. Each run includes `kind`: `het` for helm-panel buttons, `normal` for mouse-heading turns. Ship-audit scores those separately, keyed by speed. |

## Run on the VM by hand

```sh
tools/ce-harness/prepare_workcopy.sh /srv/sfc2/reference/2.670 /srv/sfc2/work/ce-2.670
docker build -t sfc2-ce-harness:dev tools/ce-harness/docker
tools/ce-harness/run_scenario.sh fed ca 5 10 15 20 31
python3 tools/ce-harness/summarize.py ~/harness/out/runs ~/harness/out/results-ca 'ca-*'
```

## Run from CI

The **Private CE harness capture** workflow (`private-ce-harness.yml`) runs
only from `workflow_dispatch` on `[self-hosted, sfc2-ci, private-data]`. Its
inputs are `scenario` (`fed` or `klingon`) and `speeds`. It uploads only the
numbers, then deletes the runner-local game copy, frames and Wine prefix.

```sh
gh workflow run "Private CE harness capture" -f scenario=fed -f speeds="5 10 15 20"
```

## Known limits

- The helm-panel turn arrows order **High-Energy Turns**. A HET power bar appears and the ship turns fast after a delay of about 5 s. A normal turn is set by left-clicking a bearing in the tactical view (`mouse_helm.py`), and it is far slower. Measure the two separately. Tag every turn run with `kind` `het` or `normal` (analyze_turn.py and summarize.py do this from the button). Untagged rows are skipped by ship-audit.

- The heading comes from pixels, so it has a few degrees of noise. The
  analysis uses a 5-sample median and the 10% to 90% part of each turn.
- The HUD skins differ by empire. Helm and energy-panel coordinates are
  mapped for the Federation skin. The Klingon helm buttons are mapped, but
  the Klingon energy panel is not, so those values come out `null`.
- The frame rate is about 8 to 12 fps under software rendering, which gives
  turn timings to about ±0.1 s.
- The game's own Vessel Library shows six shield facing values. For some
  hulls these differ from the shiplist columns (see the PR). In-battle shield
  numbers are not shown on the HUD.
