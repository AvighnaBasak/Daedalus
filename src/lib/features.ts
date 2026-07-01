import { invoke } from "./tauri";

export interface ProjectCost {
  project: string;
  cost_usd: number;
  total_tokens: number;
  sessions: number;
  last_active_ms: number;
}

// v4 — token efficiency
export const getCostHistory = () => invoke<ProjectCost[]>("get_cost_history");
export const getLeanContext = (cwd: string) => invoke<boolean>("get_lean_context", { cwd });
export const setLeanContext = (cwd: string, enable: boolean) =>
  invoke<void>("set_lean_context", { cwd, enable });

// v5 — preview power
export const startTunnel = (port: number) => invoke<string>("start_tunnel", { port });
export const stopTunnel = () => invoke<void>("stop_tunnel");
export const watchDir = (path: string) => invoke<void>("watch_dir", { path });
export const unwatchDir = () => invoke<void>("unwatch_dir");
