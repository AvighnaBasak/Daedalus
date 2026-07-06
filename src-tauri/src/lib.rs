// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

// Declare modules
pub mod bridge;
pub mod checkpoint;
pub mod claude_binary;
pub mod commands;
pub mod doctor;
pub mod files;
pub mod git;
pub mod live_usage;
pub mod process;
pub mod provider;
pub mod pty;
pub mod skill;
pub mod subagent;
pub mod tunnel;
pub mod vault;
pub mod watch;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
