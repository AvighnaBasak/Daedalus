//! Reliable Claude Code detection. The inherited opcode check skipped running
//! `--version` in release builds ("cannot verify in production") which made the
//! installed app claim Claude was missing even when it wasn't. This probe
//! actually executes the CLI in every build, hides the console window, and
//! falls back to a shell-resolved lookup so `.cmd` shims and PATH entries work.

use serde::Serialize;
use tauri::AppHandle;
use tokio::process::Command as TokioCommand;

#[derive(Serialize)]
pub struct ClaudeProbe {
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
}

fn extract_version(text: &str) -> Option<String> {
    regex::Regex::new(r"(\d+\.\d+\.\d+(?:-[A-Za-z0-9.\-]+)?)")
        .ok()?
        .captures(text)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
}

async fn try_version(program: &str, via_cmd: bool) -> Option<String> {
    let mut cmd = if via_cmd {
        let mut c = TokioCommand::new("cmd");
        c.arg("/c").arg(program).arg("--version");
        c
    } else {
        let mut c = TokioCommand::new(program);
        c.arg("--version");
        c
    };
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000);
    let out = cmd.output().await.ok()?;
    if !out.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&out.stdout);
    if stdout.to_lowercase().contains("claude") {
        extract_version(&stdout).or(Some(stdout.trim().to_string()))
    } else {
        None
    }
}

#[tauri::command]
pub async fn probe_claude(app: AppHandle) -> ClaudeProbe {
    // 1) Discovered absolute path (handles custom installs).
    if let Ok(path) = crate::claude_binary::find_claude_binary(&app) {
        let lower = path.to_lowercase();
        let via_cmd = cfg!(windows) && (lower.ends_with(".cmd") || lower.ends_with(".bat"));
        if let Some(version) = try_version(&path, via_cmd).await {
            return ClaudeProbe { installed: true, version: Some(version), path: Some(path) };
        }
    }
    // 2) Shell-resolved fallback: lets cmd.exe find claude/.cmd/.exe on PATH.
    let fallback = if cfg!(windows) {
        try_version("claude", true).await
    } else {
        try_version("claude", false).await
    };
    if let Some(version) = fallback {
        return ClaudeProbe { installed: true, version: Some(version), path: None };
    }
    ClaudeProbe { installed: false, version: None, path: None }
}
