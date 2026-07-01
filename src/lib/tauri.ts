import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen, type EventCallback, type UnlistenFn } from "@tauri-apps/api/event";

/** True when running inside the Tauri webview (vs. a plain browser preview). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Invoke a Rust command. Outside Tauri (browser preview) this rejects with a
 * clear message instead of throwing an opaque ReferenceError.
 */
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error(`Not running in Daedalus — command "${cmd}" is unavailable in browser preview.`);
  }
  return tauriInvoke<T>(cmd, args);
}

/** Listen for a backend event; no-op unlisten outside Tauri. */
export async function listen<T>(event: string, handler: EventCallback<T>): Promise<UnlistenFn> {
  if (!isTauri()) {
    return async () => {};
  }
  return tauriListen<T>(event, handler);
}
