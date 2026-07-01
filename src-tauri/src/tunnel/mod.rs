//! Public tunnel for the device preview via ngrok (installed on this machine).
//! Spawns `ngrok http <port>` and reads the public URL from ngrok's local API.

use std::process::Child;
use std::sync::Mutex;

#[derive(Default)]
pub struct TunnelState {
    child: Mutex<Option<Child>>,
}

fn kill_existing(state: &TunnelState) {
    if let Ok(mut guard) = state.child.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
        }
    }
}

/// Start an ngrok tunnel to `port` and return the public HTTPS URL.
#[tauri::command]
pub async fn start_tunnel(
    state: tauri::State<'_, TunnelState>,
    port: u16,
) -> Result<String, String> {
    kill_existing(&state);

    let child = std::process::Command::new("ngrok")
        .args(["http", &port.to_string(), "--log=stdout"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|_| "ngrok isn't available. Install it and run `ngrok config add-authtoken <token>` once.".to_string())?;

    if let Ok(mut guard) = state.child.lock() {
        *guard = Some(child);
    }

    // Poll ngrok's local API for the assigned public URL.
    for _ in 0..20 {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        if let Ok(resp) = reqwest::get("http://127.0.0.1:4040/api/tunnels").await {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(tunnels) = json["tunnels"].as_array() {
                    if let Some(url) = tunnels
                        .iter()
                        .find_map(|t| t["public_url"].as_str().filter(|u| u.starts_with("https")))
                    {
                        return Ok(url.to_string());
                    }
                }
            }
        }
    }

    kill_existing(&state);
    Err("ngrok started but no tunnel came up — is your authtoken configured?".into())
}

/// Stop the running tunnel.
#[tauri::command]
pub fn stop_tunnel(state: tauri::State<'_, TunnelState>) -> Result<(), String> {
    kill_existing(&state);
    Ok(())
}
