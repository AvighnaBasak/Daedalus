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
fn price_for(model: &str) -> (f64, f64, f64, f64) {
    let m = model.to_lowercase();
    let per_m = |a: f64| a / 1_000_000.0;
    if m.contains("opus") {
        (per_m(15.0), per_m(75.0), per_m(18.75), per_m(1.50))
    } else if m.contains("haiku") {
        (per_m(0.80), per_m(4.0), per_m(1.0), per_m(0.08))
    } else {
        // sonnet / default
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
