//! Player-chosen install folder.
//!
//! The dialog runs in-process. On success the folder is canonicalized and
//! added to the read-only `fs` scope. Listing and reading go through these
//! commands so the webview never receives an absolute path. Errors are fixed
//! strings for the same reason. Symlinks are skipped, not followed.

use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::Serialize;
use tauri::State;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::FsExt;

#[derive(Default)]
pub struct GrantedInstall {
    root: Option<PathBuf>,
}

#[derive(Serialize)]
pub struct ListedFile {
    pub path: String,
    pub size: u64,
}

#[tauri::command]
pub fn pick_install_directory(
    app: tauri::AppHandle,
    grant: State<'_, std::sync::Mutex<GrantedInstall>>,
) -> Result<bool, &'static str> {
    let picked = app
        .dialog()
        .file()
        .set_title("Choose your SFC2 install folder")
        .blocking_pick_folder();
    let Some(picked) = picked else {
        return Ok(false);
    };
    let path = picked.into_path().map_err(|_| "unreadable")?;
    let canonical = fs::canonicalize(&path).map_err(|_| "unreadable")?;
    if !canonical.is_dir() {
        return Err("unreadable");
    }
    app.fs_scope()
        .allow_directory(&canonical, true)
        .map_err(|_| "unreadable")?;
    grant.lock().map_err(|_| "unreadable")?.root = Some(canonical);
    Ok(true)
}

#[tauri::command]
pub fn list_install_files(
    grant: State<'_, std::sync::Mutex<GrantedInstall>>,
) -> Result<Vec<ListedFile>, &'static str> {
    let root = grant
        .lock()
        .map_err(|_| "unreadable")?
        .root
        .clone()
        .ok_or("unavailable")?;
    list_install_tree(&root)
}

#[tauri::command]
pub fn read_install_file(
    relative_path: String,
    grant: State<'_, std::sync::Mutex<GrantedInstall>>,
) -> Result<tauri::ipc::Response, &'static str> {
    let root = grant
        .lock()
        .map_err(|_| "unreadable")?
        .root
        .clone()
        .ok_or("unavailable")?;
    let bytes = read_relative(&root, &relative_path)?;
    Ok(tauri::ipc::Response::new(bytes))
}

fn list_install_tree(root: &Path) -> Result<Vec<ListedFile>, &'static str> {
    let mut out = Vec::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let entries = match fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(_) if dir == root => return Err("unreadable"),
            Err(_) => continue,
        };
        for entry in entries {
            let Ok(entry) = entry else { continue };
            let path = entry.path();
            let Ok(meta) = fs::symlink_metadata(&path) else {
                continue;
            };
            if meta.file_type().is_symlink() {
                continue;
            }
            if meta.is_dir() {
                stack.push(path);
                continue;
            }
            if !meta.is_file() {
                continue;
            }
            let Some(relative) = relative_install_path(root, &path) else {
                continue;
            };
            out.push(ListedFile {
                path: relative,
                size: meta.len(),
            });
        }
    }
    out.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(out)
}

fn read_relative(root: &Path, raw: &str) -> Result<Vec<u8>, &'static str> {
    let joined = join_relative(root, raw)?;
    let meta = fs::symlink_metadata(&joined).map_err(|_| "unreadable")?;
    if meta.file_type().is_symlink() || !meta.is_file() {
        return Err("unreadable");
    }
    let canonical = fs::canonicalize(&joined).map_err(|_| "unreadable")?;
    if !canonical.starts_with(root) {
        return Err("unreadable");
    }
    fs::read(&canonical).map_err(|_| "unreadable")
}

fn join_relative(root: &Path, raw: &str) -> Result<PathBuf, &'static str> {
    if raw.is_empty() || raw.len() > 4096 || raw.contains('\0') {
        return Err("unreadable");
    }
    let normalized = raw.replace('\\', "/");
    if normalized.starts_with('/') || normalized.starts_with("//") {
        return Err("unreadable");
    }
    let bytes = normalized.as_bytes();
    if bytes.len() >= 2 && bytes[1] == b':' {
        return Err("unreadable");
    }
    let mut out = root.to_path_buf();
    for segment in normalized.split('/') {
        if segment.is_empty()
            || segment == "."
            || segment == ".."
            || segment.contains(':')
            || segment.contains('/')
            || segment.contains('\\')
        {
            return Err("unreadable");
        }
        out.push(segment);
    }
    Ok(out)
}

fn relative_install_path(root: &Path, file: &Path) -> Option<String> {
    let relative = file.strip_prefix(root).ok()?;
    let mut parts = Vec::new();
    for component in relative.components() {
        match component {
            Component::Normal(part) => {
                let text = part.to_str()?;
                if text.is_empty()
                    || text == "."
                    || text == ".."
                    || text.contains(':')
                    || text.contains('/')
                    || text.contains('\\')
                {
                    return None;
                }
                parts.push(text);
            }
            _ => return None,
        }
    }
    if parts.is_empty() {
        None
    } else {
        Some(parts.join("/"))
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::{list_install_tree, read_relative};

    struct TempTree {
        path: PathBuf,
    }

    impl TempTree {
        fn new() -> Self {
            static COUNTER: AtomicU64 = AtomicU64::new(0);
            let nanos = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|duration| duration.as_nanos())
                .unwrap_or(0);
            let path = std::env::temp_dir().join(format!(
                "sfc2js-install-{}-{}-{}",
                std::process::id(),
                nanos,
                COUNTER.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir_all(&path).unwrap();
            Self { path }
        }
    }

    impl Drop for TempTree {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    #[test]
    fn lists_nested_files_without_reading_them_and_skips_symlinks() {
        let tree = TempTree::new();
        let specs = tree.path.join("Assets").join("Specs");
        fs::create_dir_all(&specs).unwrap();
        let shiplist = specs.join("shiplist.txt");
        fs::write(&shiplist, b"synthetic").unwrap();
        fs::write(tree.path.join("Starfleet2CE.exe"), [0x4d, 0x5a]).unwrap();
        std::os::unix::fs::symlink("/etc/hostname", tree.path.join("outside")).unwrap();

        let listed = list_install_tree(&tree.path).unwrap();
        let paths: Vec<&str> = listed.iter().map(|file| file.path.as_str()).collect();
        assert_eq!(paths, vec!["Assets/Specs/shiplist.txt", "Starfleet2CE.exe"]);
        assert_eq!(listed[0].size, b"synthetic".len() as u64);
        assert_eq!(
            read_relative(&tree.path, "Assets/Specs/shiplist.txt").unwrap(),
            b"synthetic"
        );
        assert!(read_relative(&tree.path, "outside").is_err());
        assert!(read_relative(&tree.path, "../hostname").is_err());
        assert!(read_relative(&tree.path, "Assets/../../etc/hostname").is_err());
        assert!(read_relative(&tree.path, "/etc/hostname").is_err());
        assert!(read_relative(&tree.path, "C:/Windows/note.txt").is_err());
    }
}
