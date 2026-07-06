//! Auto-installed "daedalus" skill — the piece that teaches Claude Code how to use
//! the house it lives in. Written to `~/.claude/skills/daedalus/SKILL.md` (the
//! user-level skill directory), so the skill's description is ambiently visible to
//! every Claude session; the body documents the bridge API (see `crate::bridge`)
//! and Daedalus house rules.
//!
//! Managed-file semantics: we only ever overwrite a file that carries our marker.
//! A user-edited skill (marker removed) is left alone forever.

use std::fs;
use std::path::PathBuf;

/// Bump when the skill content changes — older managed copies get upgraded in place.
const SKILL_VERSION: u32 = 1;

fn marker(version: u32) -> String {
    format!("<!-- daedalus:managed v{version} -->")
}

fn skill_body() -> String {
    format!(
        r#"---
name: daedalus
description: Drive the Daedalus desktop app this session runs inside (only when the DAEDALUS env var is set) - open a live browser preview beside the terminal, open files in the built-in editor, notify the user, pop the terminal panel. Use whenever you start a dev/web server, want to show a URL or file, or finish something the user should look at.
---

{marker}

# Driving Daedalus

You are running inside **Daedalus**, a desktop cockpit that wraps this Claude Code
session in a full IDE: Monaco file editor, git diff/history panel, live browser
preview, extra shell terminals, an MCP hub, and a cost HUD.

A local HTTP bridge controls the app. Its base URL is in the `DAEDALUS_BRIDGE`
env var (e.g. `http://127.0.0.1:49321`). Call it with curl from Bash — in
PowerShell use `$env:DAEDALUS_BRIDGE` instead of `$DAEDALUS_BRIDGE`.

## Endpoints

Show a URL in the built-in preview panel (do this whenever you start a web server):

    curl -s -X POST "$DAEDALUS_BRIDGE/preview" -d "http://localhost:3000"

Open a file in the built-in editor (absolute, or relative to the project):

    curl -s -X POST "$DAEDALUS_BRIDGE/open" -d "src/App.tsx"

Show a toast notification to the user (e.g. when a long task finishes):

    curl -s -X POST "$DAEDALUS_BRIDGE/notify" -d "Build finished - 0 errors"

Open the app's shell terminal panel:

    curl -s -X POST "$DAEDALUS_BRIDGE/terminal" -d ""

## House rules (save the user time and tokens)

- After starting a dev server, POST its URL to `/preview` instead of telling the
  user to open a browser. Daedalus also auto-detects localhost URLs printed in
  this terminal, so clearly printing the URL works as a fallback.
- The user has their own shell terminals inside Daedalus (Ctrl+`). They can start,
  stop, and inspect long-running processes themselves — suggest that instead of
  spending turns babysitting servers, and don't hunt PIDs to kill a server the
  user can stop with Ctrl+C in their panel.
- Start long-running servers in the background (or ask the user to run them in
  the Daedalus terminal panel) so this session doesn't block.
- File paths pasted or dropped into this terminal are real local files (images
  included) — read them directly instead of asking for the content.
- The user reviews your edits in a side-by-side diff panel; reference exact file
  paths so they can jump there.
"#,
        marker = marker(SKILL_VERSION)
    )
}

fn skill_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude").join("skills").join("daedalus").join("SKILL.md"))
}

/// Decide what to do with an existing file's content.
fn should_write(existing: Option<&str>) -> bool {
    match existing {
        None => true,
        Some(content) => {
            if content.contains(&marker(SKILL_VERSION)) {
                false // current version already installed
            } else {
                // Upgrade only files we own; never clobber a user-authored skill.
                content.contains("<!-- daedalus:managed")
            }
        }
    }
}

/// Install or upgrade the skill. Best-effort — failures are logged, never fatal.
pub fn install() -> Result<bool, String> {
    let path = skill_path().ok_or("no home directory")?;
    let existing = fs::read_to_string(&path).ok();
    if !should_write(existing.as_deref()) {
        return Ok(false);
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, skill_body()).map_err(|e| e.to_string())?;
    Ok(true)
}

/// Frontend-triggered (re)install from Settings; returns true if written.
#[tauri::command]
pub fn install_skill() -> Result<bool, String> {
    install()
}

/// Whether the managed skill is present (any version).
#[tauri::command]
pub fn skill_installed() -> bool {
    skill_path()
        .and_then(|p| fs::read_to_string(p).ok())
        .map(|c| c.contains("<!-- daedalus:managed"))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_when_missing_or_stale() {
        assert!(should_write(None));
        assert!(should_write(Some("<!-- daedalus:managed v0 --> old")));
        assert!(!should_write(Some(&skill_body())));
    }

    #[test]
    fn never_clobbers_user_file() {
        assert!(!should_write(Some("---\nname: daedalus\n---\nmy own notes")));
    }

    #[test]
    fn body_has_frontmatter_and_endpoints() {
        let b = skill_body();
        assert!(b.starts_with("---\nname: daedalus\n"));
        for ep in ["/preview", "/open", "/notify", "/terminal"] {
            assert!(b.contains(ep), "missing endpoint {ep}");
        }
    }
}
