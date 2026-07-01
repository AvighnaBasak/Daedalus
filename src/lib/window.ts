import { isTauri } from "./tauri";

async function win() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export async function minimizeWindow() {
  if (!isTauri()) return;
  (await win()).minimize();
}

export async function toggleMaximizeWindow() {
  if (!isTauri()) return;
  (await win()).toggleMaximize();
}

export async function closeWindow() {
  if (!isTauri()) return;
  (await win()).close();
}
