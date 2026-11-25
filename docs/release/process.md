# Release process

How SFC2.js is versioned, tagged, built, and published. Phase 8 in [`docs/plan.md`](../plan.md) is the release phase (mods, HD upgrades, controller, Tauri desktop builds, release review). This document is the process for that phase. It does not add CI workflows, packaging scripts, or signing material.

The project is a clean-room TypeScript and three.js engine for *Star Trek: Starfleet Command 2*. The reference baseline is Community Edition 2.670. WASM hot paths are allowed (AssemblyScript or Rust). The desktop app is a Tauri shell. Players bring their own game files. Legal rules live in [`docs/LEGAL.md`](../LEGAL.md).

Words marked **planned** name work that the tree does not contain yet. A release does not invent those pieces on the day of the tag.

## What exists today

| Piece | State in the tree |
| --- | --- |
| Product version | `0.0.0` in the root [`package.json`](../../package.json) and in the three workspace packages. `"private": true` on each. Nothing has been tagged. |
| Changelog | **Planned.** No `CHANGELOG.md` yet. |
| Web build | `pnpm build:web` (`vite build --config web/vite.config.ts`) writes `web/dist/`. The zip, the upload, and a static host are **planned**. |
| Desktop shell | [`desktop/README.md`](../../desktop/README.md) reserves the directory. No `src-tauri/`, no `Cargo.toml`, no `tauri.conf.json`, no `build:desktop` script. Packaging is **planned**. |
| WASM crate | **Planned.** No Rust or AssemblyScript package exists. The plan allows either for hot paths. |
| Release workflow | **Planned.** [`.github/workflows/`](../../.github/workflows/) has test and asset gates only. No workflow builds installers, signs them, writes checksums, or publishes a GitHub Release. |
| Signing and updater keys | **Pending Daniel's decision.** No workflow reads signing secrets. No certificate or private key is in the tree. Builds stay unsigned until that decision is recorded. |
| SBOM tool | **Planned.** No CycloneDX or SPDX generator is in `package.json`. |

Runtime for a release build matches CI: Node 22 (root `engines` is `>=22.18`), pnpm `10.33.4` (`packageManager`), `pnpm install --frozen-lockfile` against [`pnpm-lock.yaml`](../../pnpm-lock.yaml).

## Versioning

Semantic Versioning ([semver.org](https://semver.org/spec/v2.0.0.html)). The version string in files has no `v` prefix. Git tags add the prefix.

### Pre-1.0

The tree is at `0.0.0`. Until `1.0.0`:

- The version is `0.Y.Z`.
- Increase `Y` for any player-visible change. That includes a change that breaks replays, saves, or the mission API.
- Increase `Z` only for a fix that leaves `versionHash` inputs unchanged and leaves the mission API unchanged.
- `1.0.0` is the first build Daniel approves after the Phase 8 exit criteria: OP and EAW packs load, desktop builds exist, and the release review in this document is done.

`0.Y.Z-rc.N` is the only pre-release form. `N` starts at 1 for each `X.Y.Z` and increases by 1 for each new candidate. No `alpha`, `beta`, or `nightly` tags unless Daniel asks for them.

From `1.0.0` onward, major means an incompatible replay, save, or mission API; minor means a compatible feature; patch means a compatible fix.

### Product version and replay version

Players see the semver. Replays, saves, and the lobby handshake use `versionHash` from [`engine/core/version.ts`](../../engine/core/version.ts), defined in [`docs/engine/determinism.md`](../engine/determinism.md) (V1). That hash mixes the replay format, the sim sources, and the converted game database. A docs-only commit changes neither hash. Release notes say whether `versionHash` inputs changed. A semver bump does not by itself mean old replays play, and a matching semver does not override a `versionHash` mismatch.

### Single source of truth

The canonical version is the `version` field of the root `package.json`. Every other version field is a copy of that exact string.

These files exist today and are `0.0.0`:

| File | Field |
| --- | --- |
| `package.json` | `version` (canonical) |
| `tools/formats/package.json` | `version` (`@sfc2js/formats`) |
| `engine/platform/package.json` | `version` (`@sfc2js/platform`) |
| `engine/render/package.json` | `version` (`@sfc2js/render`) |

These files are **planned**. When they are added, they join the same set before the first tag that contains them:

| File | Field |
| --- | --- |
| `desktop/src-tauri/tauri.conf.json` | `version` |
| `desktop/src-tauri/Cargo.toml` | `[package].version` |
| A Rust WASM crate, if one is added under `engine/` | that crate's `[package].version`, and its `Cargo.lock` stays in sync |

The workspace packages stay `"private": true`. A release does not publish them to npm.

A check that fails the build when these strings differ is **planned**. Until that check exists, the release checklist compares them by hand. Edit the root `package.json` first, then copy the string. Do not bump one file in a follow-up commit after the tag.

### Changelog

`CHANGELOG.md` at the repo root is **planned** and is created with the first tagged release. Format: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).

```markdown
# Changelog

All notable changes to SFC2.js are documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]

## [0.1.0] - YYYY-MM-DD
### Added
- …

### Changed

### Fixed

### Security
```

Sections in use are Added, Changed, Deprecated, Removed, Fixed, and Security. Keep an `Unreleased` section on `main`. Cutting a release moves those bullets under the new version heading and sets the date to the tag date (UTC). The tag message is that version's changelog section. Compare links can be added once two tags exist.

## Branches and tags

`main` is the only long-lived branch. Feature work merges into `main` by squash merge, which is the rule in [`docs/plan.md`](../plan.md). The Producer merges a PR once the job **Block original game files and large binaries** is green and the author has posted the final head SHA.

Release tags point at a commit on `main`, or at a commit on a `release/x.y` branch when one exists.

| Name | Role |
| --- | --- |
| `main` | Integration. Every release starts from a commit that is on `main`, or was merged to `main` before the release branch was cut. |
| `release/x.y` | **Planned, only when needed.** Cut from the `vX.Y.0` tag when a patch has to ship without taking later commits from `main`. Not used while nothing has been released. |
| `vX.Y.Z-rc.N` | Annotated tag for a release candidate. |
| `vX.Y.Z` | Annotated tag for the release. Points at the same commit as the rc that passed the checklist. |

Tag commands, from a clean checkout of that commit:

```sh
git tag -a vX.Y.Z-rc.N -m "SFC2.js X.Y.Z-rc.N"
git push origin vX.Y.Z-rc.N
```

The final tag uses the same form with `vX.Y.Z`. Tags are not force-pushed. Replacing a tag that anyone has already built from requires Daniel's approval, and the replacement is a new rc number rather than a moved tag.

A patch on an old minor, once a `release/x.y` branch exists:

1. Branch `release/x.y` from `vX.Y.0` (or from the latest `vX.Y.Z` on that line).
2. Cherry-pick or PR the fix onto that branch. The version fields and the changelog on that branch become `X.Y.(Z+1)`.
3. Tag `vX.Y.(Z+1)-rc.1` from the release branch and run this process.
4. Open a PR that brings the same fix back to `main`.

Public workflows trigger on every `push`, with no branch filter, so pushing a tag runs CI on that commit again. The tag is not the release until those checks are green.

## From release candidate to release

1. Open a PR to `main` that sets the canonical version, copies it into every version field that exists, and (once `CHANGELOG.md` exists) moves `Unreleased` under the new heading with today's UTC date. The PR body links the checklist items that are already done.
2. Wait until every public workflow below is green on the PR. The author posts the final head SHA. The Producer squash-merges.
3. Tag `vX.Y.Z-rc.N` on that merge commit and push the tag. Wait until the same workflows are green on the tag.
4. Build the artifacts in [Artifacts](#artifacts) from a clean checkout of the tag. Desktop and the web zip upload are **planned**; `pnpm build:web` is the web build that exists now.
5. Write `SHA256SUMS` and the SBOM files. Unpack every artifact and run the content check in [What never ships](#what-never-ships).
6. Run the [smoke test](#smoke-test) on each artifact this candidate actually ships.
7. A failure is a new commit on `main` (or on `release/x.y`) and a new tag `vX.Y.Z-rc.(N+1)`. The failed tag stays where it is.
8. When the candidate passes and nothing else will change, tag `vX.Y.Z` on that same commit and push it.
9. A GitHub Release on [`danielsegan/sfc2.js`](https://github.com/danielsegan/sfc2.js) attaches the artifacts, `SHA256SUMS`, the SBOMs, and the changelog section. Creating that Release on the private repo for the studio is a Producer action after step 8. Making the repo public, making the Release public, hosting the web build, or sending a build outside the studio also needs Daniel's approval, and the takedown plan and legal review in [`docs/LEGAL.md`](../LEGAL.md).

The GPL-3.0 text in [`LICENSE`](../../LICENSE) ships with the source at the tag and inside each archive. The corresponding source for a binary is that tag.

### CI that must be green

These workflows run on `push` and `pull_request`. All of them are release gates. The pnpm jobs (`unit-tests`, `formats`, `sim-core`, `replay`) use `pnpm/action-setup@v4`, `actions/setup-node@v4` with Node 22, and `pnpm install --frozen-lockfile`. The asset check, the rules-fixture check, and the inventory-tool tests do not install the workspace.

| Workflow | Job name | Command that matters |
| --- | --- | --- |
| [`.github/workflows/no-game-files.yml`](../../.github/workflows/no-game-files.yml) | Block original game files and large binaries | `bash tools/check-no-game-files.sh` |
| [`.github/workflows/unit-tests.yml`](../../.github/workflows/unit-tests.yml) | Typecheck and unit tests | `pnpm typecheck`, `pnpm test` |
| [`.github/workflows/formats.yml`](../../.github/workflows/formats.yml) | Typecheck and parser tests | `pnpm test:formats` |
| [`.github/workflows/sim-core.yml`](../../.github/workflows/sim-core.yml) | Typecheck, lint, and unit tests | `pnpm lint:sim`, `pnpm lut:check`, `pnpm test` |
| [`.github/workflows/replay.yml`](../../.github/workflows/replay.yml) | Replay corpus; Replay hashes in browsers | `pnpm replay:check`, `pnpm replay:browsers` |
| [`.github/workflows/rules-fixtures.yml`](../../.github/workflows/rules-fixtures.yml) | Rules fixture checker | `node tools/check-rules-fixtures.mjs` |
| [`.github/workflows/inventory-tools.yml`](../../.github/workflows/inventory-tools.yml) | Synthetic fixture tests | `python3 tools/inventory/test_inventory.py -v` |

Before tagging, run `pnpm check` locally. That script covers typecheck, sim lint, the angle LUT, unit tests, `replay:check`, the rules fixtures, and `tools/check-no-game-files.sh`. The browser replay job still has to pass on CI.

These workflows are **not** release gates. They are `workflow_dispatch` only, on the self-hosted `sfc2-ci` runner, and they read the CE 2.670 tree that stays on that machine:

| Workflow | What it does |
| --- | --- |
| `private-inventory.yml` | Metadata inventory of the extracted CE 2.670 tree. Counts, paths, hashes. It does not print file contents or table rows. |
| `private-bmp-verify.yml` | BMP and install-index check against the reference install. Counts and diagnostic codes only. |
| `private-ce-harness.yml` | Wine behaviour capture. Screenshots, frames, the Wine prefix, and the game working copy are deleted on the runner. The uploaded artifact is measured numbers only. |

Nothing produced by those three workflows is attached to a GitHub Release. Dispatching them is not a step in cutting a tag.

## Artifacts

One tag produces the set below. Files are attached to the GitHub Release for that tag. They are never committed. `.gitignore` already ignores `dist/`, `build/`, `target/`, `*.exe`, `*.msi`, and `*.iso`, and the asset check rejects any tracked file over 1 MiB (`1048576` bytes).

The product name in installer UI and filenames is **SFC2.js**. The bundle identifier is chosen when the Tauri config is written. It is a project id, with no Paramount or Star Trek mark in the name. Filenames below use that product name; Tauri's exact spelling is fixed when `desktop/src-tauri` exists.

| OS | Player-facing files | Status |
| --- | --- | --- |
| macOS | Universal `.dmg` (Apple silicon and Intel) containing the `.app` | **Planned.** Tauri build from `desktop/src-tauri`, universal target. |
| Windows | WiX `.msi` and NSIS `.exe` | **Planned.** Both are built and both are tested. |
| Linux | AppImage, `.deb`, and `.rpm` | **Planned.** Each package is built and installed once per release. |
| Web | `sfc2.js-<version>-web.zip`, a zip of `web/dist/` | Build command exists (`pnpm build:web`). Zipping and uploading are **planned**. |

`web/vite.config.ts` sets `publicDir: false` and `outDir` to `web/dist/`. The dev install plugin in `web/dev-install-server.ts` is `apply: 'serve'`, so `vite build` does not register that route and does not copy an install into `web/dist/`. The zip is taken from a build that had no `SFC2_INSTALL` set.

The **planned** Tauri config points the shell at that same `web/dist` (`frontendDist` relative to `desktop/src-tauri`, `beforeBuildCommand` running `pnpm build:web` from the repo root). The desktop artifact is the shell plus that frontend. It is not a second copy of the player's game.

Updater archives (`.tar.gz` plus a `.sig`, per the Tauri updater) are **planned** and are listed in [Updater](#tauri-updater). They are extra Release assets, not a second product.

There is no Mac App Store, Microsoft Store, Steam, or other store package.

## Signing and notarization

Builds are **unsigned** until Daniel chooses a macOS identity and a Windows option. The project does not create a self-signed certificate to fill the gap. Unsigned macOS builds are expected to fail Gatekeeper. Unsigned Windows builds are expected to trip SmartScreen. The smoke test records that warning while this section is still open. It does not treat the warning as a passed signature check.

Wintermute adds GitHub Actions encrypted secrets on `danielsegan/sfc2.js` only after Daniel's decision. Secret values stay in GitHub encrypted secrets. They are not committed, not printed in logs, and not pasted into issues or this document.

### macOS (planned)

Developer ID Application signing, then Apple notarization through `notarytool`, then stapling the ticket. This is Developer ID distribution, not Mac App Store signing. Hardened runtime is on.

Planned secret names, once Daniel has an Apple Developer account for the project:

| Secret | Use |
| --- | --- |
| `APPLE_CERTIFICATE` | Developer ID Application certificate, PKCS#12, base64 |
| `APPLE_CERTIFICATE_PASSWORD` | Password for that PKCS#12 |
| `APPLE_SIGNING_IDENTITY` | Identity string passed to the Tauri build |
| `APPLE_ID` | Apple ID for `notarytool` |
| `APPLE_PASSWORD` | App-specific password for `notarytool` |
| `APPLE_TEAM_ID` | Team id |

A signed release is not cut until `notarytool` has accepted the upload and the stapled `.app` passes assessment on a clean Mac. Until then the macOS artifact is labeled unsigned in the Release notes.

### Windows (planned, option not chosen)

Daniel picks one of these. The workflow is written for that choice only.

| Option | Shape | Consequence |
| --- | --- | --- |
| Azure Artifact Signing (Trusted Signing) | Cloud signature, no hardware token | Fits GitHub-hosted runners. Needs an Azure subscription Daniel controls. |
| EV Authenticode | Hardware token | SmartScreen reputation starts immediately. Poor fit for a hosted runner unless the signing step runs where the token lives. |
| Standard OV Authenticode | PFX in a GitHub secret | Works on hosted runners. SmartScreen reputation builds slowly, so warnings continue after signing starts. |

Planned secret names depend on the option (`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, and the Trusted Signing endpoint, or `WINDOWS_CERTIFICATE` plus `WINDOWS_CERTIFICATE_PASSWORD`). They are created when the option is chosen, not before.

### Linux

No platform notarization step. The integrity check for AppImage, `.deb`, and `.rpm` is the SHA-256 sum. A project GPG key is out of scope until Daniel asks for one.

## Tauri updater

**Planned**, and blocked on the same decision as the signing keys. The plugin is not in the tree. The updater stays off until Daniel decides who holds the offline copy of the private key. The project does not generate that keypair before the decision.

When it is turned on:

- The app uses the Tauri updater plugin. The public minisign key is committed in the Tauri config. It ships inside the app. It is not a secret.
- The private key and its password exist only as GitHub Actions encrypted secrets: `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- An offline copy is kept wherever Daniel decides (the decision is custody, not whether a second copy is invented ad hoc). The Producer does not keep a personal copy. A lost private key means installs already in the field cannot trust a later update, so custody is settled before the first updater-enabled tag.
- Each release publishes a static JSON manifest on the GitHub Release. Each platform entry has a URL and a minisign signature for an archive that this process built. The manifest lists only those archives.
- The update payload is the application archive. It contains project code and project-original art. It does not contain game files, and applying it does not write into the player's SFC2 install.
- The web zip has no updater. Replacing a web install is a new zip.

Generating the key is a Tauri signer step run once, locally, by the person Daniel names. The private key moves into GitHub encrypted secrets and the offline store, then leaves the machine it was generated on. The public key is what gets committed.

## Checksums and SBOM

Both are **planned** as a release job. Until that job exists, the person cutting the tag produces them on the build machine after the artifacts exist and before upload.

### SHA-256

`SHA256SUMS` is a text file in GNU `sha256sum` form: 64 hex characters, two spaces, the file name. One line per uploaded file. The file covers every installer, the `.app` archive if it is uploaded separately from the `.dmg`, the web zip, the updater archives and signatures, the manifest, and every SBOM. It does not list itself.

Generate it in the directory that contains the artifacts, then re-hash each file and compare before upload. The smoke test starts by checking the sum on the machine that installs.

### SBOM

One format for a given release, named in the Release notes. Preferred format is CycloneDX JSON. SPDX is the alternative if the generator Daniel accepts emits SPDX. The documents describe the dependencies that were compiled in, not the player's game files.

| Document | Source | When |
| --- | --- | --- |
| `sbom-npm.cdx.json` (or the SPDX name if that format is chosen) | `pnpm-lock.yaml`, production tree of the root package and `@sfc2js/formats`, `@sfc2js/platform`, `@sfc2js/render` | Every release. The lockfile exists today. The generator does not. |
| `sbom-cargo.cdx.json` | `desktop/src-tauri/Cargo.lock`, plus a Rust WASM crate's `Cargo.lock` if one exists | The first release that contains a `Cargo.lock`. Until then the notes say the cargo SBOM is not applicable. |

No SBOM generator is a dependency yet. Adding one is a separate change. This process only requires that the files exist on the Release before a tag is called done.

## Smoke test

Run this once per artifact on the candidate tag, on a machine that did not build it. Record the OS version, the artifact file name, and the SHA-256 in the Release notes or the PR that requested Daniel's approval.

Desktop rows apply when a desktop artifact exists. Until `desktop/src-tauri` exists, a candidate may be web-only: run the web column and mark the desktop rows "no desktop artifact in this tag". A Phase 8 release review runs every row, including desktop.

The current web app boots a synthetic duel with no game files (Federation fixture cruiser against a Klingon fixture cruiser; see [`web/README.md`](../../web/README.md)). That screen is the correct first launch. A missing-asset error on first launch is a failure.

Mission load is **planned** until the build under test contains the mission runtime (Phase 4 and later). On an earlier tag, play the skirmish the install selects and mark the mission row "mission runtime not in this tag". A Phase 8 release review includes a real mission from the player's install.

Shared steps, for macOS, Windows, Linux, and the web zip:

1. **Checksum.** The SHA-256 of the downloaded file matches `SHA256SUMS`.
2. **Install.**
   - macOS: open the `.dmg`, copy the `.app` to Applications.
   - Windows: install the `.msi` on one machine or VM, and the NSIS `.exe` on another (or on a clean VM after uninstall). Both paths must succeed.
   - Linux: install the AppImage (`chmod +x` and run), the `.deb`, and the `.rpm`, each at least once.
   - Web: unzip `sfc2.js-<version>-web.zip` and serve `web/dist` with a static file server. Do not use `pnpm dev:web`. `SFC2_INSTALL` and `?install=` are dev-server features and are absent from this build.
3. **Launch.** The app opens on the synthetic duel. No dialog asks to download game data. No original title logo is shown.
4. **First run, player's install.** Point the app at a Community Edition 2.670 install the tester legally owns. The reference baseline is CE 2.670; another SFC2 install the tester owns is allowed for this check, and the notes name which one.
   - Web, Chromium: **Load install folder** uses the File System Access API. WebKit and Firefox use the directory input. **Zip** reads an archive the tester supplies of an install they own.
   - Desktop (**planned**): a native folder picker, read-only. The path stays on the machine.
   - The install root is the folder that contains `Starfleet2CE.exe` or `Starfleet2.exe`, or an `Assets` folder the picker was given. Paths the app reports are relative to that root ([`docs/formats/bmp.md`](../formats/bmp.md)).
   - Quit and confirm the install directory's mtime set is unchanged, and that the app directory, the repo, and the browser profile contain no copies of `.mod`, `.bmp`, `.wav`, `.q3`, or other game files.
5. **Skirmish from that install.** With the install loaded, the default pair is the Federation heavy cruiser (`F-CA` when that row exists) against the Klingon D7 (`K-D7`, or the closest Klingon cruiser). A missing model keeps the placeholder hull. The match runs.
6. **Mission (planned until the runtime is in the build).** Load one mission from the player's install, start it, and leave it. The mission file stays in the install. The app does not write a copy into its own resources.
7. **Update (planned for desktop).** Install the previous tagged build, point the updater at this candidate's manifest, accept the update, and relaunch. The version shown is this candidate. The install pointer still resolves. The updater archive contains no game files. For the web zip, replace the served directory with the new zip and reload; there is no in-app updater.
8. **Uninstall.** Remove the `.app`, run the Windows uninstaller, or remove the Linux package and the AppImage. Delete the unzipped web directory. The player's SFC2 install is still complete and still launches under the tester's own original client. Settings the app stored locally are gone with the app. Nothing was sent to a project server.

Signature rows, only after signing is turned on:

- macOS: Gatekeeper accepts the stapled app. The notarization ticket is present.
- Windows: the `.msi` and the NSIS `.exe` show the project certificate. SmartScreen behaviour matches the option Daniel chose.
- While signing is still pending, write "unsigned, warning shown" and continue the functional steps. Do not click through a warning on a build that was supposed to be signed.

## What never ships

This section is binding for every tag, including private studio tags and unsigned candidates.

Original SFC2 game files and assets are never committed, bundled, downloaded by the app, or uploaded as Release assets. Players bring their own legally obtained install. The engine reads it at runtime from the player's machine (File System Access API, a directory input, a zip the player supplies, or, when the shell exists, a native read of a folder they pick). Those bytes stay on that machine.

Release artifacts contain project code and art this project created (the SVG under `web/art/` and later original UI art). They do not contain models, textures, sound, music, video, missions, shiplist or ftrlist dumps taken from the game, save files, or installer packages from Interplay, Taldren, or the Community Edition.

The CI job **Block original game files and large binaries** (workflow name "No game files", script [`tools/check-no-game-files.sh`](../../tools/check-no-game-files.sh)) must be green on the PR and on the tagged commit. The script scans `git ls-files` and fails when any tracked path, unless it is listed in `tools/allowed-fixtures.txt`, matches one of these:

- A forbidden extension: `exe`, `dll`, `mod`, `sprite`, `mvm`, `wav`, `mp3`, `bik`, `mpg`, `mpeg`, `tga`, `bmp`, `gf`, `scs`, `dat`, `sav`, `scr`, `q3`, `msi`, `iso`.
- A forbidden path prefix: `assets/original/`, `starfleet command ii`, `starfleet command 2`, `sfc2ce/`, `sfc2/`, `empires at war`.
- A file larger than 1 MiB.

`tools/allowed-fixtures.txt` is for synthetic fixtures this project created. It is not a way to land a real game file. The allowlist is not used for Release assets.

That CI job scans the git tree. It does not open a `.dmg`, `.msi`, `.exe`, AppImage, `.deb`, `.rpm`, or zip. Before upload, unpack each artifact (list the `.app` bundle, the AppImage, the packages, and the zip) and reject the candidate if any entry inside has a forbidden extension, a forbidden path, or a file that is a copy of a game asset. Our own installer is the outer file the player downloads. It is not committed, and it is not an excuse to put game data inside the archive. A content scan of those archives in CI is **planned**; the manual unpack is required until that job exists.

Also refused in icons, installer chrome, the web shell, and Release text:

- Paramount trade dress. No delta or arrowhead insignia, no LCARS elbows or pill-shaped colour blocks, no show logos, no franchise typefaces. The same rule is in [`docs/ui/README.md`](../ui/README.md) and [`docs/ui/style-guide.md`](../ui/style-guide.md).
- A paid build, a store listing, or any wording that says the project is official, licensed, or affiliated with Paramount, Interplay, or Taldren. Distribution is the GitHub Release and, later, a static web host Daniel approves. The project is non-commercial and GPL-3.0-only.
- Anything from the SFC2-decomp project, or from any other decompilation or disassembly. Code, comments, names taken from that work, and docs derived from it do not go in a release. Contributors do not open that project while working on this one ([`docs/LEGAL.md`](../LEGAL.md)).
- Private CI output: inventory JSON that has not been reviewed into `docs/formats/inventory/`, harness screenshots, Wine prefixes, and the CE 2.670 tree from `sfc2-ci`.

A public release needs Daniel's approval. That includes a public repository, a public GitHub Release, a public web host, and any build sent to people outside the studio. The Producer may cut a private tag for the studio after the checklist is green. Publishing it is Daniel's decision, after the takedown plan and legal review.

## Release checklist

Copy this into the PR or the GitHub Release draft. Leave a row blank until it is done. A Phase 8 public release needs every row. An earlier private web tag may mark desktop, updater, signing, and mission rows as not in this tag, and still needs the asset, CI, checksum, and approval rows that apply.

- [ ] Version in root `package.json` is the canonical string, and every version field that exists matches it (`tools/formats`, `engine/platform`, `engine/render`, and, when present, `desktop/src-tauri/tauri.conf.json` and `Cargo.toml`).
- [ ] `CHANGELOG.md` has the version, the UTC date, and the moved notes. `Unreleased` is empty.
- [ ] `pnpm check` passed locally. Every public workflow is green on the tagged commit, including **Block original game files and large binaries**.
- [ ] Tag is annotated (`vX.Y.Z-rc.N`, then `vX.Y.Z` on the same commit). The tag was not moved.
- [ ] Artifacts for this tag are built from that commit: web zip of `web/dist/`, and, when the shell exists, macOS universal `.dmg`/`.app`, Windows `.msi` and NSIS `.exe`, Linux AppImage, `.deb`, and `.rpm`.
- [ ] `SHA256SUMS` matches a fresh hash of every uploaded file. SBOM files are attached (`sbom-npm`, and `sbom-cargo` once a `Cargo.lock` exists).
- [ ] Each artifact was unpacked. No original game file, forbidden extension, or forbidden path is inside. `LICENSE` is inside.
- [ ] Smoke test passed for each artifact, including first-run against the tester's own install, a skirmish, uninstall, and (when the runtime or the updater is in the tag) a mission and an update.
- [ ] Signing matches Daniel's decision: either still unsigned and labeled as such, or Developer ID + `notarytool` and the chosen Windows option, with secrets only in GitHub encrypted secrets.
- [ ] Updater manifest, if this tag enables updates, is signed with the key whose custody Daniel decided. The public key in the app matches. The payload has no game files.
- [ ] Release notes state whether `versionHash` inputs changed, and they describe the project as a non-commercial fan engine.
- [ ] Icons and installer chrome have no delta, LCARS, or show logos.
- [ ] Daniel has approved any public release. Private studio tags stop before that step.
