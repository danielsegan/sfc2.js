# `sounds.txt` — sound index

Status: **spec draft.** Reference build is **SFC2 Community Edition 2.670**. Nothing here is checked against that install. The parser and its fixtures are synthetic.

> Clean-room note. The column layout is taken from the public comment header of the 2.1.0.2 sound index published at [archive.kontek.net](https://archive.kontek.net/sfc.strategyplanet.gamespy.com/sfc2/sounds-2102.txt), and the folder from the [public patch notes](https://archive.kontek.net/sfc.strategyplanet.gamespy.com/patches_sfc2.shtml) (`/assets/sounds/sounds.txt`). No row from that file is copied here. Examples use invented names (`testPhaserFire`, `sounds/test-phaser.wav`).

## 1. Role

The index lists priority classes and sound files. WAV bytes stay in the player's install. This parser returns names and numbers only. It does not open audio files.

Typical path (unverified for CE 2.670): `assets/sounds/sounds.txt`, next to the WAV files the filename column points at. The public note gives filenames as a path from the program, for example `assets/sounds/bang.wav`.

## 2. Encoding

Same text rules as the other spec tables: Windows-1252, a UTF-8 BOM stripped, LF / CRLF / CR. **Tab** is the column break. A line with no tab is a comment unless its first word is `class`, `format`, `wave`, `pcm22k16s`, or `pcm22k16m`, in which case a run of two or more spaces is a column break. A tab row whose first cell is empty is a comment. A `format` row is stored as a header and is not a sound.

Confidence: **unverified** for CE 2.670. The public header describes columns; it does not say whether the shipped file uses tabs.

## 3. Priority class row

`class`, then:

| # | Field | Meaning |
| --- | --- | --- |
| 1 | name | Class name. Spaces stay inside the cell. |
| 2 | id | Unique number. |
| 3 | max at once | How many of this class may play together. |
| 4 | preempt | `Never`, `Higher Only`, `Lower Only`. Blank or anything else means a higher or equal priority may preempt. |
| 5 | min interval seconds | At most one play per this many seconds. Blank or 0 means no limit. |

Later cells are kept on `extra` and ignored.

## 4. Sound row

The first cell is the file type. The public header names `wave` (a WAV file), `pcm22k16s` (16-bit stereo 22050 Hz PCM), and `pcm22k16m` (the mono form). Any other first cell on a tab row is kept as a custom type.

| # | Field | Meaning |
| --- | --- | --- |
| 1 | identifier | Name the program calls. Blank when the row is only part of a random group or a sequence. |
| 2 | filename | Path from the install root. Stored only when it is install-relative. |
| 3 | description | Free text. Not used to find the file. |
| 4 | spatial | Leading `d` means Dolby, leading `3` means 3D, otherwise normal. |
| 5 | compress | Blank means not compressed. The public header names `2` and `4` as Interplay compression. This player does not decode those. |
| 6 | random index | Index of the first sample in a random group. Blank means this row plays by itself. |
| 7 | next in sequence | Index of the next sample. Streaming only. |
| 8 | other | Free token. |
| 9 | loop | Leading `y` loops. |
| 10 | stream on index | Shared hardware channel. Blank means not streaming. |
| 11 | depth | Hardware channels. Blank means 1. |
| 12 | load groups | Comma-separated group numbers. Blank means group 0, stored as an empty list. |
| 13 | index | Id of this row. Unique unless two rows are the same sound at different load thresholds. |
| 14 | load threshold | Comma-separated. Blank matches every threshold. |
| 15 | load on demand | Leading `y` loads when played. |
| 16 | priority | Higher wins preemption inside a class. |
| 17 | classes | Class names separated by commas or semicolons. |
| 18–19 | min / max frequency | Playback pitch range. Blank means the file's own rate. |
| 20–21 | min / max volume | 0–100. Blank means full. |
| 22–23 | min / max delay | Milliseconds. Blank max delay means the cue does not go stale. |
| 24–25 | done, final | Author flags. Leading `y` or `n`. |

Cells past these are kept on `extra`.

## 5. Diagnostics

`source` is `sounds`. Codes are in [`docs/engine/diagnostics.md`](../engine/diagnostics.md). `emptyFile` has no location. Other codes set `location.file` to the install-relative path passed by the caller, and `location.line` / `location.field` when they apply. A rejected filename is not stored in `details`.

| Code | When |
| --- | --- |
| `emptyFile` | No non-whitespace text. |
| `badNumber` | A numeric cell is not a plain decimal. |
| `missingFilename` | The filename cell is empty. |
| `pathRejected` | The filename is absolute, has `..`, or is otherwise not install-relative. |
| `unknownPreempt` | The preempt word is not one of the three names. The class is still kept, with preempt `any`. |
| `duplicateClassId` | Two classes share an id. |
| `duplicateIndex` | Two rows share an index and the same load threshold. Different thresholds are allowed. |

## 6. What this player uses

The Web Audio layer reads this index from the player's install (`SFC2_INSTALL` or `?install=` on the dev server, or the folder they pick). It plays standard PCM WAV in place. It does not copy files into the repo. Cue names (`weapon.fire.phaser`, `impact.shield`, and the others in `engine/audio/cues.ts`) match identifier, description, and class text. They do not hard-code a filename.
