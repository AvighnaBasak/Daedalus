import { useCallback, useEffect, useState } from "react";
import { FileCode, Loader2, Save, X } from "lucide-react";
import { FileTree } from "./FileTree";
import { MonacoPane } from "./MonacoPane";
import { readTextFile, writeTextFile, languageForFile, type DirEntry } from "@/lib/files";
import { cn } from "@/lib/cn";
import type { Session } from "@/lib/types";

interface OpenFile {
  path: string;
  name: string;
  language: string;
  value: string;
  dirty: boolean;
}

const norm = (p: string) => p.replace(/\\/g, "/").toLowerCase();

export function EditorPanel({ session }: { session: Session | null }) {
  const [files, setFiles] = useState<OpenFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = files.find((f) => f.path === activePath) ?? null;

  const openEntry = async (entry: DirEntry) => {
    const existing = files.find((f) => f.path === entry.path);
    if (existing) {
      setActivePath(existing.path);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const content = await readTextFile(entry.path);
      setFiles((prev) => [
        ...prev,
        {
          path: entry.path,
          name: entry.name,
          language: languageForFile(entry.name),
          value: content,
          dirty: false,
        },
      ]);
      setActivePath(entry.path);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const closeFile = useCallback((path: string) => {
    setFiles((prev) => {
      const idx = prev.findIndex((f) => f.path === path);
      const next = prev.filter((f) => f.path !== path);
      setActivePath((cur) =>
        cur === path ? (next[Math.min(idx, next.length - 1)]?.path ?? null) : cur,
      );
      return next;
    });
  }, []);

  // A file (or folder) was deleted in the tree — drop any tabs under it.
  const onDeleted = useCallback((deleted: string) => {
    const d = norm(deleted);
    setFiles((prev) => {
      const next = prev.filter((f) => {
        const p = norm(f.path);
        return p !== d && !p.startsWith(`${d}/`);
      });
      setActivePath((cur) => {
        if (cur && next.some((f) => f.path === cur)) return cur;
        return next[next.length - 1]?.path ?? null;
      });
      return next;
    });
  }, []);

  const save = useCallback(
    async (path?: string) => {
      const target = files.find((f) => f.path === (path ?? activePath));
      if (!target || !target.dirty || saving) return;
      setSaving(true);
      setError(null);
      try {
        await writeTextFile(target.path, target.value);
        setFiles((prev) => prev.map((f) => (f.path === target.path ? { ...f, dirty: false } : f)));
      } catch (e) {
        setError(String(e));
      } finally {
        setSaving(false);
      }
    },
    [files, activePath, saving],
  );

  // Ctrl/Cmd+S saves the focused file.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s" && active) {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, save]);

  if (!session) {
    return <div className="flex h-full items-center justify-center text-[12px] text-text-muted">No active session</div>;
  }

  return (
    <div className="flex h-full">
      <div className="w-52 shrink-0 border-r border-border">
        <FileTree
          rootPath={session.cwd}
          activePath={active?.path}
          onOpen={openEntry}
          onDeleted={onDeleted}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {files.length > 0 ? (
          <>
            {/* open-file tabs */}
            <div className="flex h-8 shrink-0 items-center overflow-x-auto border-b border-border">
              {files.map((f) => {
                const isActive = f.path === activePath;
                return (
                  <div
                    key={f.path}
                    onClick={() => setActivePath(f.path)}
                    title={f.path}
                    className={cn(
                      "group flex h-full max-w-[180px] shrink-0 cursor-pointer items-center gap-1.5 border-r border-border px-2.5 text-[12px]",
                      isActive
                        ? "bg-surface-raised text-text-emphasis"
                        : "text-text-muted hover:bg-overlay hover:text-text",
                    )}
                  >
                    <span className="truncate">{f.name}</span>
                    {f.dirty ? (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" title="Unsaved changes" />
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          closeFile(f.path);
                        }}
                        className={cn("shrink-0 hover:text-accent", isActive ? "" : "opacity-0 group-hover:opacity-100")}
                        aria-label={`Close ${f.name}`}
                      >
                        <X size={11} />
                      </button>
                    )}
                    {f.dirty && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          closeFile(f.path);
                        }}
                        className="hidden shrink-0 hover:text-accent group-hover:inline"
                        aria-label={`Close ${f.name} (discard changes)`}
                        title="Close (discards unsaved changes)"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                );
              })}
              <div className="ml-auto flex shrink-0 items-center pr-1.5">
                <button
                  onClick={() => void save()}
                  disabled={!active?.dirty || saving}
                  className={cn(
                    "flex h-6 items-center gap-1.5 rounded-[var(--r-1)] px-2 text-[11px] transition-colors",
                    active?.dirty ? "text-text hover:bg-overlay" : "text-text-disabled",
                  )}
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save
                </button>
              </div>
            </div>
            {error && (
              <div className="shrink-0 border-b border-border bg-accent-dim px-3 py-1.5 text-[11px] text-accent-hover">
                {error}
              </div>
            )}
            <div className="min-h-0 flex-1">
              {active && (
                <MonacoPane
                  path={active.path}
                  value={active.value}
                  language={active.language}
                  onChange={(v) => {
                    setFiles((prev) =>
                      prev.map((f) => (f.path === active.path ? { ...f, value: v, dirty: true } : f)),
                    );
                  }}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            {loading ? (
              <Loader2 size={18} className="animate-spin text-text-muted" />
            ) : (
              <>
                <FileCode size={22} className="text-text-disabled" />
                <p className="text-[13px] text-text-muted">{error ?? "Select a file to view or edit"}</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
