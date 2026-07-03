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
    let mut cmd = Command::new("git");
    cmd.arg("-C").arg(dir).args(args);
    crate::claude_binary::hide_console(&mut cmd);
    let out = cmd
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
    Ok(parse_worktrees(&out))
}

fn parse_worktrees(out: &str) -> Vec<WorktreeInfo> {
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
    list
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

#[derive(Serialize)]
pub struct FileChange {
    pub path: String,
    /// added | modified | deleted | renamed | untracked
    pub status: String,
}

/// Working-tree changes vs HEAD (porcelain), including untracked files.
#[tauri::command]
pub fn git_status(cwd: String) -> Result<Vec<FileChange>, String> {
    let out = git(&cwd, &["status", "--porcelain=v1", "--untracked-files=all"])?;
    let mut changes = Vec::new();
    for line in out.lines() {
        if line.len() < 3 {
            continue;
        }
        let code = &line[..2];
        let rest = line[3..].to_string();
        let (path, status) = if code == "??" {
            (rest, "untracked")
        } else if code.contains('R') {
            // "old -> new"
            let new = rest.split(" -> ").last().unwrap_or(&rest).to_string();
            (new, "renamed")
        } else if code.contains('D') {
            (rest, "deleted")
        } else if code.contains('A') {
            (rest, "added")
        } else {
            (rest, "modified")
        };
        changes.push(FileChange { path, status: status.to_string() });
    }
    Ok(changes)
}

/// The HEAD version of a file (empty string if the file is new / not in HEAD).
#[tauri::command]
pub fn git_show_head(cwd: String, path: String) -> Result<String, String> {
    Ok(git(&cwd, &["show", &format!("HEAD:{path}")]).unwrap_or_default())
}

/// Full tracked diff vs HEAD (used for commit messages and secret scanning).
#[tauri::command]
pub fn git_diff(cwd: String) -> Result<String, String> {
    git(&cwd, &["diff", "HEAD"])
}

#[derive(Serialize)]
pub struct Commit {
    pub hash: String,
    pub short: String,
    pub parents: Vec<String>,
    pub refs: String,
    pub subject: String,
    pub author: String,
    pub date: String,
}

/// Recent commits for the graph view.
#[tauri::command]
pub fn git_log(cwd: String, limit: u32) -> Result<Vec<Commit>, String> {
    let fmt = "%H%x1f%h%x1f%P%x1f%D%x1f%s%x1f%an%x1f%ar";
    let out = git(
        &cwd,
        &["log", &format!("-n{limit}"), &format!("--pretty=format:{fmt}")],
    )?;
    let mut commits = Vec::new();
    for line in out.lines() {
        let f: Vec<&str> = line.split('\u{1f}').collect();
        if f.len() < 7 {
            continue;
        }
        commits.push(Commit {
            hash: f[0].to_string(),
            short: f[1].to_string(),
            parents: f[2].split_whitespace().map(String::from).collect(),
            refs: f[3].to_string(),
            subject: f[4].to_string(),
            author: f[5].to_string(),
            date: f[6].to_string(),
        });
    }
    Ok(commits)
}

/// Stage everything and commit.
#[tauri::command]
pub fn git_commit(cwd: String, message: String) -> Result<String, String> {
    git(&cwd, &["add", "-A"])?;
    git(&cwd, &["commit", "-m", &message])
}

#[derive(Serialize)]
pub struct SecretFinding {
    pub file: String,
    pub rule: String,
    pub preview: String,
}

/// Lightweight built-in secret scan (gitleaks-style rules) over the pending diff
/// and untracked files — run before committing.
#[tauri::command]
pub fn scan_secrets(cwd: String) -> Result<Vec<SecretFinding>, String> {
    use regex::Regex;
    let rules: Vec<(&str, Regex)> = vec![
        ("AWS access key", Regex::new(r"AKIA[0-9A-Z]{16}").unwrap()),
        ("Private key", Regex::new(r"-----BEGIN [A-Z ]*PRIVATE KEY-----").unwrap()),
        ("GitHub token", Regex::new(r"gh[pousr]_[A-Za-z0-9]{20,}").unwrap()),
        ("Slack token", Regex::new(r"xox[baprs]-[0-9A-Za-z-]{10,}").unwrap()),
        ("Google API key", Regex::new(r"AIza[0-9A-Za-z_\-]{35}").unwrap()),
        (
            "Generic secret",
            Regex::new(r#"(?i)(api[_-]?key|secret|token|password|passwd|access[_-]?token)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{16,}"#).unwrap(),
        ),
    ];

    let mut findings = Vec::new();
    let mut scan = |file: &str, text: &str| {
        for line in text.lines() {
            let l = line.trim();
            for (rule, re) in &rules {
                if re.is_match(l) {
                    let preview = if l.len() > 80 { format!("{}…", &l[..80]) } else { l.to_string() };
                    findings.push(SecretFinding {
                        file: file.to_string(),
                        rule: rule.to_string(),
                        preview,
                    });
                    break;
                }
            }
        }
    };

    // Added lines in the tracked diff.
    if let Ok(diff) = git(&cwd, &["diff", "HEAD"]) {
        let mut current = String::new();
        for line in diff.lines() {
            if let Some(p) = line.strip_prefix("+++ b/") {
                current = p.to_string();
            } else if let Some(added) = line.strip_prefix('+') {
                if !line.starts_with("+++") {
                    scan(&current, added);
                }
            }
        }
    }
    // Untracked files (the classic place a stray .env with keys hides).
    if let Ok(status) = git_status(cwd.clone()) {
        for c in status.into_iter().filter(|c| c.status == "untracked") {
            let full = std::path::Path::new(&cwd).join(&c.path);
            if let Ok(content) = std::fs::read_to_string(&full) {
                scan(&c.path, &content);
            }
        }
    }
    Ok(findings)
}

/// Generate a commit message from the pending diff using the `claude` CLI
/// (headless `-p`), so it runs on the user's subscription — no extra API cost.
#[tauri::command]
pub async fn generate_commit_message(app: tauri::AppHandle, cwd: String) -> Result<String, String> {
    use tokio::io::AsyncWriteExt;
    use tokio::process::Command as TokioCommand;

    let diff = git(&cwd, &["diff", "HEAD"])?;
    if diff.trim().is_empty() {
        return Err("No changes to describe. Stage or make edits first.".into());
    }
    let diff: String = diff.chars().take(8000).collect();
    let claude = crate::claude_binary::find_claude_binary(&app)?;
    let instruction =
        "Write a concise conventional git commit message for the diff provided on standard input. Reply with only the commit message, no preamble or backticks.";

    let lower = claude.to_lowercase();
    let mut cmd = if cfg!(windows) && (lower.ends_with(".cmd") || lower.ends_with(".bat")) {
        let mut c = TokioCommand::new("cmd");
        c.arg("/c").arg(&claude);
        c
    } else {
        TokioCommand::new(&claude)
    };
    cmd.arg("-p").arg(instruction);
    cmd.current_dir(&cwd);
    for (key, value) in crate::provider::current_env() {
        cmd.env(key, value);
    }
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000);
    cmd.stdin(std::process::Stdio::piped());
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to run claude: {e}"))?;
    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(diff.as_bytes()).await;
        drop(stdin);
    }
    let out = child
        .wait_with_output()
        .await
        .map_err(|e| format!("claude failed: {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::parse_worktrees;

    #[test]
    fn parses_worktree_porcelain() {
        let out = "worktree C:/repo\nHEAD abc123\nbranch refs/heads/main\n\nworktree C:/wt/agent-x\nHEAD abc123\nbranch refs/heads/agent-x\n";
        let list = parse_worktrees(out);
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].branch, "main");
        assert_eq!(list[1].path, "C:/wt/agent-x");
        assert_eq!(list[1].branch, "agent-x");
    }
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
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000);
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
