//! Sub-agent spawner: fork a *headless* `claude -p` for a scoped task (tests,
//! docs, refactor) without polluting the main session's context. Output streams
//! to `subagent:output:{id}`; completion fires `subagent:exit:{id}`.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command as TokioCommand};

#[derive(Default)]
pub struct SubagentState {
    children: Arc<Mutex<HashMap<String, Child>>>,
}

#[derive(Serialize, Clone)]
pub struct SubagentExit {
    pub success: bool,
}

#[tauri::command]
pub async fn spawn_subagent(
    app: AppHandle,
    state: State<'_, SubagentState>,
    id: String,
    cwd: String,
    prompt: String,
    model: String,
) -> Result<(), String> {
    let claude = crate::claude_binary::find_claude_binary(&app)?;

    let lower = claude.to_lowercase();
    let mut cmd = if cfg!(windows) && (lower.ends_with(".cmd") || lower.ends_with(".bat")) {
        let mut c = TokioCommand::new("cmd");
        c.arg("/c").arg(&claude);
        c
    } else {
        TokioCommand::new(&claude)
    };
    cmd.arg("-p").arg(&prompt);
    if !model.is_empty() {
        cmd.arg("--model").arg(&model);
    }
    cmd.current_dir(&cwd);
    for (key, value) in crate::provider::current_env() {
        cmd.env(key, value);
    }
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    cmd.stdin(std::process::Stdio::null());
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn claude: {e}"))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let out_event = format!("subagent:output:{id}");
    let exit_event = format!("subagent:exit:{id}");

    if let Some(stdout) = stdout {
        let app2 = app.clone();
        let ev = out_event.clone();
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app2.emit(&ev, line);
            }
        });
    }
    if let Some(stderr) = stderr {
        let app2 = app.clone();
        let ev = out_event.clone();
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app2.emit(&ev, line);
            }
        });
    }

    // The child stays in the registry (so kill works); a waiter task polls
    // try_wait until it exits, then removes it and emits the exit event.
    state.children.lock().unwrap().insert(id.clone(), child);
    let app2 = app.clone();
    let registry = Arc::clone(&state.children);
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(400)).await;
            let done = {
                let mut map = registry.lock().unwrap();
                match map.get_mut(&id) {
                    Some(child) => match child.try_wait() {
                        Ok(Some(status)) => {
                            map.remove(&id);
                            Some(status.success())
                        }
                        Ok(None) => None,
                        Err(_) => {
                            map.remove(&id);
                            Some(false)
                        }
                    },
                    // Removed by kill_subagent.
                    None => Some(false),
                }
            };
            if let Some(success) = done {
                let _ = app2.emit(&exit_event, SubagentExit { success });
                break;
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn kill_subagent(state: State<'_, SubagentState>, id: String) -> Result<(), String> {
    if let Some(mut child) = state.children.lock().unwrap().remove(&id) {
        let _ = child.start_kill();
    }
    Ok(())
}
