# desktop/

Tauri desktop shell around the web app, for players who prefer a native window and local filesystem access to their SFC2 install.

Desktop packaging and release builds are Phase 8 work; this directory is reserved so the layout is stable from Phase 0. There is no `src-tauri` project yet. `.github/workflows/release.yml` looks for a Tauri config in `desktop/src-tauri/` and in `src-tauri/` at the repo root, and skips desktop bundles until one exists. It never packages an SFC2 install.
