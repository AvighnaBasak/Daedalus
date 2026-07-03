//! Model-provider backend for the `claude` CLI. Daedalus always drives the real
//! Claude Code binary; what changes is where it sends requests:
//!
//! - `subscription` — Anthropic, via the user's normal Claude login (default).
//! - `ollama`       — a local Ollama server (v0.14+ speaks the Anthropic
//!                    Messages API natively): ANTHROPIC_BASE_URL + AUTH_TOKEN.
//! - `custom`       — any Anthropic-compatible endpoint (DeepSeek, GLM, Kimi,
//!                    LM Studio, OpenRouter gateways…) with the user's API key.
//!
//! The config is stored in the Daedalus data dir so the Rust side can inject
//! env vars everywhere the CLI is spawned (pty, sub-agents, commit messages).

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct ProviderConfig {
    /// "subscription" | "ollama" | "custom"
    #[serde(default = "default_kind")]
    pub kind: String,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub api_key: String,
    /// Default model (ANTHROPIC_MODEL) for non-subscription providers.
    #[serde(default)]
    pub model: String,
    /// Small/fast model (ANTHROPIC_SMALL_FAST_MODEL); falls back to `model`.
    #[serde(default)]
    pub small_model: String,
}

fn default_kind() -> String {
    "subscription".into()
}

fn config_path() -> Result<PathBuf, String> {
    let dir = dirs::data_local_dir()
        .ok_or("Could not resolve local data directory")?
        .join("Daedalus");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("provider.json"))
}

pub fn load() -> ProviderConfig {
    config_path()
        .ok()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| ProviderConfig {
            kind: default_kind(),
            ..Default::default()
        })
}

/// Env vars to inject wherever the `claude` CLI is spawned.
pub fn env_for(config: &ProviderConfig) -> Vec<(String, String)> {
    let mut env = Vec::new();
    match config.kind.as_str() {
        "ollama" => {
            let base = if config.base_url.trim().is_empty() {
                "http://localhost:11434".to_string()
            } else {
                config.base_url.trim().to_string()
            };
            let token = if config.api_key.trim().is_empty() {
                "ollama".to_string()
            } else {
                config.api_key.trim().to_string()
            };
            env.push(("ANTHROPIC_BASE_URL".into(), base));
            env.push(("ANTHROPIC_AUTH_TOKEN".into(), token));
        }
        "custom" => {
            if !config.base_url.trim().is_empty() {
                env.push(("ANTHROPIC_BASE_URL".into(), config.base_url.trim().into()));
            }
            if !config.api_key.trim().is_empty() {
                // Per OpenRouter's Claude Code guide: key goes in AUTH_TOKEN and
                // ANTHROPIC_API_KEY must be explicitly blank so a logged-in
                // Anthropic key can't clash with the custom endpoint.
                env.push(("ANTHROPIC_AUTH_TOKEN".into(), config.api_key.trim().into()));
                env.push(("ANTHROPIC_API_KEY".into(), String::new()));
            }
        }
        _ => return env, // subscription: leave the CLI's own auth untouched
    }
    if !config.model.trim().is_empty() {
        let model = config.model.trim().to_string();
        let small = if config.small_model.trim().is_empty() {
            model.clone()
        } else {
            config.small_model.trim().to_string()
        };
        env.push(("ANTHROPIC_MODEL".into(), model.clone()));
        env.push(("ANTHROPIC_SMALL_FAST_MODEL".into(), small.clone()));
        // Map the CLI's opus/sonnet/haiku aliases onto the provider's models so
        // `/model sonnet` and internal alias use keep working off-Anthropic.
        env.push(("ANTHROPIC_DEFAULT_OPUS_MODEL".into(), model.clone()));
        env.push(("ANTHROPIC_DEFAULT_SONNET_MODEL".into(), model));
        env.push(("ANTHROPIC_DEFAULT_HAIKU_MODEL".into(), small));
    }
    env
}

/// Convenience for spawn sites.
pub fn current_env() -> Vec<(String, String)> {
    env_for(&load())
}

#[derive(Serialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
}

/// Discover the models the configured backend actually serves, so the model
/// picker can offer live search instead of blind typing.
///
/// - Ollama:      GET {base}/api/tags (locally installed models)
/// - OpenRouter:  GET /api/v1/models, filtered to tool-capable models —
///                Claude Code needs tool use, so anything else is hidden.
/// - Other:       best-effort GET {base}/v1/models (Anthropic/OpenAI style).
#[tauri::command]
pub async fn list_provider_models(config: ProviderConfig) -> Result<Vec<ModelInfo>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    match config.kind.as_str() {
        "ollama" => {
            let base = if config.base_url.trim().is_empty() {
                "http://localhost:11434"
            } else {
                config.base_url.trim().trim_end_matches('/')
            };
            let v: serde_json::Value = client
                .get(format!("{base}/api/tags"))
                .send()
                .await
                .map_err(|_| "Couldn't reach Ollama — is `ollama serve` running?".to_string())?
                .json()
                .await
                .map_err(|e| e.to_string())?;
            let mut out: Vec<ModelInfo> = v["models"]
                .as_array()
                .unwrap_or(&vec![])
                .iter()
                .filter_map(|m| m["name"].as_str())
                .map(|n| ModelInfo { id: n.to_string(), name: n.to_string() })
                .collect();
            out.sort_by(|a, b| a.id.cmp(&b.id));
            Ok(out)
        }
        "custom" => {
            let base = config.base_url.trim().trim_end_matches('/').to_string();
            if base.contains("openrouter.ai") {
                let v: serde_json::Value = client
                    .get("https://openrouter.ai/api/v1/models")
                    .send()
                    .await
                    .map_err(|e| format!("Couldn't reach OpenRouter: {e}"))?
                    .json()
                    .await
                    .map_err(|e| e.to_string())?;
                let mut out: Vec<ModelInfo> = v["data"]
                    .as_array()
                    .unwrap_or(&vec![])
                    .iter()
                    .filter(|m| {
                        // Claude Code requires tool use; hide models without it.
                        m["supported_parameters"]
                            .as_array()
                            .map(|p| p.iter().any(|x| x.as_str() == Some("tools")))
                            .unwrap_or(false)
                    })
                    .filter_map(|m| {
                        let id = m["id"].as_str()?;
                        let name = m["name"].as_str().unwrap_or(id);
                        Some(ModelInfo { id: id.to_string(), name: name.to_string() })
                    })
                    .collect();
                out.sort_by(|a, b| a.id.cmp(&b.id));
                return Ok(out);
            }
            if base.is_empty() {
                return Ok(vec![]);
            }
            // Generic probe: Anthropic-/OpenAI-style model listing.
            let resp = client
                .get(format!("{base}/v1/models"))
                .header("x-api-key", config.api_key.trim())
                .header("authorization", format!("Bearer {}", config.api_key.trim()))
                .header("anthropic-version", "2023-06-01")
                .send()
                .await
                .map_err(|e| format!("Model listing not available: {e}"))?;
            let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            let mut out: Vec<ModelInfo> = v["data"]
                .as_array()
                .unwrap_or(&vec![])
                .iter()
                .filter_map(|m| {
                    let id = m["id"].as_str()?;
                    let name = m["display_name"].as_str().or(m["name"].as_str()).unwrap_or(id);
                    Some(ModelInfo { id: id.to_string(), name: name.to_string() })
                })
                .collect();
            out.sort_by(|a, b| a.id.cmp(&b.id));
            Ok(out)
        }
        _ => Ok(vec![]),
    }
}

#[tauri::command]
pub fn get_provider() -> ProviderConfig {
    load()
}

#[tauri::command]
pub fn set_provider(config: ProviderConfig) -> Result<(), String> {
    let path = config_path()?;
    fs::write(
        path,
        serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn subscription_injects_nothing() {
        let c = ProviderConfig { kind: "subscription".into(), ..Default::default() };
        assert!(env_for(&c).is_empty());
    }

    #[test]
    fn ollama_defaults() {
        let c = ProviderConfig { kind: "ollama".into(), model: "qwen3-coder".into(), ..Default::default() };
        let env = env_for(&c);
        assert!(env.contains(&("ANTHROPIC_BASE_URL".into(), "http://localhost:11434".into())));
        assert!(env.contains(&("ANTHROPIC_AUTH_TOKEN".into(), "ollama".into())));
        assert!(env.contains(&("ANTHROPIC_MODEL".into(), "qwen3-coder".into())));
        assert!(env.contains(&("ANTHROPIC_SMALL_FAST_MODEL".into(), "qwen3-coder".into())));
    }

    #[test]
    fn custom_uses_auth_token_and_blanks_api_key() {
        let c = ProviderConfig {
            kind: "custom".into(),
            base_url: "https://openrouter.ai/api".into(),
            api_key: "sk-or-test".into(),
            model: "qwen/qwen3-coder".into(),
            small_model: String::new(),
        };
        let env = env_for(&c);
        assert!(env.contains(&("ANTHROPIC_AUTH_TOKEN".into(), "sk-or-test".into())));
        // Must be explicitly blank, not the key (OpenRouter requirement).
        assert!(env.contains(&("ANTHROPIC_API_KEY".into(), String::new())));
    }
}
