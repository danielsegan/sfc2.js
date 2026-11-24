# `.mod` ship models

Issue: [#19](https://github.com/danielsegan/sfc2.js/issues/19) · Milestone: Phase 1: Asset pipeline · Owner: Asset & Formats Engineer.

Status: **spec draft, synthetic parser.** Reference build is **SFC2 Community Edition 2.670**. Nothing here has been checked against a real `.mod` on `sfc2-ci`.

> Clean-room note. The chunk layout is taken from the public [sfcmod](https://codeberg.org/wickedsmoke/sfcmod) reader by Karl Robillard (GPL-3.0-or-later, 2003/2024), which the legal note names as an allowed community format source. Forum posts describe light maps and `_brk.mod` siblings. This is not derived from SFC2-decomp. No original model is committed.

## 1. Where the file lives

Shiplist `geometry` is a path such as `assets/models/<folder>/<file>.mod`, resolved case-insensitively from the install root ([shiplist.md](shiplist.md) §4.12). The break-up mesh is the sibling `<stem>_brk.mod` in the same folder. `breakupModelPath` applies that rule. Textures sit next to the model. The material record names the diffuse BMP and, when the luminance flag is set, the self-illumination BMP. Those names are the ones the BMP pipeline should load. The folder-wide `_<token>i` pairing remains the inventory rule when a name is missing.

## 2. Container

Little-endian. The file is a tree of chunks.

| Field | Type |
| --- | --- |
| type | 4 bytes, the characters of the chunk id (`MDLS`, `STRS`, `MATS`, `PNTS`, `MOD0`, `VTXS`, `POLY`) |
| size | int32, payload length, not including this 8-byte header |
| payload | `size` bytes |
| pad | zero to three bytes so the next header starts on a 4-byte boundary |

`MDLS` is the root. Its payload is a model header, five LOD transition floats, then nested chunks. `MOD0` is one LOD. Its payload is a vertex count, a face count, then nested `VTXS` and `POLY` chunks. A chunk this reader does not know is `unknownChunk` (warning) and is skipped.

### Model header (`MDLS`)

| Field | Type | Meaning |
| --- | --- | --- |
| version | uint32 | Stored as written. The CE value is **TO VERIFY** |
| radius | float32 | Bounding radius, file units |
| lodCount | int32 | Number of `MOD0` levels that should follow |
| lodHysteresis | float32 | LOD switch slack. Use is **TO VERIFY** |
| lodTransitions | float32 × 5 | Always five values in the public reader, even when `lodCount` is smaller |

### Strings (`STRS`)

A pool of Windows-1252 bytes, each name ending in a 0 byte. Texture and hardpoint names are offsets into this pool. An offset past the pool is `badStringOffset`.

### Materials (`MATS`)

Records are packed one after another. A record is 28 bytes, or 36 when the luminance flag is set.

| Field | Type |
| --- | --- |
| flags | uint32 |
| color | 4 bytes, red, green, blue, unused |
| ambient, diffuse, emittance | float32 |
| diffuse texture | int32 id, int32 name offset |
| luminance texture | the same pair, only if flag `0x0020` is set |

| Flag | Bit | Meaning in the public reader |
| --- | --- | --- |
| textured | `0x0001` | Texture mapping |
| gouraud | `0x0002` | Smooth shading |
| flat | `0x0004` | Flat shading |
| wire | `0x0008` | Wire frame |
| additive | `0x0010` | Blended |
| luminance | `0x0020` | A second texture, the self-illumination map |

What the texture id selects, besides the name offset, is **TO VERIFY**.

### Named points (`PNTS`)

16 bytes each: three float32 coordinates and a string-pool offset. These are the named hardpoints the community editors show. How the name maps to a weapon slot is **TO VERIFY**.

### Geometry

`VTXS` is `vertexCount` triples of float32. `POLY` is one face:

| Field | Type |
| --- | --- |
| vertex count | int32. The public reader expects at most 3. Any other count is `faceVertexCount` |
| material index | int32. Outside the material list is `badMaterialIndex` |
| face normal | three float32 |
| corners | `vertex count` records of 28 bytes |

Each corner is: uint16 vertex index, uint16 flags, three float32 normal, float32 `u`, float32 `v`, float32 `light`. A vertex index outside the mesh is `badVertexIndex`. `u` and `v` are stored as the file has them. Texture `flipY` is applied when the BMP is uploaded, not here. The per-corner `light` value and the corner flags are kept and **TO VERIFY**. Break-up grouping by those flags is not implemented.

## 3. Parser result

`parseMod` returns `{ data, diagnostics }` and does not throw on a bad file. `data` is a best-effort model: version, radius, LOD list, materials with resolved texture names, named points, and one mesh per `MOD0`. Counts that disagree with the header are `lodCountMismatch` (LOD count) or `faceCountMismatch` (faces in a mesh).

## 4. Diagnostics

`source` is `mod`. Registered in [docs/engine/diagnostics.md](../engine/diagnostics.md).

| Code | Severity | When |
| --- | --- | --- |
| `emptyFile` | error | Zero bytes |
| `missingHeader` | error | No `MDLS` chunk |
| `truncated` | error | A chunk or record runs past the buffer |
| `unknownChunk` | warning | `{ type }` four-character id, skipped |
| `duplicateChunk` | warning | A second `MDLS` or `STRS` |
| `badStringOffset` | warning | Name offset outside the string pool |
| `badMeshSize` | error | LOD, vertex or face count is negative or above the safety cap |
| `badVertexIndex` | warning | Corner index outside the mesh |
| `badMaterialIndex` | warning | Face material outside the material list |
| `faceVertexCount` | warning | Corner count is not 3. Counts from 1 to 8 are still read |
| `lodCountMismatch` | warning | `MOD0` chunks do not match `lodCount` |
| `faceCountMismatch` | warning | `POLY` chunks do not match the mesh face count |

## 5. To verify on sfc2-ci

Against `/srv/sfc2/reference/2.670`, without printing vertices or names from the stock ships into the repo:

1. One stock `.mod` and its `_brk.mod` sibling: version, LOD count, and whether every material with the luminance flag names a BMP that `parseBmp` accepts.
2. Whether texture ids are redundant with the name offsets.
3. Whether named points match the shiplist hardpoint slots.
4. The real range of `POLY` vertex counts and corner flags.
5. Whether a second unknown chunk id shows up. The reader will report it and continue.
