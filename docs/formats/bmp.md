# BMP textures and self-illumination

Issue: [#15](https://github.com/danielsegan/sfc2.js/issues/15) · The install index that feeds this decoder is [#16](https://github.com/danielsegan/sfc2.js/issues/16) · Milestone: Phase 1: Asset pipeline · Owner: Asset & Formats Engineer, with the Engine Lead for the three.js upload.

Status: **spec draft, synthetic parser.** Reference build is **SFC2 Community Edition 2.670** ([#37](https://github.com/danielsegan/sfc2.js/issues/37)). Header facts below that come from the CE 2.670 inventory are metadata only (bit depth, compression, size). No pixel has been checked on `sfc2-ci` yet.

> Clean-room note. The container is the public Windows BMP layout. Pairing and the three.js upload follow [docs/ui/asset-pipeline.md](../ui/asset-pipeline.md) §3–§4 and [docs/engine/hud-viewmodel.md](../engine/hud-viewmodel.md) §4. This spec does not use SFC2-decomp or any other disassembly.

## 1. Where the bytes come from

Players point the app at their own install. `@sfc2js/platform` (`engine/platform`) indexes that folder into an in-memory virtual file system. Parsers, including `parseBmp`, read bytes from the VFS. Nothing is uploaded, and nothing is written into the git tree or a published build.

| Picker | When |
| --- | --- |
| File System Access API (`showDirectoryPicker`) | Chromium, and any browser that exposes it |
| Directory file input (`webkitdirectory`) | Browsers without the File System Access API. The picked folder's own name is stripped, so paths are relative to that folder |
| Zip archive (`importZipArchive`) | A player-supplied `.zip` of an install they own. Store and raw deflate. ZIP64, encryption and other methods are refused |

The index rebases onto the install root: the directory that holds `Starfleet2CE.exe` or `Starfleet2.exe`, and/or `Assets/Specs/shiplist.txt`, `MetaAssets/shiplist.txt`, or `Specs/shiplist.txt` when the player picked the `Assets` folder. A parent folder pick still yields install-relative paths (`Assets/Specs/shiplist.txt`, not `SomeFolder/Assets/...`).

`location.file` on every diagnostic is that install-relative path (forward slashes). Drive letters, UNC paths, leading slashes and `..` are rejected with `pathRejected` and are not copied into the diagnostic.

Build detection matches [data-loader.md](../engine/data-loader.md) §6: `Starfleet2CE.exe` or `Starfleet2.exe` in the install root, presence only. The bytes of the executable are not read. `buildUnknown` at import time uses `source: "importer"`; the loader still emits the same code with `source: "loader"` when it builds the database.

A missing shiplist is `missingShiplist` (error). The two shiplist copies are compared by bytes; a difference is the existing `specsMetaassetsDiffer` warning (`source: "shiplist"`). Missing `.mod` files and a tree with no BMP are warnings (`missingModels`, `noTextures`), so the index still comes back.

## 2. BMP variants

Public layout, [Microsoft's bitmap header](https://learn.microsoft.com/en-us/windows/win32/gdi/bitmap-storage):

| Piece | What we accept |
| --- | --- |
| File signature | `BM` |
| `BITMAPINFOHEADER` and longer headers | `biSize` 40 through 124 (info, V2, V3, V4, V5). Extra fields are ignored. Compression must be `BI_RGB` (0) |
| `BITMAPCOREHEADER` | `biSize` 12. Palette entries are 3-byte RGB triples. Compression is implicit `BI_RGB` |
| 8-bit and 4-bit | Palettised `BI_RGB`. A 4-bit index is expanded through the palette to 8-bit channels (asset-pipeline §3 and §4). The high nibble is the left pixel |
| 24-bit | `BI_RGB`, BGR, rows padded to 4 bytes |
| 32-bit | `BI_RGB`, BGRA. If every alpha byte is 0, the alpha channel was unused and the image is opaque |
| Row order | Positive `biHeight` is bottom-up. Negative `biHeight` is top-down |
| Output | Premultiplied RGBA, top-down, in the returned buffer |

CE 2.670 glow maps, from the inventory cited in asset-pipeline §4: 1,073 names match the glow suffix in §3, 1,072 have a base, 1,071 pairs share bit depth, 166 differ in width or height, and the glow `biBitCount` histogram is 8-bit × 1,072 and 4-bit × 1 (`ksd/Ksd_1_3i.bmp`, `BI_RGB`, 256×256, next to an 8-bit base). Full-set bit depths for non-glow BMPs are **TO VERIFY**. 24-bit and 32-bit are implemented because asset-pipeline §3 asks for 24-bit and because 32-bit `BI_RGB` is a normal export of the same header. `BI_RLE8`, `BI_RLE4`, `BI_BITFIELDS`, JPEG and PNG compression are refused with `unsupportedCompression`.

Images wider or taller than 8,192 pixels, or with a short pixel buffer, do not allocate a partial texture. The diagnostic carries the declared size.

### Colour key

Asset-pipeline §3 says colour-key pixels become alpha 0, and that the CE convention (magenta, black, or palette index 0) is **TO VERIFY** on `sfc2-ci`. The decoder's default is `none`, so ship textures stay intact until that check. `magenta`, `black` and `paletteIndex0` are implemented and covered by synthetic tests. A keyed pixel is stored as premultiplied `(0, 0, 0, 0)`.

Self-illumination maps are always decoded with `colorKey: 'none'`. Black in a glow map means unlit, not transparent.

The fourth byte of an `RGBQUAD` is ignored. Treating it as alpha is **TO VERIFY**.

## 3. Self-illumination pairing

A glow file's stem matches:

```
^(?<base>.*)_(?<token>[0-9][0-9A-Za-z]*)i$
```

case-insensitive. The base file is `<base>_<token>` with the same extension, in the same directory. `Hull_1i.bmp` pairs with `Hull_1.bmp`. `Glow_512ai.bmp` pairs with `Glow_512a.bmp`. Lookup is case-insensitive, and the indexed spelling is kept.

This is the rule the CE 2.670 inventory used to count 1,073 glow maps. A glow file with no base is `orphanSelfIllum` (warning) and is not used as a base. A base with no glow is a normal texture: `selfIllum` is omitted. Two files in different directories do not pair.

The inventory also saw one `-i` name and one `-I` name. Those are not paired. **TO VERIFY** whether they are glow maps.

166 glow/base pairs differ in size. The loader reports `selfIllumSizeMismatch` (info) and does not resample. The renderer samples each map by UV ([hud-viewmodel.md](../engine/hud-viewmodel.md) §4).

## 4. three.js upload

`@sfc2js/render` (`engine/render`) turns a decoded pair into textures:

| | Period | HD |
| --- | --- | --- |
| Material | `MeshLambertMaterial`. Emissive is added on top of the lit base | `MeshStandardMaterial` (`roughness` 0.6, `metalness` 0) plus the bloom hint below |
| Base | `map`, `SRGBColorSpace` | same |
| Self-illum | `emissiveMap`, `emissive` white, `emissiveIntensity` 1. Absent glow leaves emissive black | same |
| Filtering | bilinear (`LinearFilter`) | trilinear (`LinearMipmapLinearFilter`) and anisotropy 8 |
| Mipmaps | `generateMipmaps` is set for every 3D texture. The GPU builds them on upload | same |
| Wrap | clamp to edge | clamp to edge |

The decoded buffer is top-down. `texture.flipY` is true, so three.js UV `(0, 0)` is the bottom-left of the image. Shaders do not flip UVs again.

Both textures stay sRGB. three.js converts an `emissiveMap` sample to linear in the shader. Converting on the CPU and quantising back to 8-bit would crush dark emission, so the loader does not do that. Black stays unlit; brighter texels emit more. RGB is kept, so a coloured glow keeps its colour. Whether CE glow palettes are grayscale is **TO VERIFY**.

HD materials set `userData.selfIllumBloomThreshold` to `0.15` (linear luminance, a starting value). Period materials set it to 0. The bloom pass itself is the renderer's later post-process; this loader only records the cutoff. `userData.sfc2Role` is `ship-surface`.

A non-power-of-two image is loaded and reported with `nonPowerOfTwo` (info). WebGL2 can sample it.

`loadShipTexture` does not throw. A missing or undecodable base yields `missingTexture` (or the parser's error) and `material: null`. A missing glow map yields `missingTexture` for that path and a base material with black emissive, so the ship still draws.

## 5. Diagnostics

Codes are registered in [docs/engine/diagnostics.md](../engine/diagnostics.md). BMP codes use `source: "bmp"`. Install-index codes use `source: "importer"`, except `specsMetaassetsDiffer`, which stays `source: "shiplist"`.

| Code | Severity | When |
| --- | --- | --- |
| `emptyFile` | error | Zero bytes |
| `badSignature` | error | Not `BM` |
| `truncated` | error | Header or pixel buffer is short |
| `unsupportedHeader` | error | `biSize` outside 12 and 40–124, or `biPlanes` is not 1 |
| `unsupportedBitDepth` | error | Not 4, 8, 24 or 32 |
| `unsupportedCompression` | error | Not `BI_RGB` |
| `badDimensions` | error | Non-positive, or above 8,192 on a side |
| `badPalette` | error | Palette does not fit |
| `paletteIndexOutOfRange` | warning | An index past the palette; pixel uses entry 0 |
| `nonPowerOfTwo` | info | Width or height is not a power of two |
| `orphanSelfIllum` | warning | Glow suffix from §3 with no base beside it |
| `missingTexture` | error | The VFS has no file at the requested relative path |
| `selfIllumSizeMismatch` | info | Glow and base differ in width or height; both are kept |
| `installNotRecognized` | error | No executable and no shiplist |
| `missingShiplist` | error | Root found, shiplist not present. `location.file` is the expected `Assets/Specs/shiplist.txt` |
| `missingModels` | warning | No `.mod` files |
| `noTextures` | warning | No `.bmp` files |
| `buildUnknown` | warning | No `Starfleet2CE.exe` or `Starfleet2.exe` in the install root (`source: "importer"`) |
| `multipleInstalls` | error | Two install roots at the same depth |
| `pathRejected` | error | `{ reason, count }`. The rejected path is omitted |
| `caseConflict` | warning | Two indexed paths differ only by case; the first wins |
| `archiveUnsupported` | error | Not a zip, ZIP64, encrypted, unknown method, corrupt, or over the size cap |
| `permissionDenied` | error | A file in the install could not be read. The thrown message is not copied |
| `specsMetaassetsDiffer` | warning | The two shiplist copies differ (`source: "shiplist"`) |

## 6. To verify on sfc2-ci

Against `/srv/sfc2/reference/2.670` (the Wine install, not the extracted category tree):

1. Root detection finds `Starfleet2CE.exe` and `Assets/Specs/shiplist.txt`, and `location.file` values stay install-relative.
2. Bit depth and compression across all BMPs, not only the glow histogram. Some inventory file sizes sit 2 bytes under a standard 8-bit square (66,612 vs 66,614). Confirm the header and that `parseBmp` accepts those files.
3. Decode the 4-bit glow map and an 8-bit neighbour. Confirm palette expansion, not nibble replication.
4. Colour key: magenta, black, palette index 0, or none. The default stays `none` until this is settled.
5. Pair count: 1,072 paired glow maps, 1 orphan, 166 size mismatches, and whether the single `-i` / `-I` names are glow maps.
6. Whether glow palettes are grayscale, and whether a visual pass wants the HD bloom cutoff moved from `0.15`.
7. Mipmaps and anisotropy on a real GPU upload. Headless tests only check the texture flags.
