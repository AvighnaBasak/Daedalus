//! Project file watcher for preview auto-reload. Emits a debounced `fs:changed`
//! event that the frontend uses to refresh the in-app browser on save.

use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};

#[derive(Default)]
pub struct WatchState {
    watcher: Mutex<Option<RecommendedWatcher>>,
}

fn is_noise(paths: &[std::path::PathBuf]) -> bool {
    paths.iter().any(|p| {
        let s = p.to_string_lossy();
        s.contains("node_modules")
            || s.contains(".git")
            || s.contains("target")
            || s.contains("dist")
            || s.contains(".next")
    })
}

/// Start watching `path` recursively; replaces any previous watch.
#[tauri::command]
pub fn watch_dir(app: AppHandle, state: tauri::State<'_, WatchState>, path: String) -> Result<(), String> {
    let last = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(1)));
    let app2 = app.clone();

    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        let Ok(event) = res else {
            return;
        };
        if !matches!(
            event.kind,
            EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_)
        ) {
            return;
        }
        if is_noise(&event.paths) {
            return;
        }
        let mut l = last.lock().unwrap();
        if l.elapsed() < Duration::from_millis(400) {
            return;
        }
        *l = Instant::now();
        let _ = app2.emit("fs:changed", ());
    })
    .map_err(|e| e.to_string())?;

    watcher
        .watch(Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    if let Ok(mut guard) = state.watcher.lock() {
        *guard = Some(watcher);
    }
    Ok(())
}

/// Stop watching.
#[tauri::command]
pub fn unwatch_dir(state: tauri::State<'_, WatchState>) -> Result<(), String> {
    if let Ok(mut guard) = state.watcher.lock() {
        *guard = None;
    }
    Ok(())
}
