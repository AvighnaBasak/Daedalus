//! Encrypted .env vault. Secrets are stored AES-256-GCM-encrypted in the
//! Daedalus data dir (key file lives beside it), so raw keys never sit in the
//! project tree or in Claude's context. "Write .env" materializes them into the
//! project only when the user asks.
//!
//! Honest threat model: this protects secrets at rest and against accidental
//! commits/sharing — not against an attacker with full access to this machine
//! (the key file is local).

use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{AeadCore, Aes256Gcm, Key, Nonce};
use base64::Engine;
use serde::Serialize;
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;

const B64: base64::engine::general_purpose::GeneralPurpose =
    base64::engine::general_purpose::STANDARD;

fn data_dir() -> Result<PathBuf, String> {
    let dir = dirs::data_local_dir()
        .ok_or("Could not resolve local data directory")?
        .join("Daedalus");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn cipher() -> Result<Aes256Gcm, String> {
    let key_path = data_dir()?.join("vault.key");
    let key_bytes: Vec<u8> = match fs::read(&key_path) {
        Ok(k) if k.len() == 32 => k,
        _ => {
            let key = Aes256Gcm::generate_key(&mut OsRng);
            fs::write(&key_path, key.as_slice()).map_err(|e| e.to_string())?;
            key.as_slice().to_vec()
        }
    };
    Ok(Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key_bytes)))
}

/// vault.json: { "<project cwd>": { "NAME": "b64(nonce || ciphertext)" } }
type Store = BTreeMap<String, BTreeMap<String, String>>;

fn load_store() -> Result<Store, String> {
    let path = data_dir()?.join("vault.json");
    match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| e.to_string()),
        Err(_) => Ok(Store::new()),
    }
}

fn save_store(store: &Store) -> Result<(), String> {
    let path = data_dir()?.join("vault.json");
    fs::write(path, serde_json::to_string_pretty(store).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

fn encrypt(value: &str) -> Result<String, String> {
    let cipher = cipher()?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ct = cipher
        .encrypt(&nonce, value.as_bytes())
        .map_err(|e| e.to_string())?;
    let mut blob = nonce.to_vec();
    blob.extend(ct);
    Ok(B64.encode(blob))
}

fn decrypt(blob_b64: &str) -> Result<String, String> {
    let blob = B64.decode(blob_b64).map_err(|e| e.to_string())?;
    if blob.len() < 13 {
        return Err("Corrupt vault entry".into());
    }
    let (nonce, ct) = blob.split_at(12);
    let cipher = cipher()?;
    let pt = cipher
        .decrypt(Nonce::from_slice(nonce), ct)
        .map_err(|_| "Could not decrypt (vault key changed?)".to_string())?;
    String::from_utf8(pt).map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct VaultEntry {
    pub name: String,
    pub value: String,
}

/// List decrypted secrets for a project (shown masked in the UI).
#[tauri::command]
pub fn vault_list(cwd: String) -> Result<Vec<VaultEntry>, String> {
    let store = load_store()?;
    let mut out = Vec::new();
    if let Some(project) = store.get(&cwd) {
        for (name, blob) in project {
            out.push(VaultEntry {
                name: name.clone(),
                value: decrypt(blob)?,
            });
        }
    }
    Ok(out)
}

#[tauri::command]
pub fn vault_set(cwd: String, name: String, value: String) -> Result<(), String> {
    let mut store = load_store()?;
    store
        .entry(cwd)
        .or_default()
        .insert(name, encrypt(&value)?);
    save_store(&store)
}

#[tauri::command]
pub fn vault_delete(cwd: String, name: String) -> Result<(), String> {
    let mut store = load_store()?;
    if let Some(project) = store.get_mut(&cwd) {
        project.remove(&name);
    }
    save_store(&store)
}

/// Materialize the project's secrets as a `.env` file, and make sure `.env`
/// is git-ignored so it can't be committed by accident.
#[tauri::command]
pub fn vault_write_env(cwd: String) -> Result<String, String> {
    let store = load_store()?;
    let project = store.get(&cwd).cloned().unwrap_or_default();
    if project.is_empty() {
        return Err("No secrets in the vault for this project yet.".into());
    }
    let mut env = String::new();
    for (name, blob) in &project {
        env.push_str(&format!("{}={}\n", name, decrypt(blob)?));
    }
    let env_path = std::path::Path::new(&cwd).join(".env");
    fs::write(&env_path, env).map_err(|e| e.to_string())?;

    // Ensure .gitignore covers .env
    let gi_path = std::path::Path::new(&cwd).join(".gitignore");
    let gi = fs::read_to_string(&gi_path).unwrap_or_default();
    if !gi.lines().any(|l| l.trim() == ".env" || l.trim() == "*.env") {
        let mut next = gi;
        if !next.is_empty() && !next.ends_with('\n') {
            next.push('\n');
        }
        next.push_str(".env\n");
        let _ = fs::write(&gi_path, next);
    }
    Ok(format!("Wrote {} secret(s) to .env (git-ignored).", project.len()))
}
