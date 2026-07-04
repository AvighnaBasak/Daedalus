import { isTauri } from "./tauri";

async function win() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export async function minimizeWindow() {
  if (!isTauri()) return;
  try {
    await (await win()).minimize();
  } catch (e) {
    console.error("minimize failed:", e);
  }
}

export async function toggleMaximizeWindow() {
  if (!isTauri()) return;
  const w = await win();
  try {
    await w.toggleMaximize();
  } catch (e) {
    // Belt-and-braces: some environments (window-skinning tools) have flaked on
    // toggleMaximize — fall back to explicit maximize/unmaximize.
    console.error("toggleMaximize failed, falling back:", e);
    try {
      if (await w.isMaximized()) await w.unmaximize();
      else await w.maximize();
    } catch (e2) {
      console.error("maximize fallback failed:", e2);
    }
  }
}

export async function closeWindow() {
  if (!isTauri()) return;
  try {
    await (await win()).close();
  } catch (e) {
    console.error("close failed:", e);
  }
}

/** Programmatic drag — more reliable than data-tauri-drag-region when window
 * skinning tools (docks/themes) intercept hit-testing. */
export async function startDragging() {
  if (!isTauri()) return;
  try {
    await (await win()).startDragging();
  } catch (e) {
    console.error("startDragging failed:", e);
  }
}
