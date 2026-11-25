# `sprites.q3`: GUI sprite archive

Risk: [#20](https://github.com/danielsegan/sfc2.js/issues/20) · HUD consumer: [docs/ui/asset-pipeline.md](../ui/asset-pipeline.md) · Milestone: Phase 1: Asset pipeline · Owner: Asset & Formats Engineer

Status: **spec draft, no parser.** Reference build is **SFC2 Community Edition 2.670** ([#37](https://github.com/danielsegan/sfc2.js/issues/37)). Nothing below is a decoded record. The ship viewer does not read this file.

> Clean-room note. Written from community posts and from CE 2.670 inventory metadata (magic, size, path). No layout was taken from SFC2-decomp or from the Q3 Editor binary. No bytes from a real `sprites.q3` are stored here.

## 1. Sources

| ID | Source | What it tells us |
| --- | --- | --- |
| Q1 | D4v1ks, [Sprites.q3 Editor listing](https://hotandspicyforums.com/downloads-sfc-f15/) (Hot & Spicy Forums) | A community editor exists for this file. The listing does not describe the records. |
| Q2 | D4v1ks and others, [Orion Pirates 2.564 notes](https://hotandspicyforums.com/starfleet-command-2-orion-pirates-v2-564-august-20-t25292.html) | `sprites.q3` ships with the executable and receives UI updates. Resolution is selected in `sfc.ini`, not by replacing the archive for each of the listed sizes. |
| Q3 | TarMinyatur, [EaW 2.037 thread](http://www.dynaverse.net/forum/index.php/topic,163396632.0.html) | The Q3 Editor edits resolution entries. The 2.037 `sprites.q3` already contains data for resolutions including 1920×1080. A bad resolution entry makes the UI the wrong size. |
| Q4 | [CE 2.679 patch thread](https://hotandspicyforums.com/sfc2-community-edition-patch-2-679-t18932.html) | Extra hardpoints in that unofficial patch need the matching `sprites.q3`. |
| Q5 | CE 2.670 inventory metadata, [ce-2.670.md](inventory/ce-2.670.md) `*.q3` archives | One file. Install-relative path `Assets/Sprites/sprites.q3`. About 80.7 MB. The inventory classifier reported magic `MDM!` (`4d444d21`), not ZIP and not PACK, and no readable directory (`entryCount` none, format `unidentified`). |

## 2. Where the file is

Inventory spelling, install-relative: `Assets/Sprites/sprites.q3`. Windows lookup is case-insensitive. The extracted inventory prefixes a category directory `sprites/`, which is not part of the install path.

The HUD wants a reader that lists entries and decodes each to RGBA, plus sub-frames if the format has them ([asset-pipeline.md](../ui/asset-pipeline.md) §3). That reader does not exist. The HUD draws original fallback art until it does.

## 3. What is known about the container

| Fact | Confidence |
| --- | --- |
| One archive holds the GUI art and the per-resolution UI layout | documented (Q2, Q3, Q4) |
| First bytes observed as `MDM!` | inventory metadata (Q5). Not checked by a parser |
| Not a ZIP and not a PACK archive | inventory metadata (Q5) |
| No directory the inventory scanner could walk | inventory metadata (Q5) |
| Record size, entry names, compression, palette, and frames | **unknown** |

## Unknown / unparsed

There is no parser. Guessing a directory from the editor binary would be the thing this spec refuses to do. All of the following are unparsed:

- The bytes after the four-character magic: counts, offsets, names, and checksums.
- How a resolution entry is stored, and how `sfc.ini` width and height select one (Q3 says the editor edits those entries; it does not say the fields).
- Entry names, palettes, multi-frame or animation records, and whether HUD fonts live inside the archive.
- How a shiplist `uiKey` or a fighter `UI` cell picks an entry.
- Compression, if any. The inventory did not identify ZIP or PACK. Any other scheme is **unknown**.

`sprites.q3` is not on the ship-viewer path. A missing reader blocks original HUD art. It does not block a `.mod` mesh spinning with BMP textures. That split is deliberate: see [README](README.md#ship-viewer-exit-blockers).

## Edge cases

No reader means there is no recovery behaviour to specify yet. When a parser is written it has to follow the shared contract: never throw on a short or corrupt archive, return a diagnostic, and keep `location.file` install-relative. Until then the HUD treats the archive as absent and uses fallback art per slot.
