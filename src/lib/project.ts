import { isTauri } from "./tauri";

/** Open a native folder picker and return the chosen path, or null if cancelled. */
export async function pickProjectFolder(): Promise<string | null> {
  if (!isTauri()) {
    // Browser preview fallback.
    const p = window.prompt("Project folder path");
    return p && p.trim() ? p.trim() : null;
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({ directory: true, multiple: false, title: "Open project folder" });
  return typeof selected === "string" ? selected : null;
}

/** Last path segment, for a session title. */
export function basename(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? p;
}
