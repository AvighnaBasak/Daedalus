/**
 * Hand-off channel for "open this file in the editor" requests coming from
 * outside the editor (Claude's bridge, drag & drop). The editor panel is
 * lazy-loaded, so a plain window event fired while it is still mounting would
 * be lost — the pending path is kept here and consumed on mount.
 */

let pending: string | null = null;

/** Ask the editor to open a path (absolute, or relative to the project). */
export function requestOpenFile(path: string) {
  pending = path;
  window.dispatchEvent(new CustomEvent("daedalus:open-file", { detail: path }));
}

/** Editor-side: take the queued path (clears it). */
export function consumePendingOpenFile(): string | null {
  const p = pending;
  pending = null;
  return p;
}
