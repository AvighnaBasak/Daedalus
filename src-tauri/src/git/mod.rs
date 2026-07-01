//! Git-backed agentic orchestration: worktree isolation for parallel agents,
//! snapshot/rewind via git plumbing, and a project scaffold runner. All shell out
//! to the real `git` binary (worktrees require it; isomorphic-git can't do them).

use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;

#[derive(Serialize)]
pub struct WorktreeInfo {
    pub path: String,
    pub branch: String,
    pub head: String,
}

/// Run a git command inside `dir`, returning trimmed stdout or the stderr as an error.
fn git(dir: &str, args: &[&str]) -> Result<String, String> {
    let out = Command::new("git")
        .arg("-C")
        .arg(dir)
        .args(args)
        .output()
        .map_err(|e| format!("git is not available: {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        Err(if err.is_empty() { "git command failed".into() } else { err })
    }
}

fn short_hash(s: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(s.as_bytes());
    h.finalize().iter().take(4).map(|b| format!("{b:02x}")).collect()
}

#[tauri::command]
pub fn git_is_repo(path: String) -> bool {
    git(&path, &["rev-parse", "--is-inside-work-tree"])
        .map(|s| s == "true")
        .unwrap_or(false)
}

#[tauri::command]
pub fn git_repo_root(path: String) -> Option<String> {
    git(&path, &["rev-parse", "--show-toplevel"]).ok()
}

#[tauri::command]
pub fn git_current_branch(path: String) -> String {
    git(&path, &["rev-parse", "--abbrev-ref", "HEAD"]).unwrap_or_else(|_| "HEAD".into())
}

/// Create an isolated worktree on a new branch under the Daedalus data dir.
#[tauri::command]
pub fn git_create_worktree(repo: String, branch: String) -> Result<String, String> {
    let base = dirs::data_local_dir()
        .ok_or("Could not resolve local data directory")?
        .join("Daedalus")
        .join("worktrees");
    let repo_name = PathBuf::from(&repo)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "repo".into());
    let dir = base
        .join(format!("{repo_name}-{}", short_hash(&repo)))
        .join(&branch);
    if let Some(parent) = dir.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let dir_str = dir.to_string_lossy().to_string();
    git(&repo, &["worktree", "add", &dir_str, "-b", &branch])?;
    Ok(dir_str)
}

#[tauri::command]
pub fn git_list_worktrees(repo: String) -> Result<Vec<WorktreeInfo>, String> {
    let out = git(&repo, &["worktree", "list", "--porcelain"])?;
    let mut list = Vec::new();
    let mut path = String::new();
    let mut head = String::new();
    let mut branch = String::new();
    for line in out.lines() {
        if let Some(p) = line.strip_prefix("worktree ") {
            path = p.to_string();
        } else if let Some(h) = line.strip_prefix("HEAD ") {
            head = h.to_string();
        } else if let Some(b) = line.strip_prefix("branch ") {
            branch = b.trim_start_matches("refs/heads/").to_string();
        } else if line.is_empty() && !path.is_empty() {
            list.push(WorktreeInfo {
                path: std::mem::take(&mut path),
                branch: std::mem::take(&mut branch),
                head: std::mem::take(&mut head),
            });
        }
    }
    if !path.is_empty() {
        list.push(WorktreeInfo { path, branch, head });
    }
    Ok(list)
}

#[tauri::command]
pub fn git_remove_worktree(repo: String, dir: String) -> Result<(), String> {
    git(&repo, &["worktree", "remove", "--force", &dir])?;
    Ok(())
}

/// Snapshot the full working tree (tracked + untracked) as a dangling commit,
/// without moving HEAD or touching branch history. Returns the commit SHA.
#[tauri::command]
pub fn git_checkpoint(cwd: String, label: String) -> Result<String, String> {
    git(&cwd, &["add", "-A"])?;
    let tree = git(&cwd, &["write-tree"])?;
    let msg = format!("daedalus checkpoint: {label}");
    let head = git(&cwd, &["rev-parse", "HEAD"]).ok();
    let sha = match &head {
        Some(h) => git(&cwd, &["commit-tree", &tree, "-p", h, "-m", &msg])?,
        None => git(&cwd, &["commit-tree", &tree, "-m", &msg])?,
    };
    // Restore the index to HEAD so the user's staging state is untouched.
    let _ = git(&cwd, &["reset", "-q"]);
    Ok(sha)
}

/// Restore tracked files to a checkpoint snapshot. Untracked files created after
/// the checkpoint are intentionally left in place (no destructive clean).
#[tauri::command]
pub fn git_rewind(cwd: String, sha: String) -> Result<String, String> {
    git(&cwd, &["restore", "--source", &sha, "--worktree", "--", "."])?;
    Ok("Restored tracked files to the checkpoint. Files created since then were left in place.".into())
}

/// Run a project scaffold command (async so it never blocks the UI). On Windows,
/// npm/npx are `.cmd` shims and must be invoked through cmd.exe.
#[tauri::command]
pub async fn run_scaffold(command: String, args: Vec<String>, cwd: String) -> Result<String, String> {
    use tokio::process::Command as TokioCommand;

    #[cfg(windows)]
    let mut cmd = {
        let mut c = TokioCommand::new("cmd");
        c.arg("/c").arg(&command);
        for a in &args {
            c.arg(a);
        }
        c
    };
    #[cfg(not(windows))]
    let mut cmd = {
        let mut c = TokioCommand::new(&command);
        c.args(&args);
        c
    };

    cmd.current_dir(&cwd);
    let out = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to run {command}: {e}"))?;

    let mut combined = String::from_utf8_lossy(&out.stdout).to_string();
    combined.push_str(&String::from_utf8_lossy(&out.stderr));
    if out.status.success() {
        Ok(combined)
    } else if combined.trim().is_empty() {
        Err(format!("{command} exited with an error"))
    } else {
        Err(combined)
    }
}
