//! Minimal project file access for the editor panel: list a directory and read a
//! text file. Kept as Rust commands (not the fs plugin) so project folders outside
//! the home scope can still be browsed and opened.

use serde::Serialize;
use std::fs;

#[derive(Serialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

/// List one directory level (lazy tree expansion happens on the frontend).
#[tauri::command]
pub fn list_dir(path: String) -> Result<Vec<DirEntry>, String> {
    let mut out = Vec::new();
    let read = fs::read_dir(&path).map_err(|e| e.to_string())?;
    for entry in read.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name == ".git" {
            continue;
        }
        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        out.push(DirEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir,
        });
    }
    // Directories first, then case-insensitive alpha.
    out.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    Ok(out)
}

/// Read a text file for the editor, guarding against very large / binary files.
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    const MAX_BYTES: u64 = 2_000_000; // 2 MB
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > MAX_BYTES {
        return Err("File is too large to open in the editor.".into());
    }
    fs::read_to_string(&path).map_err(|_| "This file isn't a readable text file.".to_string())
}

/// Write edited content back to a file.
#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

/// Create an empty file (fails if it already exists — the tree offers rename instead).
#[tauri::command]
pub fn create_file(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if p.exists() {
        return Err("A file with that name already exists.".into());
    }
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(p, "").map_err(|e| e.to_string())
}

/// Create a directory (and any missing parents).
#[tauri::command]
pub fn create_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

/// Rename / move a file or directory. Refuses to overwrite an existing target.
#[tauri::command]
pub fn rename_path(from: String, to: String) -> Result<(), String> {
    if std::path::Path::new(&to).exists() {
        return Err("Something with that name already exists.".into());
    }
    fs::rename(&from, &to).map_err(|e| e.to_string())
}

/// Delete a file or directory tree. The frontend confirms before calling this.
#[tauri::command]
pub fn delete_path(path: String) -> Result<(), String> {
    let meta = fs::symlink_metadata(&path).map_err(|e| e.to_string())?;
    if meta.is_dir() {
        fs::remove_dir_all(&path).map_err(|e| e.to_string())
    } else {
        fs::remove_file(&path).map_err(|e| e.to_string())
    }
}

/// Heavy directories Claude should not waste context reading.
const LEAN_DENY: &[&str] = &[
    "Read(./node_modules/**)",
    "Read(./dist/**)",
    "Read(./build/**)",
    "Read(./.next/**)",
    "Read(./target/**)",
    "Read(./coverage/**)",
    "Read(./.venv/**)",
    "Read(./__pycache__/**)",
    "Read(./vendor/**)",
    "Read(./package-lock.json)",
    "Read(./*.lock)",
];

fn lean_settings_path(cwd: &str) -> std::path::PathBuf {
    std::path::Path::new(cwd).join(".claude").join("settings.local.json")
}

/// Whether lean-context deny rules are currently applied for this project.
#[tauri::command]
pub fn get_lean_context(cwd: String) -> bool {
    let file = lean_settings_path(&cwd);
    let Ok(text) = fs::read_to_string(&file) else {
        return false;
    };
    let Ok(root) = serde_json::from_str::<serde_json::Value>(&text) else {
        return false;
    };
    let deny = root["permissions"]["deny"].as_array();
    match deny {
        Some(arr) => {
            let present: Vec<&str> = arr.iter().filter_map(|v| v.as_str()).collect();
            LEAN_DENY.iter().all(|r| present.contains(r))
        }
        None => false,
    }
}

/// Toggle lean-context deny rules in `.claude/settings.local.json` (merged
/// non-destructively with any existing permissions).
#[tauri::command]
pub fn set_lean_context(cwd: String, enable: bool) -> Result<(), String> {
    let file = lean_settings_path(&cwd);
    let mut root: serde_json::Value = fs::read_to_string(&file)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| serde_json::json!({}));
    if !root.is_object() {
        root = serde_json::json!({});
    }
    let obj = root.as_object_mut().unwrap();
    let perms = obj
        .entry("permissions")
        .or_insert_with(|| serde_json::json!({}));
    let perms_obj = perms
        .as_object_mut()
        .ok_or("permissions is not an object")?;
    let deny = perms_obj
        .entry("deny")
        .or_insert_with(|| serde_json::json!([]));
    let arr = deny.as_array_mut().ok_or("deny is not an array")?;
    // Remove any of our rules first, then re-add if enabling.
    arr.retain(|v| v.as_str().map(|s| !LEAN_DENY.contains(&s)).unwrap_or(true));
    if enable {
        for r in LEAN_DENY {
            arr.push(serde_json::json!(r));
        }
    }
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let pretty = serde_json::to_string_pretty(&root).map_err(|e| e.to_string())?;
    fs::write(&file, pretty).map_err(|e| e.to_string())
}
