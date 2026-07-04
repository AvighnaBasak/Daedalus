//! Live token/cost stats for the active session, derived from Claude Code's own
//! transcripts under `~/.claude/projects/<encoded-cwd>/<session>.jsonl`.
//!
//! Each assistant turn carries a `message.usage` block (input / output / cache
//! tokens) and `message.model`. We sum cost across the newest transcript and use
//! the last turn's totals to approximate current context-window fill.

use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;

#[derive(Serialize)]
pub struct LiveUsage {
    pub used_tokens: u64,
    pub max_tokens: u64,
    pub cost_usd: f64,
    pub model: String,
}

/// Claude encodes a project path into a directory name by replacing every
/// non-alphanumeric character with `-` (e.g. `C:\_C_\Users\x` → `C---C--Users-x`).
fn encode_cwd(cwd: &str) -> String {
    cwd.chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect()
}

/// Per-token USD rates: (input, output, cache_write, cache_read).
/// Non-Anthropic models (Ollama / custom providers) are priced at $0 — local is
/// free, and third-party API pricing isn't ours to guess.
fn price_for(model: &str) -> (f64, f64, f64, f64) {
    let m = model.to_lowercase();
    if !m.contains("claude") {
        return (0.0, 0.0, 0.0, 0.0);
    }
    let per_m = |a: f64| a / 1_000_000.0;
    if m.contains("opus") {
        (per_m(15.0), per_m(75.0), per_m(18.75), per_m(1.50))
    } else if m.contains("haiku") {
        (per_m(0.80), per_m(4.0), per_m(1.0), per_m(0.08))
    } else {
        // sonnet / other claude models
        (per_m(3.0), per_m(15.0), per_m(3.75), per_m(0.30))
    }
}

fn newest_transcript(dir: &PathBuf) -> Option<PathBuf> {
    let mut newest: Option<(SystemTime, PathBuf)> = None;
    for entry in fs::read_dir(dir).ok()?.flatten() {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("jsonl") {
            continue;
        }
        if let Ok(modified) = entry.metadata().and_then(|m| m.modified()) {
            if newest.as_ref().map_or(true, |(t, _)| modified > *t) {
                newest = Some((modified, path));
            }
        }
    }
    newest.map(|(_, p)| p)
}

#[tauri::command]
pub fn get_live_session_usage(cwd: String) -> Result<LiveUsage, String> {
    let empty = LiveUsage {
        used_tokens: 0,
        max_tokens: 200_000,
        cost_usd: 0.0,
        model: "—".into(),
    };

    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return Ok(empty),
    };
    let dir = home
        .join(".claude")
        .join("projects")
        .join(encode_cwd(&cwd));

    let path = match newest_transcript(&dir) {
        Some(p) => p,
        None => return Ok(empty),
    };

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut cost = 0.0f64;
    let mut context = 0u64;
    let mut model = String::from("—");

    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let value: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let message = &value["message"];
        let usage = &message["usage"];
        if !usage.is_object() {
            continue;
        }
        if let Some(m) = message["model"].as_str() {
            model = m.to_string();
        }
        let input = usage["input_tokens"].as_u64().unwrap_or(0);
        let output = usage["output_tokens"].as_u64().unwrap_or(0);
        let cache_write = usage["cache_creation_input_tokens"].as_u64().unwrap_or(0);
        let cache_read = usage["cache_read_input_tokens"].as_u64().unwrap_or(0);

        let (ip, op, cwp, crp) = price_for(&model);
        cost += input as f64 * ip
            + output as f64 * op
            + cache_write as f64 * cwp
            + cache_read as f64 * crp;

        // Last turn's full input side + output ≈ current context-window fill.
        context = input + cache_write + cache_read + output;
    }

    Ok(LiveUsage {
        used_tokens: context,
        max_tokens: 200_000,
        cost_usd: cost,
        model,
    })
}

#[derive(Serialize)]
pub struct ProjectCost {
    pub project: String,
    pub cost_usd: f64,
    pub total_tokens: u64,
    pub sessions: u32,
    pub last_active_ms: u64,
}

/// Sum cost + tokens across every turn in one transcript, and capture its cwd.
fn accumulate_file(path: &std::path::Path) -> (f64, u64, Option<String>) {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return (0.0, 0, None),
    };
    let mut cost = 0.0f64;
    let mut tokens = 0u64;
    let mut cwd: Option<String> = None;
    let mut model = String::from("sonnet");
    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let v: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        if cwd.is_none() {
            if let Some(c) = v["cwd"].as_str() {
                cwd = Some(c.to_string());
            }
        }
        let usage = &v["message"]["usage"];
        if !usage.is_object() {
            continue;
        }
        if let Some(m) = v["message"]["model"].as_str() {
            model = m.to_string();
        }
        let input = usage["input_tokens"].as_u64().unwrap_or(0);
        let output = usage["output_tokens"].as_u64().unwrap_or(0);
        let cw = usage["cache_creation_input_tokens"].as_u64().unwrap_or(0);
        let cr = usage["cache_read_input_tokens"].as_u64().unwrap_or(0);
        let (ip, op, cwp, crp) = price_for(&model);
        cost += input as f64 * ip + output as f64 * op + cw as f64 * cwp + cr as f64 * crp;
        tokens += input + output + cw + cr;
    }
    (cost, tokens, cwd)
}

/// Whether Claude Code has prior transcripts for this project — used to offer
/// "resume last conversation" (`claude --continue`) when opening a folder.
#[tauri::command]
pub fn has_claude_history(cwd: String) -> bool {
    let Some(home) = dirs::home_dir() else {
        return false;
    };
    let dir = home.join(".claude").join("projects").join(encode_cwd(&cwd));
    fs::read_dir(&dir)
        .map(|entries| {
            entries
                .flatten()
                .any(|e| e.path().extension().map(|x| x == "jsonl").unwrap_or(false))
        })
        .unwrap_or(false)
}

/// Aggregate token/cost usage per project across all of `~/.claude/projects`.
#[tauri::command]
pub fn get_cost_history() -> Result<Vec<ProjectCost>, String> {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return Ok(vec![]),
    };
    let root = home.join(".claude").join("projects");
    let mut out = Vec::new();
    let entries = match fs::read_dir(&root) {
        Ok(e) => e,
        Err(_) => return Ok(vec![]),
    };
    for project_dir in entries.flatten() {
        if !project_dir.path().is_dir() {
            continue;
        }
        let mut cost = 0.0f64;
        let mut tokens = 0u64;
        let mut sessions = 0u32;
        let mut name: Option<String> = None;
        let mut last_active_ms = 0u64;
        if let Ok(files) = fs::read_dir(project_dir.path()) {
            for file in files.flatten() {
                let p = file.path();
                if p.extension().and_then(|s| s.to_str()) != Some("jsonl") {
                    continue;
                }
                sessions += 1;
                let (c, t, cwd) = accumulate_file(&p);
                cost += c;
                tokens += t;
                if name.is_none() {
                    name = cwd;
                }
                if let Ok(m) = file.metadata().and_then(|m| m.modified()) {
                    if let Ok(d) = m.duration_since(SystemTime::UNIX_EPOCH) {
                        last_active_ms = last_active_ms.max(d.as_millis() as u64);
                    }
                }
            }
        }
        if sessions == 0 {
            continue;
        }
        out.push(ProjectCost {
            project: name.unwrap_or_else(|| {
                project_dir.file_name().to_string_lossy().to_string()
            }),
            cost_usd: cost,
            total_tokens: tokens,
            sessions,
            last_active_ms,
        });
    }
    out.sort_by(|a, b| b.cost_usd.partial_cmp(&a.cost_usd).unwrap_or(std::cmp::Ordering::Equal));
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_cwd_matches_claude_scheme() {
        assert_eq!(encode_cwd(r"C:\_C_\Users\daedalus"), "C---C--Users-daedalus");
        assert_eq!(encode_cwd("/home/user/my.app"), "-home-user-my-app");
    }

    #[test]
    fn anthropic_models_are_priced() {
        let (i, o, _, _) = price_for("claude-opus-4-8");
        assert!(i > 0.0 && o > 0.0);
        let (i, _, _, _) = price_for("claude-haiku-4-5-20251001");
        assert!(i > 0.0);
    }

    #[test]
    fn local_and_custom_models_are_free() {
        for m in ["qwen3-coder:30b", "glm-4.7", "deepseek-chat", "llama3.3"] {
            assert_eq!(price_for(m), (0.0, 0.0, 0.0, 0.0), "{m} should be free");
        }
    }
}
