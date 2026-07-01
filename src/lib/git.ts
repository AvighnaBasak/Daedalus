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

export interface FileChange {
  path: string;
  status: string; // added | modified | deleted | renamed | untracked
}
export interface Commit {
  hash: string;
  short: string;
  parents: string[];
  refs: string;
  subject: string;
  author: string;
  date: string;
}
export interface SecretFinding {
  file: string;
  rule: string;
  preview: string;
}

export const gitStatus = (cwd: string) => invoke<FileChange[]>("git_status", { cwd });
export const gitShowHead = (cwd: string, path: string) =>
  invoke<string>("git_show_head", { cwd, path });
export const gitDiff = (cwd: string) => invoke<string>("git_diff", { cwd });
export const gitLog = (cwd: string, limit: number) => invoke<Commit[]>("git_log", { cwd, limit });
export const gitCommit = (cwd: string, message: string) =>
  invoke<string>("git_commit", { cwd, message });
export const scanSecrets = (cwd: string) => invoke<SecretFinding[]>("scan_secrets", { cwd });
export const generateCommitMessage = (cwd: string) =>
  invoke<string>("generate_commit_message", { cwd });

