//! Player-chosen install folder.
//!
//! The page never receives an absolute path. `pick_install_directory` returns
//! a random token. `list_install_files` and `read_install_file` accept that
//! token only. Picking again replaces the grant and the previous token
//! returns `unavailable`. Listing keeps the filesystem's spelling. The
//! virtual file system folds case itself. A read returns the whole file.
//! Errors are the fixed strings `unreadable` and `unavailable`.

use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::State;
use tauri_plugin_dialog::DialogExt;

pub struct InstallGrant {
    current: Mutex<Option<ActiveGrant>>,
}

struct ActiveGrant {
    token: String,
    root: PathBuf,
}

impl Default for InstallGrant {
    fn default() -> Self {
        Self {
            current: Mutex::new(None),
        }
    }
}

impl InstallGrant {
    pub fn shared() -> Arc<Self> {
        Arc::new(Self::default())
    }

    fn replace(&self, root: PathBuf) -> Result<String, &'static str> {
        let token = random_token()?;
        let mut guard = self.current.lock().map_err(|_| "unavailable")?;
        *guard = Some(ActiveGrant {
            token: token.clone(),
            root,
        });
        Ok(token)
    }

    fn root_for(&self, token: &str) -> Result<PathBuf, &'static str> {
        if token.is_empty() {
            return Err("unavailable");
        }
        let guard = self.current.lock().map_err(|_| "unavailable")?;
        match guard.as_ref() {
            Some(active) if active.token == token => Ok(active.root.clone()),
            _ => Err("unavailable"),
        }
    }
}

#[derive(Serialize)]
pub struct ListedFile {
    pub path: String,
    pub size: u64,
}

#[tauri::command]
pub async fn pick_install_directory(
    app: tauri::AppHandle,
    grant: State<'_, Arc<InstallGrant>>,
) -> Result<Option<String>, &'static str> {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_title("Choose your SFC2 install folder")
        .pick_folder(move |folder| {
            let _ = sender.send(folder);
        });
    let Some(picked) = receiver.await.map_err(|_| "unavailable")? else {
        return Ok(None);
    };
    let path = picked.into_path().map_err(|_| "unreadable")?;
    let canonical = tauri::async_runtime::spawn_blocking(move || canonicalize_directory(path))
        .await
        .map_err(|_| "unreadable")??;
    Ok(Some(grant.replace(canonical)?))
}

#[tauri::command]
pub async fn list_install_files(
    token: String,
    grant: State<'_, Arc<InstallGrant>>,
) -> Result<Vec<ListedFile>, &'static str> {
    let root = grant.root_for(&token)?;
    tauri::async_runtime::spawn_blocking(move || list_install_tree(&root))
        .await
        .map_err(|_| "unreadable")?
}

#[tauri::command]
pub async fn read_install_file(
    token: String,
    relative_path: String,
    grant: State<'_, Arc<InstallGrant>>,
) -> Result<tauri::ipc::Response, &'static str> {
    let root = grant.root_for(&token)?;
    let bytes = tauri::async_runtime::spawn_blocking(move || read_relative(&root, &relative_path))
        .await
        .map_err(|_| "unreadable")??;
    Ok(tauri::ipc::Response::new(bytes))
}

fn canonicalize_directory(path: PathBuf) -> Result<PathBuf, &'static str> {
    let canonical = fs::canonicalize(&path).map_err(|_| "unreadable")?;
    if !canonical.is_dir() {
        return Err("unreadable");
    }
    Ok(canonical)
}

fn random_token() -> Result<String, &'static str> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).map_err(|_| "unavailable")?;
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut token = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        token.push(HEX[(byte >> 4) as usize] as char);
        token.push(HEX[(byte & 0x0f) as usize] as char);
    }
    Ok(token)
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

    use super::{list_install_tree, read_relative, InstallGrant};

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

    #[cfg(unix)]
    #[test]
    fn lists_nested_files_without_reading_them_and_skips_symlinks() {
        let tree = TempTree::new();
        let specs = tree.path.join("Assets").join("Specs");
        fs::create_dir_all(&specs).unwrap();
        let shiplist = specs.join("shiplist.txt");
        fs::write(&shiplist, b"synthetic").unwrap();
        fs::write(specs.join("ShipList.TXT"), b"Kept").unwrap();
        fs::write(tree.path.join("Starfleet2CE.exe"), [0x4d, 0x5a]).unwrap();
        std::os::unix::fs::symlink("/etc/hostname", tree.path.join("outside")).unwrap();

        let listed = list_install_tree(&tree.path).unwrap();
        let paths: Vec<&str> = listed.iter().map(|file| file.path.as_str()).collect();
        assert_eq!(
            paths,
            vec![
                "Assets/Specs/ShipList.TXT",
                "Assets/Specs/shiplist.txt",
                "Starfleet2CE.exe",
            ]
        );
        assert_eq!(listed[1].size, b"synthetic".len() as u64);
        assert_eq!(
            read_relative(&tree.path, "Assets/Specs/ShipList.TXT").unwrap(),
            b"Kept"
        );
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

    #[test]
    fn a_new_grant_invalidates_the_previous_token() {
        let grant = InstallGrant::default();
        assert!(grant.root_for("").is_err());
        assert!(grant.root_for("missing").is_err());
        let first = grant.replace(PathBuf::from("/tmp/first")).unwrap();
        let second = grant.replace(PathBuf::from("/tmp/second")).unwrap();
        assert_ne!(first, second);
        assert_eq!(first.len(), 64);
        assert!(grant.root_for(&first).is_err());
        assert_eq!(
            grant.root_for(&second).unwrap(),
            PathBuf::from("/tmp/second")
        );
        assert!(grant.root_for("").is_err());
    }
}
