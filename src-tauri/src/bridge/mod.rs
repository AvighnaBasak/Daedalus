//! Daedalus bridge — a tiny localhost HTTP server that lets the *Claude CLI running
//! inside the pty* drive the app around it: open the browser preview, open files in
//! the editor, raise a toast, or pop the terminal panel. The port is random per run
//! and is handed to every pty via the `DAEDALUS_BRIDGE` env var; a user-level skill
//! (see `crate::skill`) teaches Claude the endpoints.
//!
//! Hand-rolled on std's TcpListener (no extra deps): it only ever serves plain-text
//! POSTs from local processes, so a full HTTP stack would be dead weight.

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

/// Managed state: the port the bridge bound to (0 = failed to start).
pub struct BridgeState {
    pub port: u16,
}

/// Start the bridge on an ephemeral 127.0.0.1 port. Returns the port (0 on failure —
/// the app still works, Claude just can't drive it).
pub fn start(app: AppHandle) -> u16 {
    let listener = match TcpListener::bind(("127.0.0.1", 0)) {
        Ok(l) => l,
        Err(e) => {
            log::warn!("bridge: failed to bind: {e}");
            return 0;
        }
    };
    let port = listener.local_addr().map(|a| a.port()).unwrap_or(0);
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            match stream {
                Ok(s) => {
                    let app = app.clone();
                    // One thread per request: traffic is a handful of curls per session.
                    std::thread::spawn(move || handle(s, &app));
                }
                Err(_) => continue,
            }
        }
    });
    log::info!("bridge: listening on 127.0.0.1:{port}");
    port
}

fn handle(stream: TcpStream, app: &AppHandle) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));
    let mut reader = BufReader::new(stream);

    let mut request_line = String::new();
    if reader.read_line(&mut request_line).is_err() {
        return;
    }
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("").to_uppercase();
    let path = parts.next().unwrap_or("").to_string();

    // Headers — we only care about content-length.
    let mut content_length: usize = 0;
    loop {
        let mut line = String::new();
        match reader.read_line(&mut line) {
            Ok(0) => break,
            Ok(_) => {
                let l = line.trim();
                if l.is_empty() {
                    break;
                }
                if let Some(v) = l.to_ascii_lowercase().strip_prefix("content-length:") {
                    content_length = v.trim().parse().unwrap_or(0);
                }
            }
            Err(_) => return,
        }
    }
    // Bodies are single URLs / paths / short messages — cap hard.
    content_length = content_length.min(64 * 1024);
    let mut body = vec![0u8; content_length];
    if content_length > 0 && reader.read_exact(&mut body).is_err() {
        return;
    }
    let body = String::from_utf8_lossy(&body).trim().to_string();

    let (status, reply) = route(app, &method, &path, &body);
    let mut stream = reader.into_inner();
    let _ = write!(
        stream,
        "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{reply}",
        reply.len()
    );
}

fn route(app: &AppHandle, method: &str, path: &str, body: &str) -> (&'static str, String) {
    let ok = ("200 OK", r#"{"ok":true}"#.to_string());
    match (method, path) {
        ("GET", "/status") => (
            "200 OK",
            format!(
                r#"{{"app":"daedalus","version":"{}"}}"#,
                env!("CARGO_PKG_VERSION")
            ),
        ),
        ("POST", "/preview") => {
            if body.starts_with("http://") || body.starts_with("https://") {
                let _ = app.emit("bridge:preview", body.to_string());
                ok
            } else {
                ("400 Bad Request", r#"{"ok":false,"error":"body must be an http(s) URL"}"#.into())
            }
        }
        ("POST", "/open") => {
            if body.is_empty() {
                ("400 Bad Request", r#"{"ok":false,"error":"body must be a file path"}"#.into())
            } else {
                let _ = app.emit("bridge:open", body.to_string());
                ok
            }
        }
        ("POST", "/notify") => {
            let _ = app.emit("bridge:notify", body.to_string());
            ok
        }
        ("POST", "/terminal") => {
            let _ = app.emit("bridge:terminal", ());
            ok
        }
        _ => ("404 Not Found", r#"{"ok":false,"error":"unknown endpoint"}"#.into()),
    }
}

#[tauri::command]
pub fn bridge_port(state: State<'_, BridgeState>) -> u16 {
    state.port
}

// ---------------------------------------------------------------------------
// Preview reachability probe
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct ProbeResult {
    pub reachable: bool,
    /// The site refuses to be embedded (X-Frame-Options / CSP frame-ancestors).
    pub frame_blocked: bool,
    pub status: u16,
}

/// True when response headers forbid framing from a cross-origin embedder
/// (the app's origin is tauri.localhost, so any XFO value blocks us).
fn headers_block_framing(xfo: Option<&str>, csp: Option<&str>) -> bool {
    if let Some(v) = xfo {
        let v = v.trim();
        if !v.is_empty() {
            return true;
        }
    }
    if let Some(csp) = csp {
        let lower = csp.to_ascii_lowercase();
        if let Some(idx) = lower.find("frame-ancestors") {
            let clause = &lower[idx..];
            let clause = clause.split(';').next().unwrap_or("");
            // `frame-ancestors *` is the only value that still lets us in.
            return !clause.contains('*');
        }
    }
    false
}

/// Check whether `url` is up before mounting the preview iframe, so a dev server
/// that isn't listening yet shows a calm "waiting…" state instead of the WebView2
/// error page, and sites that refuse framing get an honest explanation.
#[tauri::command]
pub async fn preview_probe(url: String) -> Result<ProbeResult, String> {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("not an http(s) URL".into());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(2500))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| e.to_string())?;
    match client.get(&url).send().await {
        Ok(resp) => {
            let xfo = resp
                .headers()
                .get("x-frame-options")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string());
            let csp = resp
                .headers()
                .get("content-security-policy")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string());
            Ok(ProbeResult {
                reachable: true,
                frame_blocked: headers_block_framing(xfo.as_deref(), csp.as_deref()),
                status: resp.status().as_u16(),
            })
        }
        Err(_) => Ok(ProbeResult {
            reachable: false,
            frame_blocked: false,
            status: 0,
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn xfo_blocks() {
        assert!(headers_block_framing(Some("DENY"), None));
        assert!(headers_block_framing(Some("SAMEORIGIN"), None));
        assert!(!headers_block_framing(None, None));
        assert!(!headers_block_framing(Some("  "), None));
    }

    #[test]
    fn csp_frame_ancestors() {
        assert!(headers_block_framing(None, Some("frame-ancestors 'self'")));
        assert!(headers_block_framing(None, Some("default-src 'self'; frame-ancestors 'none'")));
        assert!(!headers_block_framing(None, Some("frame-ancestors *")));
        assert!(!headers_block_framing(None, Some("default-src 'self'")));
    }
}
