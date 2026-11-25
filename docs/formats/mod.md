# `.mod` ship models

Issue: [#19](https://github.com/danielsegan/sfc2.js/issues/19) · Ship viewer: [#17](https://github.com/danielsegan/sfc2.js/issues/17) · Undocumented-format risk: [#20](https://github.com/danielsegan/sfc2.js/issues/20) · Milestone: Phase 1: Asset pipeline · Owner: Asset & Formats Engineer, with the Engine Lead for the three.js mesh.

Status: **spec draft, synthetic parser.** Reference build is **SFC2 Community Edition 2.670** ([#37](https://github.com/danielsegan/sfc2.js/issues/37)). Nothing below is **verified**: no real `.mod` has been parsed on `sfc2-ci`. Counts and paths come from inventory metadata only.

> Clean-room note. The layout is taken from the public sfcmod reader and from Taldren's own viewer readme, plus metadata from the CE 2.670 inventory. It does not use SFC2-decomp or any other disassembly. Fields the reader stores but never interprets are marked **hypothesised**.

## Confidence

| Label | Meaning in this spec |
| --- | --- |
| **confirmed** | A cited public source reads this field, with this type and width, or the CE 2.670 inventory recorded this fact as metadata. Not checked by `parseMod` against a real file. |
| **hypothesised** | The bytes are stored, or a community tool happens to treat them a certain way, but the meaning is our inference. The sfc2-ci checklist has to settle it. |

## 1. Sources

| ID | Source | What it tells us |
| --- | --- | --- |
| M1 | Karl Robillard, [sfcmod](https://codeberg.org/wickedsmoke/sfcmod) (`sfcmod.h`, `sfcmod.cpp`, GPL-3.0-or-later, 2003/2024) | Chunk ids, header, materials, named points, per-LOD geometry. A community reader, not game code. |
| M2 | Same repo, `sfc2gl.cpp` | Texture basenames get `.bmp` in the model directory; the luminance flag selects a second name; export walks corners 2, 1, 0; non-triangles are refused; only the first mesh is exported. |
| M3 | Taldren, [.MOD File Viewer readme](https://www.moddb.com/games/star-trek-starfleet-command/downloads/taldren-mod-viewer) (released 2001-11-15) | SFC2-generation models add a self-illumination channel. Stock models typically have three LODs. `_brk` ("break") models have one. The viewer can force LOD1–LOD5. |
| M4 | D4v1ks, [SFC MOD plugin notes](https://hotandspicyforums.com/sfc-mod-plugin-for-3ds-max-2026-t47567.html) (Hot & Spicy Forums, 2025) | SFC1 and SFC2 exports are limited to 65,536 vertices. |
| M5 | CE 2.670 inventory metadata, `sfc2-ci`, draft [PR #46](https://github.com/danielsegan/sfc2.js/pull/46) (`formats/inventory-ce2670`) | 317 `.mod` files, 30,467,500 bytes, all under `Assets/MODELS/`. 108 names end in `_brk.mod`. Each of those 108 shares a directory and a stem with a non-break file. No `_brk` file lacks that sibling. Sizes run from 1,148 to 275,152 bytes. |
| M6 | [kontek mod FAQ](https://archive.kontek.net/sfc.strategyplanet.gamespy.com/sfc1/faq_mod.shtml) and [shiplist.md](shiplist.md) | `Geometry` is a relative `.mod` path. The breakup mesh is the sibling `*_brk.mod`, not a shiplist column. |

## 2. Where the files are

Inventory spelling, install-relative: `Assets/MODELS/<folder>/<file>.mod`. The extracted inventory prefixes a category directory `models/`, which is not part of the install path. Shiplist notes use `assets/models/...`. Windows lookup is case-insensitive; the VFS keeps the indexed spelling. **TO VERIFY** the exact `Geometry` strings.

`breakupModelPath` rewrites `Hull.mod` to `Hull_brk.mod` in the same directory, preserving the extension's case. A path that already ends in `_brk.mod` (any case) is returned unchanged. A drive letter, a leading slash, or `..` yields no path.

## 3. Container

Little-endian. The file is a list of chunks. sfcmod reads the first chunk at byte 0 (M1).

| Offset | Type | Field | Confidence |
| --- | --- | --- | --- |
| 0 | 4 bytes | Chunk id, ASCII, file order (`MDLS`, `STRS`, `MATS`, `PNTS`, `MOD0`, `VTXS`, `POLY`) | confirmed (M1) |
| 4 | int32 | Payload size in bytes, not including this 8-byte header | confirmed (M1) |
| 8 | payload | Chunk body | confirmed (M1) |
| after payload | 0–3 bytes | Pad so the next chunk starts at a 4-byte file offset: `((payloadStart + size) + 3) & ~3` | confirmed (M1) |

`MDLS` and `MOD0` contain nested chunks inside their payload. Any other id is `unknownChunk` (warning): the fourcc, size, and offset are kept on `unknownChunks`, and the parser skips to the padded end. A negative size is `badCount` and stops that level. A size that runs past the file is `truncated`; bytes already read are kept.

There is no separate magic. A file whose first four bytes are not a printable fourcc is `badSignature`. A file with no `MDLS` chunk is `missingHeader`. Zero bytes is `emptyFile` (no `location`). Files over 8 MiB are `fileTooLarge` and are not parsed. The largest inventory file is 275,152 bytes (M5), so 8 MiB is only a defensive ceiling.

`location.file` is the install-relative path, forward slashes, after rewriting `\`. Drive letters, UNC paths, leading slashes, and `..` are dropped and are not copied into the diagnostic.

## 4. `MDLS` header

The payload starts with a fixed header, then five transition floats, then nested chunks (M1). `kMaxLOD` in sfcmod is 5.

| Offset | Type | Field | Confidence |
| --- | --- | --- | --- |
| 0 | uint32 | `version` | confirmed present (M1). The number itself is **hypothesised**; the parser does not accept or reject versions |
| 4 | float32 | `radius` | confirmed present (M1). Units are file units. What the sphere encloses is **hypothesised** |
| 8 | int32 | `lodCount` (`totalLODs`) | confirmed present (M1). One `MOD0` per LOD, in order, is **hypothesised** from sfcmod allocating `totalLODs` meshes |
| 12 | float32 | `lodHysteresis` | confirmed present (M1). How it delays an LOD swap is **hypothesised** |
| 16 | float32 × 5 | `lodTransitions` | confirmed present, and always five, not `lodCount` (M1). Which distances they are is **hypothesised** |

A declared `lodCount` outside 1..5 is `lodCountRange` (warning). The parser still reads up to 8 `MOD0` chunks. A ninth is `badCount` and is not stored. When `lodCount` is inside 0..8 and the `MOD0` count differs, that is `lodCountMismatch`.

M3 says stock models typically have three LODs and break models have one, and that the viewer can force LOD1 through LOD5. Which index is LOD1 is **hypothesised**: sfc2gl exports `meshes[0]` (M2), so the builder shows index 0 by default.

## 5. `STRS` string pool

The payload is raw bytes (M1). Names are C strings: a `uint32` offset into this pool, then bytes up to a NUL, decoded as Windows-1252. The parser resolves offsets after every chunk has been read, so `STRS` may follow `MATS`. Whether stock files use that order is **hypothesised**. An offset past the pool, or a string with no NUL, is `badStringOffset`. A second `STRS` is `duplicateChunk`; the first pool wins.

## 6. `MATS` materials

Materials are packed back to back. A material with the luminance flag is 8 bytes longer (M1). sfcmod states that materials are no longer one uniform size.

| Offset | Type | Field | Confidence |
| --- | --- | --- | --- |
| 0 | uint32 | `flags` | confirmed (M1) |
| 4 | uint8 × 4 | `color` r, g, b, `pad` | confirmed present (M1). `pad` is **hypothesised** (ignored) |
| 8 | float32 | `ambient` | confirmed present (M1). Not applied. Meaning **hypothesised** |
| 12 | float32 | `diffuse` | confirmed present (M1). Not applied. Meaning **hypothesised** |
| 16 | float32 | `emittance` | confirmed present (M1). Not applied; glow comes from the luminance map. Meaning **hypothesised** |
| 20 | int32, int32 | diffuse `texId`, `nameOffset` | confirmed present (M1). `texId` is stored and not used to find a file (**hypothesised** that the name is sufficient; M2 ignores `texId`) |
| 28, only if `flags & 0x20` | int32, int32 | luminance `texId`, `nameOffset` | confirmed (M1, M3) |

Flag bits (M1):

| Bit | Name in sfcmod | Parser field | Render | Confidence |
| --- | --- | --- | --- | --- |
| `0x0001` | texture mapping | `textured` | Load the diffuse name | confirmed bit (M1). Filename rule is M2 |
| `0x0002` | Gouraud | `gouraud` | Smooth vertex normals | confirmed bit (M1). Precedence when both shade bits are set is **hypothesised** (smooth wins) |
| `0x0004` | flat | `flat` | `flatShading` when this is set and Gouraud is not | confirmed bit (M1). The render choice is **hypothesised** |
| `0x0008` | wire | `wire` | `wireframe` | confirmed bit (M1). Render choice **hypothesised** |
| `0x0010` | `kAdditive`, comment says "blended" | `additive` | `AdditiveBlending`, `transparent` | confirmed bit (M1). Additive versus ordinary alpha is **hypothesised**; the name and the comment disagree |
| `0x0020` | luminance texture | `luminance` | The extra texture name is the self-illum map | confirmed (M1, M3) |

Unknown flag bits stay in `flags` and do not raise a diagnostic. A payload that does not end on a material boundary is `raggedChunk`. More than 256 materials is `badCount`.

A textured material whose resolved diffuse name is empty is `missingTextureName`. An empty luminance name is not a diagnostic. No luminance name means no self-illum layer, unless a `_<token>i` file sits beside the base.

### Texture filenames

M2 loads a basename as `<basename>.bmp` in the model directory, case-insensitively. The builder also accepts a name that already ends in `.bmp`, and a relative path.

The pool string is normalized before lookup. `\` and `|` become `/`. Repeated separators collapse. Each segment is trimmed, and one pair of matching quotes is removed. A `.tga`, `.dib`, `.png`, `.jpg`, or `.jpeg` suffix is tried, then the same stem with `.bmp`. A name with no extension is tried as written and with `.bmp`. Lookup is case-insensitive, and the indexed spelling is kept.

Search order, first hit wins:

1. The relative directory in the name, joined to the model directory. `..` is allowed while it stays inside the install.
2. That same relative directory from the install root, when the name has a directory and the model is not already at the root.
3. The model directory, then `common`, `shared`, and `textures` inside it.
4. Each parent directory, then those three folder names inside that parent, up to the install root.

If the relative directory misses, the basename is tried through steps 3 and 4. A drive letter, a leading slash, a NUL, or a `..` that leaves the install is `textureNameRejected`. The rejected text is not copied into the diagnostic.

When every candidate misses, the mesh is kept and the material is a neutral placeholder (`texturePlaceholder`, warning, `details.miss`). That is not `missingTexture`. `miss` says whether the stem is absent, present only with an unsupported extension, present only outside the model search (another empire or model folder), or written with characters outside the usual token set. A file that is found and does not decode is the same warning with `miss: decodeFailed`, and the BMP error is not also raised. The name is not stored. `loadShipTexture` still reports `missingTexture` when it is asked to read a path that is not in the index.

The every-ship check skips a loaded model that has no paintable surface. Zero area (collinear faces, including axes that still span a box), no triangles on the selected LOD, or a speck of area inside a much larger box is `degenerate`. A model whose visible materials are all invisible (no flags and a black color), fully transparent (flat, untextured, black, no blend mode), or blended (`0x0010`) and that does not show a turn is `unpaintable`. Vertices on a ball whose flat color does not change when the view turns are `symmetric`. These are check rules, not a claim about how CE draws the same bytes. A blended material that does change when turned still passes.

When the luminance flag is set and the luminance name resolves, that path is the glow map. An empty luminance name skips that lookup. Otherwise the builder pairs [bmp.md](bmp.md) `_<token>i` in the directory of the resolved base. The explicit name wins when both exist. Glow maps are decoded with `colorKey: 'none'`, by `loadShipTexture`.

## 7. `PNTS` named points

These are the attachment points the format actually stores (M1).

| Offset | Type | Field | Confidence |
| --- | --- | --- | --- |
| 0 | float32 × 3 | `x`, `y`, `z` | confirmed present (M1). Axis and units are file units, copied unchanged. Up-axis is **hypothesised** (M2 also copies them unchanged into glTF) |
| 12 | uint32 | `nameOffset` | confirmed (M1) |

Each point is 16 bytes. `count = floor(size / 16)`. A size that is not a multiple of 16 is `raggedChunk`; the trailing partial point is dropped. There is no facing, no up vector, and no link to a shiplist slot. Treating a name as a weapon hardpoint is **hypothesised** and is not done. The builder parents an `Object3D` at `(x, y, z)` with `userData.sfc2Role = 'attachment'`. More than 4,096 points is `badCount`.

## 8. `MOD0`, `VTXS`, `POLY`

One `MOD0` is one LOD mesh (M1).

| Piece | Layout | Confidence |
| --- | --- | --- |
| `MOD0` | int32 `vertexCount`, int32 `faceCount`, then nested chunks | confirmed (M1) |
| `VTXS` | `vertexCount` × float32 `x, y, z` | confirmed (M1). Positions are file units, not converted |
| `POLY` | int32 `vtxCount`, int32 `materialIndex`, float32 face normal `x, y, z`, then `vtxCount` corners | confirmed (M1) |
| Corner | uint16 `vertexIndex`, uint16 `flags`, float32 normal `x, y, z`, float32 `u`, float32 `v`, float32 `light` | confirmed present (M1). A corner is 28 bytes |

`vtxCount` of 3 is what sfcmod stores and what sfc2gl requires (M1, M2). Any other count is `faceVertexCount`. The parser still stores 1..8 corners when they fit in the chunk. The mesh builder draws only triangles. A fan triangulation of quads is not guessed.

`flags` and `light` are stored and not rendered. sfcmod's breakup splitter, which would group faces when `flags` changes, is compiled out (`#if 0`). Using `flags` that way is **hypothesised**.

A vertex index outside the read vertex array is `vertexIndexOutOfRange`. The builder skips that triangle. A material index outside the material array is `materialIndexOutOfRange`; the builder still draws the triangle with an untextured material.

A vertex or face count above 65,536 is `badCount` and is not allocated. 65,536 vertices is the SFC1/SFC2 export limit in M4. The same ceiling on faces is our defensive cap (**hypothesised**). A short `VTXS` or a `POLY` count that disagrees with `faceCount` is `truncated` or `faceCountMismatch`. `VTXS` or `POLY` outside a `MOD0` is `orphanChunk`. A second `VTXS` in one mesh is `duplicateChunk`; the first wins.

Non-finite floats are kept on the model and counted as `badNumber`. The builder writes 0 for those components.

## 9. three.js mesh

`buildShipMesh` in `@sfc2js/render` returns `{ data, diagnostics }` and does not throw on a bad model.

| Choice | What the builder does | Confidence |
| --- | --- | --- |
| Root | A `Group` the viewer can spin. `userData.sfc2Role` is `ship` | our API |
| LODs | Every parsed LOD is a child `Group`. Index 0 is visible. `showShipLod` switches visibility | index 0 as the default is **hypothesised** (M2, M3) |
| Winding | Corners are written 2, 1, 0 | confirmed as sfc2gl's `FLIP_FACES` (M2). Still needs a visual check |
| Normals and UVs | Copied from the corner. UVs are not flipped here; the BMP texture uses `flipY` ([bmp.md](bmp.md)) | UV orientation is **hypothesised** |
| Diffuse / glow | `loadShipTexture` ([bmp.md](bmp.md) §4) | confirmed pipeline. Which file is named inside the `.mod` is **TO VERIFY** |
| Untextured | Same period Lambert or HD standard material, `color` = file RGB/255, no map | RGB/255 with no transfer function is **hypothesised** |
| `ambient`, `diffuse`, `emittance` | Not applied | **hypothesised** that the glow map already covers emittance |

Period and HD materials match the BMP loader: Lambert versus standard (`roughness` 0.6, `metalness` 0), sRGB base and emissive maps, glow sampled by UV at its own size, HD bloom hint `0.15` on `userData.selfIllumBloomThreshold`.

## 10. Diagnostics

`source` is `"mod"`. Codes are registered in [docs/engine/diagnostics.md](../engine/diagnostics.md). BMP and importer codes (`missingTexture`, `selfIllumSizeMismatch`, `permissionDenied`) pass through from `loadShipTexture` unchanged.

| Code | Severity | When |
| --- | --- | --- |
| `emptyFile` | error | Zero bytes. No `location` |
| `fileTooLarge` | error | Larger than 8 MiB |
| `badSignature` | error | The first four bytes are not a printable chunk id |
| `truncated` | error | Header, payload, or vertex block is short. Partial data is kept |
| `missingHeader` | error | No `MDLS` chunk |
| `badCount` | error | `{ field, value }`. Negative, or over the ceiling |
| `unknownChunk` | warning | `{ type, size }` |
| `duplicateChunk` | warning | `{ type }`. The first `STRS`, `MATS`, `PNTS`, `MDLS`, or `VTXS` wins |
| `raggedChunk` | warning | `{ type }`. `PNTS` or `MATS` did not end on a record boundary |
| `lodCountRange` | warning | `{ declared }`. Outside 1..5 |
| `lodCountMismatch` | warning | `{ declared, meshes }` |
| `faceCountMismatch` | warning | `{ declared, read, lod }` |
| `faceVertexCount` | warning | `{ count, min, max }` |
| `vertexIndexOutOfRange` | warning | `{ count }` |
| `materialIndexOutOfRange` | warning | `{ count }` |
| `badStringOffset` | warning | `{ count }` |
| `missingTextureName` | warning | `{ which: 'diffuse' }`. Textured flag set and the resolved diffuse name is empty. An empty luminance name is omitted on purpose |
| `badNumber` | warning | `{ count }`. Non-finite floats |
| `orphanChunk` | warning | `{ type }` |
| `modelPathRejected` | warning | The `.mod` path is not install-relative. The path is omitted |
| `textureNameRejected` | warning | `{ reason: 'texture-name' }`. The pool string is not a relative path inside the install. The name is omitted. An empty diffuse name is `missingTextureName` on the parser |
| `lodOutOfRange` | warning | `{ requested, lods }` |

## 11. Not parsed, on purpose

- No mapping from named points to shiplist hardpoints, and no invented facing.
- No distance-based LOD swap. `lodHysteresis` and `lodTransitions` are stored only.
- No use of `texId`, `flags` on a corner, `light`, `ambient`, `diffuse`, or `emittance`.
- No quad fan. Faces that are not triangles are stored and skipped by the builder.
- No axis swap. Positions are copied as stored.
- Breakup geometry is a separate file, selected with `breakupModelPath`. It is not a flag inside the intact model.
- SFC3 chunk differences, if any, are out of scope. M4's plugin mentions SFC3; this parser implements the SFC1/SFC2 reader in M1.

## 12. To verify on sfc2-ci

Against `/srv/sfc2/reference/2.670` (the Wine install, not the extracted category tree). Do not copy a `.mod` into the repo. Metadata only if a result is committed.

1. The first eight bytes of one intact hull, one `*_brk.mod`, and one scenery model are `MDLS` plus a little-endian size. Record `version`. The parser does not check it.
2. `lodCount` versus the number of `MOD0` children, for a normal hull and a `_brk` file. M3 expects three and one. Confirm that index 0 is the highest detail, and that the five `lodTransitions` floats plus `lodHysteresis` are the zoom thresholds (units, and which LOD each float selects).
3. Every `POLY` `vtxCount`. Count values other than 3. The builder draws only 3.
4. Whether corner `flags` group debris pieces, and whether `light` affects shading. Both are stored and ignored.
5. Material bits actually used, especially `0x20`. For one textured hull, confirm the diffuse pool string plus `.bmp` in that directory, case-insensitive, and whether the luminance name is the same file as the `_<token>i` glow map. Confirm `texId` is unused.
6. Named points: how many, which strings, and whether any string matches a shiplist weapon slot. Confirm there is no facing in the point record.
7. Axis and winding, using corner order 2, 1, 0 and unscaled positions. A known hull should face the camera and not be inside-out. An invisible or inside-out hull means this hypothesis is wrong.
8. `0x0010`: additive versus alpha blend. Flat shading only when `0x0004` is set without `0x0002`. Whether RGB/255 should multiply the texture. Leave `ambient`, `diffuse`, and `emittance` unused unless a shot shows they matter.
9. Inventory recount: 317 `.mod` files under `Assets/MODELS`, 108 `*_brk.mod`, each paired with a same-stem sibling, none orphaned. Confirm `Geometry` strings resolve through the VFS, including case (`MODELS` versus `models`).
10. Any chunk id other than the seven in §3, and the real maximum vertex and face counts. The parser refuses counts above 65,536.
11. One intact hull and its `_brk`, in the ship viewer, period and HD, with the base map and the glow map. Headless CI only checks synthetic bytes.

## Edge cases

`parseMod` returns a model for every byte string. It throws only when the argument is not an `ArrayBuffer` or `Uint8Array`.

| Input | Result |
| --- | --- |
| Zero bytes | `emptyFile`. No `location`. |
| Longer than 8 MiB | `fileTooLarge`. The body is not parsed. |
| First four bytes are not a printable fourcc | `badSignature`, then `missingHeader` if no `MDLS` was read. |
| Chunk size negative | `badCount`. That level stops. Bytes already stored are kept. |
| Chunk size past the parent | `truncated`. Bytes already stored are kept. |
| Size zero | The parser advances to the next aligned chunk. It does not loop. |
| Nested chunks deeper than 4 | `truncated`. No further recursion. |
| Ninth `MOD0`, or a vertex or face count above 65,536 | `badCount`. The extra mesh or the array is not stored. |
| `options.file` is a drive letter or contains `..` | `location.file` is omitted. |

A `Uint8Array` view with a non-zero `byteOffset` is read from that view, not from the start of the underlying buffer. Synthetic coverage is [`tools/formats/src/mod.test.ts`](../../tools/formats/src/mod.test.ts) and [`tools/formats/fuzz.test.ts`](../../tools/formats/fuzz.test.ts). No `.mod` fixture is committed.

## Unknown / unparsed

Fields marked **hypothesised** in §§4–9 are stored and not interpreted. §11 lists what the parser refuses to guess. The sfc2-ci list in §12 is still open: no real `.mod` has been parsed. In particular, version numbers, which LOD index is the high-detail mesh, whether any face has a vertex count other than 3, what corner `flags` and `light` mean, whether `0x0010` is additive, the up axis, and the real maximum vertex count are **unknown** until that checklist is run. Chunk ids other than the seven in §3 are kept on `unknownChunks` and are not decoded.
