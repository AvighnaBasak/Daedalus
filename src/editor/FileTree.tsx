import { useCallback, useEffect, useState } from "react";
import {
  ChevronRight,
  File as FileIcon,
  FileCode,
  FileJson,
  FileText,
  FileTerminal,
  Image as ImageIcon,
  Folder,
  FolderOpen,
  FilePlus,
  FolderPlus,
  RotateCw,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  listDir,
  createFile,
  createDir,
  renamePath,
  deletePath,
  type DirEntry,
} from "@/lib/files";
import { gitStatus, type FileChange } from "@/lib/git";
import { isTauri } from "@/lib/tauri";
import { cn } from "@/lib/cn";

/* ---------- file-type icon + color (VS Code-style) ---------- */

const EXT_COLOR: Record<string, string> = {
  ts: "#3178c6", tsx: "#3178c6", mts: "#3178c6", cts: "#3178c6",
  js: "#e8d44d", jsx: "#e8d44d", mjs: "#e8d44d", cjs: "#e8d44d",
  json: "#cbcb41", jsonc: "#cbcb41",
  html: "#e37933", htm: "#e37933", vue: "#41b883", svelte: "#ff3e00",
  css: "#42a5f5", scss: "#f06292", less: "#42a5f5",
  md: "#519aba", mdx: "#519aba", txt: "#8a8a8a",
  rs: "#ce422b", py: "#3572a5", go: "#00add8", java: "#b07219",
  c: "#659ad2", h: "#659ad2", cpp: "#659ad2", hpp: "#659ad2", cs: "#178600",
  rb: "#cc342d", php: "#7377ad", swift: "#f05138", kt: "#7f52ff",
  sh: "#89e051", bash: "#89e051", ps1: "#012456",
  yml: "#a074c4", yaml: "#a074c4", toml: "#9c8862", ini: "#8a8a8a",
  sql: "#dad8d8", graphql: "#e10098",
  png: "#a074c4", jpg: "#a074c4", jpeg: "#a074c4", gif: "#a074c4",
  svg: "#ffb13b", ico: "#a074c4", webp: "#a074c4",
  lock: "#8a8a8a", env: "#edd53e",
};

function extOf(name: string): string {
  const lower = name.toLowerCase();
  if (lower.startsWith(".env")) return "env";
  return lower.includes(".") ? lower.split(".").pop()! : "";
}

function FileGlyph({ name }: { name: string }) {
  const ext = extOf(name);
  const color = EXT_COLOR[ext] ?? "#8a8a8a";
  const props = { size: 13, className: "shrink-0", style: { color } };
  if (ext === "json" || ext === "jsonc") return <FileJson {...props} />;
  if (["md", "mdx", "txt"].includes(ext)) return <FileText {...props} />;
  if (["png", "jpg", "jpeg", "gif", "svg", "ico", "webp"].includes(ext)) return <ImageIcon {...props} />;
  if (["sh", "bash", "ps1"].includes(ext)) return <FileTerminal {...props} />;
  if (
    ["ts", "tsx", "js", "jsx", "mjs", "cjs", "html", "htm", "vue", "svelte", "css", "scss", "less",
     "rs", "py", "go", "java", "c", "h", "cpp", "hpp", "cs", "rb", "php", "swift", "kt", "sql", "graphql",
    ].includes(ext)
  )
    return <FileCode {...props} />;
  return <FileIcon {...props} />;
}

/* ---------- git decorations (VS Code-style U / M / A / D letters) ---------- */

const GIT_LETTER: Record<string, string> = {
  untracked: "U", added: "A", modified: "M", deleted: "D", renamed: "R",
};
const GIT_COLOR: Record<string, string> = {
  untracked: "#73c991", added: "#73c991", modified: "#e2c08d",
  deleted: "#f14c4c", renamed: "#569cd6",
};

const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

interface CtxMenu {
  x: number;
  y: number;
  entry: DirEntry | null; // null = tree background (root scope)
  confirmDelete?: boolean;
}

interface Editing {
  kind: "create-file" | "create-dir" | "rename";
  /** Directory the input lives in (create) or the entry being renamed. */
  dir: string;
  entry?: DirEntry;
}

export function FileTree({
  rootPath,
  activePath,
  onOpen,
  onDeleted,
}: {
  rootPath: string;
  activePath?: string;
  onOpen: (entry: DirEntry) => void;
  onDeleted?: (path: string) => void;
}) {
  const [roots, setRoots] = useState<DirEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [children, setChildren] = useState<Record<string, DirEntry[]>>({});
  const [gitMap, setGitMap] = useState<Record<string, string>>({});
  const [menu, setMenu] = useState<CtxMenu | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [opError, setOpError] = useState<string | null>(null);

  const sep = rootPath.includes("\\") ? "\\" : "/";

  const loadDir = useCallback(
    async (dirPath: string) => {
      try {
        const kids = await listDir(dirPath);
        if (norm(dirPath) === norm(rootPath)) setRoots(kids);
        else setChildren((prev) => ({ ...prev, [dirPath]: kids }));
      } catch {
        /* unreadable dir */
      }
    },
    [rootPath],
  );

  const loadRoot = useCallback(() => {
    setError(null);
    listDir(rootPath)
      .then(setRoots)
      .catch((e) => setError(String(e)));
  }, [rootPath]);

  // Live git status → U/M/A/D decorations, refreshed on a light poll.
  const refreshGit = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const changes: FileChange[] = await gitStatus(rootPath);
      const map: Record<string, string> = {};
      const rootN = norm(rootPath);
      for (const c of changes) {
        const full = `${rootN}/${norm(c.path)}`;
        map[full] = c.status;
        // Propagate a "contains changes" mark up the folder chain.
        let dir = full;
        while (dir.includes("/") && dir.length > rootN.length) {
          dir = dir.slice(0, dir.lastIndexOf("/"));
          if (dir.length <= rootN.length) break;
          if (!map[dir]) map[dir] = "dir-dirty";
        }
      }
      setGitMap(map);
    } catch {
      setGitMap({}); // not a git repo — no decorations
    }
  }, [rootPath]);

  useEffect(() => {
    loadRoot();
    setExpanded(new Set());
    setChildren({});
    void refreshGit();
    const t = setInterval(refreshGit, 5000);
    return () => clearInterval(t);
  }, [loadRoot, refreshGit]);

  // Close the context menu on any outside click / Escape.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const toggle = useCallback(
    async (entry: DirEntry) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(entry.path)) next.delete(entry.path);
        else next.add(entry.path);
        return next;
      });
      if (!children[entry.path]) await loadDir(entry.path);
    },
    [children, loadDir],
  );

  /* ---------- file operations ---------- */

  const startCreate = (kind: "create-file" | "create-dir", scope: DirEntry | null) => {
    const dir = scope
      ? scope.is_dir
        ? scope.path
        : scope.path.slice(0, scope.path.lastIndexOf(sep))
      : rootPath;
    if (norm(dir) !== norm(rootPath) && !expanded.has(dir)) {
      setExpanded((prev) => new Set(prev).add(dir));
      void loadDir(dir);
    }
    setOpError(null);
    setEditing({ kind, dir });
    setMenu(null);
  };

  const submitEdit = async (name: string) => {
    if (!editing || !name.trim()) {
      setEditing(null);
      return;
    }
    const clean = name.trim();
    setOpError(null);
    try {
      if (editing.kind === "rename" && editing.entry) {
        const parent = editing.entry.path.slice(0, editing.entry.path.lastIndexOf(sep));
        await renamePath(editing.entry.path, `${parent}${sep}${clean}`);
        await loadDir(parent === "" ? rootPath : parent);
        if (norm(parent) === norm(rootPath)) loadRoot();
      } else {
        const target = `${editing.dir}${sep}${clean}`;
        if (editing.kind === "create-file") await createFile(target);
        else await createDir(target);
        await loadDir(editing.dir);
      }
      void refreshGit();
      setEditing(null);
    } catch (e) {
      setOpError(String(e));
    }
  };

  const doDelete = async (entry: DirEntry) => {
    setMenu(null);
    setOpError(null);
    try {
      await deletePath(entry.path);
      const parent = entry.path.slice(0, entry.path.lastIndexOf(sep));
      await loadDir(parent);
      if (norm(parent) === norm(rootPath)) loadRoot();
      onDeleted?.(entry.path);
      void refreshGit();
    } catch (e) {
      setOpError(String(e));
    }
  };

  /* ---------- rendering ---------- */

  const renderInput = (depth: number, isDir: boolean) => (
    <div className="flex items-center gap-1.5 py-[2px] pr-2" style={{ paddingLeft: `${8 + depth * 12 + 16}px` }}>
      {isDir ? (
        <Folder size={13} className="shrink-0" style={{ color: "#c09553" }} />
      ) : (
        <FileIcon size={13} className="shrink-0 text-text-muted" />
      )}
      <input
        autoFocus
        spellCheck={false}
        defaultValue={editing?.kind === "rename" ? editing.entry?.name : ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submitEdit(e.currentTarget.value);
          if (e.key === "Escape") setEditing(null);
        }}
        onBlur={(e) => void submitEdit(e.currentTarget.value)}
        className="min-w-0 flex-1 rounded-[2px] border border-accent bg-bg px-1 py-px text-[12px] text-text outline-none"
      />
    </div>
  );

  const renderNodes = (entries: DirEntry[], depth: number) =>
    entries.map((entry) => {
      const isRenaming = editing?.kind === "rename" && editing.entry?.path === entry.path;
      const git = gitMap[norm(entry.path)];
      return (
        <div key={entry.path}>
          {isRenaming ? (
            renderInput(depth - 1 >= 0 ? depth : 0, entry.is_dir)
          ) : (
            <Row
              entry={entry}
              depth={depth}
              expanded={expanded.has(entry.path)}
              active={entry.path === activePath}
              git={git}
              onClick={() => (entry.is_dir ? toggle(entry) : onOpen(entry))}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenu({ x: e.clientX, y: e.clientY, entry });
              }}
            />
          )}
          {entry.is_dir && expanded.has(entry.path) && (
            <div>
              {editing && editing.kind !== "rename" && norm(editing.dir) === norm(entry.path) &&
                renderInput(depth + 1, editing.kind === "create-dir")}
              {children[entry.path] && renderNodes(children[entry.path], depth + 1)}
            </div>
          )}
        </div>
      );
    });

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-2">
        <span className="mono-label truncate">Files</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => startCreate("create-file", null)}
            className="text-text-disabled hover:text-text"
            title="New file"
            aria-label="New file"
          >
            <FilePlus size={12} />
          </button>
          <button
            onClick={() => startCreate("create-dir", null)}
            className="text-text-disabled hover:text-text"
            title="New folder"
            aria-label="New folder"
          >
            <FolderPlus size={12} />
          </button>
          <button
            onClick={() => {
              loadRoot();
              void refreshGit();
              // Re-list every expanded dir so the whole visible tree is fresh.
              expanded.forEach((dir) => void loadDir(dir));
            }}
            className="text-text-disabled hover:text-text"
            title="Refresh"
            aria-label="Refresh files"
          >
            <RotateCw size={12} />
          </button>
        </div>
      </div>
      {opError && (
        <p className="border-b border-border bg-accent-dim px-2 py-1 text-[10px] text-accent-hover">{opError}</p>
      )}
      <div
        className="min-h-0 flex-1 overflow-auto py-1"
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY, entry: null });
        }}
      >
        {editing && editing.kind !== "rename" && norm(editing.dir) === norm(rootPath) &&
          renderInput(0, editing.kind === "create-dir")}
        {error ? <p className="px-3 py-2 text-[11px] text-text-muted">{error}</p> : renderNodes(roots, 0)}
      </div>

      {menu && (
        <div
          className="elev-2 fixed z-[100] w-44 rounded-[var(--r-2)] border border-border-strong bg-overlay py-1"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem icon={<FilePlus size={12} />} onClick={() => startCreate("create-file", menu.entry)}>
            New file
          </MenuItem>
          <MenuItem icon={<FolderPlus size={12} />} onClick={() => startCreate("create-dir", menu.entry)}>
            New folder
          </MenuItem>
          {menu.entry && (
            <>
              <div className="mx-2 my-1 h-px bg-border" />
              <MenuItem
                icon={<Pencil size={12} />}
                onClick={() => {
                  setOpError(null);
                  setEditing({ kind: "rename", dir: menu.entry!.path, entry: menu.entry! });
                  setMenu(null);
                }}
              >
                Rename
              </MenuItem>
              {menu.confirmDelete ? (
                <MenuItem icon={<Trash2 size={12} />} danger onClick={() => void doDelete(menu.entry!)}>
                  Confirm delete?
                </MenuItem>
              ) : (
                <MenuItem
                  icon={<Trash2 size={12} />}
                  onClick={() => setMenu({ ...menu, confirmDelete: true })}
                >
                  Delete
                </MenuItem>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children,
  icon,
  danger,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] transition-colors",
        danger ? "text-accent hover:bg-accent hover:text-white" : "text-text-secondary hover:bg-surface-raised hover:text-text",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function Row({
  entry,
  depth,
  expanded,
  active,
  git,
  onClick,
  onContextMenu,
}: {
  entry: DirEntry;
  depth: number;
  expanded: boolean;
  active: boolean;
  git?: string;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const fileGit = git && git !== "dir-dirty" ? git : undefined;
  const nameColor = fileGit ? GIT_COLOR[fileGit] : undefined;
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={cn(
        "flex w-full items-center gap-1.5 py-[3px] pr-2 text-left text-[12px] transition-colors",
        active ? "bg-surface-raised text-text-emphasis" : "text-text-secondary hover:bg-overlay hover:text-text",
      )}
      style={{ paddingLeft: `${8 + depth * 12}px` }}
    >
      {entry.is_dir ? (
        <>
          <ChevronRight
            size={12}
            className={cn("shrink-0 text-text-muted transition-transform", expanded && "rotate-90")}
          />
          {expanded ? (
            <FolderOpen size={13} className="shrink-0" style={{ color: "#c09553" }} />
          ) : (
            <Folder size={13} className="shrink-0" style={{ color: "#c09553" }} />
          )}
        </>
      ) : (
        <>
          <span className="w-3 shrink-0" />
          <FileGlyph name={entry.name} />
        </>
      )}
      <span
        className={cn("truncate", fileGit === "deleted" && "line-through opacity-70")}
        style={{ color: nameColor }}
      >
        {entry.name}
      </span>
      {fileGit ? (
        <span
          className="ml-auto shrink-0 pl-1 font-mono text-[10px] font-semibold"
          style={{ color: GIT_COLOR[fileGit] }}
        >
          {GIT_LETTER[fileGit]}
        </span>
      ) : git === "dir-dirty" ? (
        <span className="ml-auto shrink-0 pl-1 text-[10px]" style={{ color: "#e2c08d" }}>
          ●
        </span>
      ) : null}
    </button>
  );
}
