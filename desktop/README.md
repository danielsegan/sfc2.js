# desktop/

Tauri v2 shell around the web app. Players who want a native window use it to point at their own SFC2 install. The shell never bundles, downloads, or copies original game files.

The bundle identifier `io.segan.sfc2js` is a placeholder. It is not a registered application id.

`productName` is `SFC2.js`. `version` in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` matches the root `package.json` (`0.0.0` today). There is no updater plugin, no signing configuration, and no Flatpak target.

`.github/workflows/release.yml` looks for `desktop/src-tauri/tauri.conf.json`. It does not run on pull requests. On a `v*` tag or a manual run it builds unsigned desktop bundles. It still refuses to package an SFC2 install.

## Commands

From the repository root:

```sh
pnpm desktop:dev
pnpm desktop:build
```

`desktop:dev` starts the Vite dev server at `http://127.0.0.1:5174` (`pnpm dev:web`) and opens the shell against it. `desktop:build` runs `pnpm build:web` and then packages `web/dist`.

Bundle targets are macOS `dmg` and `app`, Windows `msi` and `nsis`, and Linux `appimage`, `deb`, and `rpm`. A full `desktop:build` only produces the installers for the OS you are on.

## Prerequisites

Every OS needs:

- Node.js `>=22.18`
- pnpm `10.33.4` (`packageManager` in the root `package.json`)
- Rust 1.90 or newer (Tauri 2's current minimum)

The webview and bundler packages differ by OS.

### Linux

WebKitGTK 4.1 and a C toolchain:

```sh
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf
```

`appimage` needs `patchelf`. `deb` needs `dpkg`. `rpm` needs `rpmbuild`.

### macOS

Xcode Command Line Tools (`xcode-select --install`). `app` produces the `.app` bundle and `dmg` wraps it. This scaffold sets no signing identity and no notarization.

### Windows

- Visual Studio C++ build tools with the MSVC toolchain
- the WebView2 runtime (already present on current Windows 11 installs)
- [WiX Toolset 3](https://wixtoolset.org/) for the `msi` target

The Tauri bundler fetches NSIS when it is not already installed. This scaffold sets no certificate thumbprint.

## What the window is allowed to do

`src-tauri/capabilities/default.json` is the whole permission set for the `main` window:

- `dialog:allow-open`, so the page can open a native dialog for a folder or a file
- read-only filesystem commands (`exists`, `read-dir`, `read-file`, `stat`) with no path granted up front
- three app commands: `pick_install_directory`, `list_install_files`, `read_install_file`

`pick_install_directory` is the install flow. It opens a folder dialog, canonicalizes the choice, and adds only that directory to the filesystem scope for this process. The scope starts empty. Picking another folder adds that folder too; Tauri's scope API does not remove an earlier grant without a permanent deny, so earlier choices stay readable until the process exits. Listing and reading go through the app commands, which accept install-relative paths only, skip symlinks, and return fixed error strings so an absolute path never reaches the page.

Nothing in the capability grants writes, a shell, a process spawn, or the updater.

## Native install adapter

`@sfc2js/platform` keeps the browser folder picker and the zip importer. `preferredDirectoryPicker()` checks `globalThis.__TAURI_INTERNALS__` and, only then, returns a picker of kind `tauri`. The picked files use the same `PickedFile` shape as the browser importer: a relative path, a size, and a `read()` that loads bytes on demand. `importInstall` is unchanged.

The bridge the shell implements is `InstallFolderBridge` in `engine/platform/src/tauri-install.ts`. Tests inject a synthetic bridge. They do not read a real install.

## Icons

`src-tauri/icons/icon-source.svg` is the source: a disc and an S2 monogram drawn for this project. `pnpm exec tauri icon` rasterized the png, icns, and ico files next to it. The mark is not a Starfleet insignia and it is not `web/art/hull-glyph.svg`. Mobile icon sets are not included.
