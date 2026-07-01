/** Right-side dock panels (open beside the always-mounted terminal). */
export type DockId = "editor" | "mcp" | "preview";
/** Full-screen config overlays (rendered over the terminal, which stays mounted). */
export type OverlayId = "settings" | "theme";

export interface Session {
  id: string;
  title: string;
  cwd: string;
  /** true when the CLI is awaiting a permission/plan decision */
  needsAttention?: boolean;
}
