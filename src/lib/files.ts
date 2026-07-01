import { invoke } from "./tauri";

export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

export function listDir(path: string): Promise<DirEntry[]> {
  return invoke<DirEntry[]>("list_dir", { path });
}

export function readTextFile(path: string): Promise<string> {
  return invoke<string>("read_text_file", { path });
}

export function writeTextFile(path: string, content: string): Promise<void> {
  return invoke<void>("write_text_file", { path, content });
}

const EXT_LANG: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  mjs: "javascript", cjs: "javascript", json: "json", md: "markdown",
  markdown: "markdown", css: "css", scss: "scss", less: "less", html: "html",
  htm: "html", xml: "xml", yaml: "yaml", yml: "yaml", toml: "ini", ini: "ini",
  rs: "rust", py: "python", go: "go", java: "java", c: "c", h: "c",
  cpp: "cpp", hpp: "cpp", cc: "cpp", cs: "csharp", rb: "ruby", php: "php",
  sh: "shell", bash: "shell", zsh: "shell", sql: "sql", swift: "swift",
  kt: "kotlin", dockerfile: "dockerfile", vue: "html", svelte: "html",
};

/** Best-effort Monaco language id from a filename. */
export function languageForFile(name: string): string {
  const lower = name.toLowerCase();
  if (lower === "dockerfile") return "dockerfile";
  const ext = lower.includes(".") ? lower.split(".").pop()! : "";
  return EXT_LANG[ext] ?? "plaintext";
}
