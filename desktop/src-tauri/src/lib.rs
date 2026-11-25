mod install;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(std::sync::Mutex::new(install::GrantedInstall::default()))
        .invoke_handler(tauri::generate_handler![
            install::pick_install_directory,
            install::list_install_files,
            install::read_install_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running SFC2.js");
}
