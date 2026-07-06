//! Real pseudo-terminal layer for the interactive `claude` CLI.
//!
//! Unlike opcode (which drove Claude headlessly via `-p --output-format stream-json`
//! and rendered its own chat UI), Daedalus spawns the *genuine* interactive `claude`
//! TUI attached to a portable-pty master. On Windows this uses the ConPTY backend.
//! Raw bytes stream to the webview (base64) and are rendered by a themed xterm.js;
//! keystrokes are forwarded straight back to the pty.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use std::thread;

use base64::Engine;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use tauri::{AppHandle, Emitter, State};

/// A single running pty session (one interactive `claude` process).
struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

/// Manages all live pty sessions, keyed by a frontend-provided session id.
#[derive(Default)]
pub struct PtyState {
    sessions: Mutex<HashMap<String, PtySession>>,
}

/// Build the command that launches Claude, handling the Windows `.cmd`/`.bat` shim
/// case (npm global installs ship `claude.cmd`, which CreateProcess cannot run
/// directly — it must be invoked through `cmd.exe`).
#[cfg(windows)]
fn build_claude_command(claude: &str) -> CommandBuilder {
    let lower = claude.to_lowercase();
    if lower.ends_with(".cmd") || lower.ends_with(".bat") {
        let mut cmd = CommandBuilder::new("cmd.exe");
        cmd.arg("/c");
        cmd.arg(claude);
        cmd
    } else {
        CommandBuilder::new(claude)
    }
}

#[cfg(not(windows))]
fn build_claude_command(claude: &str) -> CommandBuilder {
    CommandBuilder::new(claude)
}

/// The system shell for plain terminal-panel sessions.
#[cfg(windows)]
fn build_shell_command() -> CommandBuilder {
    let mut cmd = CommandBuilder::new("powershell.exe");
    cmd.arg("-NoLogo");
    cmd
}

#[cfg(not(windows))]
fn build_shell_command() -> CommandBuilder {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into());
    CommandBuilder::new(shell)
}

/// Spawn an interactive pty session in `cwd` at the given terminal size.
/// `program` picks what runs inside: `None`/`"claude"` for the Claude CLI,
/// `"shell"` for the system shell (bottom terminal panel).
/// Streams output to the `pty:output:{id}` event and signals `pty:exit:{id}` on close.
#[tauri::command]
pub fn pty_spawn(
    app: AppHandle,
    state: State<'_, PtyState>,
    bridge: State<'_, crate::bridge::BridgeState>,
    id: String,
    cwd: String,
    cols: u16,
    rows: u16,
    args: Option<Vec<String>>,
    program: Option<String>,
) -> Result<(), String> {
    let is_shell = program.as_deref() == Some("shell");

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open pty: {e}"))?;

    let mut cmd = if is_shell {
        build_shell_command()
    } else {
        // Reuse opcode's Windows-aware binary discovery.
        let claude = crate::claude_binary::find_claude_binary(&app)?;
        build_claude_command(&claude)
    };
    // Extra CLI flags, e.g. `--continue` to resume the last conversation in cwd.
    if !is_shell {
        if let Some(extra) = &args {
            for a in extra {
                cmd.arg(a);
            }
        }
    }
    cmd.cwd(&cwd);
    // Inherit the full parent environment so `claude` can locate node, auth, etc.
    for (key, value) in std::env::vars() {
        cmd.env(key, value);
    }
    // A GUI-launched app inherits Explorer's env, which lacks any terminal
    // identity — chalk/ink-based CLIs (incl. Claude Code) then detect zero
    // color support and render monochrome. Advertise the truecolor xterm.js
    // front-end the same way VS Code's integrated terminal does.
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("FORCE_COLOR", "3");
    // Identify the house, and hand Claude the bridge that drives it (the
    // auto-installed `daedalus` skill documents these endpoints).
    cmd.env("DAEDALUS", "1");
    cmd.env("DAEDALUS_VERSION", env!("CARGO_PKG_VERSION"));
    if bridge.port != 0 {
        cmd.env("DAEDALUS_BRIDGE", format!("http://127.0.0.1:{}", bridge.port));
    }
    if !is_shell {
        // Route the CLI at the configured provider (Ollama / custom Anthropic-compatible API).
        for (key, value) in crate::provider::current_env() {
            cmd.env(key, value);
        }
    }

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn claude: {e}"))?;
    // The slave handle is no longer needed once the child owns it.
    drop(pair.slave);

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone pty reader: {e}"))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take pty writer: {e}"))?;

    // Reader thread: stream raw bytes (base64) to the webview until EOF.
    let app_clone = app.clone();
    let id_clone = id.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 8192];
        let out_event = format!("pty:output:{id_clone}");
        let exit_event = format!("pty:exit:{id_clone}");
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let encoded = base64::engine::general_purpose::STANDARD.encode(&buf[..n]);
                    let _ = app_clone.emit(&out_event, encoded);
                }
                Err(_) => break,
            }
        }
        let _ = app_clone.emit(&exit_event, ());
    });

    state.sessions.lock().unwrap().insert(
        id,
        PtySession {
            master: pair.master,
            writer,
            child,
        },
    );

    Ok(())
}

/// Forward user input (keystrokes / pasted text) to the pty.
#[tauri::command]
pub fn pty_write(state: State<'_, PtyState>, id: String, data: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    let session = sessions
        .get_mut(&id)
        .ok_or_else(|| format!("No pty session: {id}"))?;
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("pty write failed: {e}"))?;
    session
        .writer
        .flush()
        .map_err(|e| format!("pty flush failed: {e}"))?;
    Ok(())
}

/// Resize the pty to match the xterm viewport.
#[tauri::command]
pub fn pty_resize(
    state: State<'_, PtyState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    let session = sessions
        .get(&id)
        .ok_or_else(|| format!("No pty session: {id}"))?;
    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("pty resize failed: {e}"))?;
    Ok(())
}

/// Kill a pty session and drop its handles.
#[tauri::command]
pub fn pty_kill(state: State<'_, PtyState>, id: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(mut session) = sessions.remove(&id) {
        let _ = session.child.kill();
    }
    Ok(())
}
