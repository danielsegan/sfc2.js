fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "pick_install_directory",
            "list_install_files",
            "read_install_file",
        ]),
    ))
    .expect("failed to build the SFC2.js Tauri shell");
}
