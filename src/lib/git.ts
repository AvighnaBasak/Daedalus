import { invoke } from "./tauri";

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
}

export const gitIsRepo = (path: string) => invoke<boolean>("git_is_repo", { path });
export const gitRepoRoot = (path: string) => invoke<string | null>("git_repo_root", { path });
export const gitCurrentBranch = (path: string) => invoke<string>("git_current_branch", { path });
export const gitCreateWorktree = (repo: string, branch: string) =>
  invoke<string>("git_create_worktree", { repo, branch });
export const gitListWorktrees = (repo: string) => invoke<WorktreeInfo[]>("git_list_worktrees", { repo });
export const gitRemoveWorktree = (repo: string, dir: string) =>
  invoke<void>("git_remove_worktree", { repo, dir });
export const gitCheckpoint = (cwd: string, label: string) =>
  invoke<string>("git_checkpoint", { cwd, label });
export const gitRewind = (cwd: string, sha: string) => invoke<string>("git_rewind", { cwd, sha });
export const runScaffold = (command: string, args: string[], cwd: string) =>
  invoke<string>("run_scaffold", { command, args, cwd });
