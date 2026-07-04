/** Right-side dock panels (open beside the always-mounted terminal). */
export type DockId = "editor" | "git" | "mcp" | "preview";
/** Full-screen config overlays (rendered over the terminal, which stays mounted). */
export type OverlayId =
  | "settings"
  | "theme"
  | "board"
  | "templates"
  | "cost"
  | "vault"
  | "subagents";

/** Live activity of a session's agent, inferred from its pty output. */
export type SessionStatus = "idle" | "working" | "attention";

export interface Worktree {
  repoPath: string;
  branch: string;
  path: string;
}

export interface Session {
  id: string;
  title: string;
  cwd: string;
  /** set when the session runs in an isolated git worktree */
  worktree?: Worktree;
  /** live activity, updated from terminal output */
  status?: SessionStatus;
  /** last time output was seen (ms epoch) */
  lastActivity?: number;
  /** backend this session's pty was spawned with (provider env is applied at spawn) */
  spawnedWith?: { kind: string; model: string; base_url: string };
  /** extra claude CLI flags at spawn, e.g. ["--continue"] to resume the last conversation */
  launchArgs?: string[];
}
