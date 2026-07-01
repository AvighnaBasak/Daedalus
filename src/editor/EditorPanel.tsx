import { useCallback, useEffect, useState } from "react";
import { FileCode, Loader2, Save } from "lucide-react";
import { FileTree } from "./FileTree";
import { MonacoPane } from "./MonacoPane";
import { readTextFile, writeTextFile, languageForFile, type DirEntry } from "@/lib/files";
import { cn } from "@/lib/cn";
import type { Session } from "@/lib/types";

interface OpenFile {
  path: string;
  name: string;
  language: string;
}

export function EditorPanel({ session }: { session: Session | null }) {
  const [open, setOpen] = useState<OpenFile | null>(null);
  const [value, setValue] = useState("");
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openEntry = async (entry: DirEntry) => {
    setLoading(true);
    setError(null);
    try {
      const content = await readTextFile(entry.path);
      setOpen({ path: entry.path, name: entry.name, language: languageForFile(entry.name) });
      setValue(content);
      setDirty(false);
    } catch (e) {
      setError(String(e));
      setOpen(null);
    } finally {
      setLoading(false);
    }
  };

  const save = useCallback(async () => {
    if (!open || !dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      await writeTextFile(open.path, value);
      setDirty(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }, [open, dirty, saving, value]);

  // Ctrl/Cmd+S to save the open file.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s" && open) {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, save]);

  if (!session) {
    return <div className="flex h-full items-center justify-center text-[12px] text-text-muted">No active session</div>;
  }

  return (
    <div className="flex h-full">
      <div className="w-52 shrink-0 border-r border-border">
        <FileTree rootPath={session.cwd} activePath={open?.path} onOpen={openEntry} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {open ? (
          <>
            <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border pl-3 pr-1.5">
              <FileCode size={13} className="text-text-muted" />
              <span className="truncate text-[12px] text-text">{open.name}</span>
              {dirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" title="Unsaved changes" />}
              <button
                onClick={save}
                disabled={!dirty || saving}
                className={cn(
                  "ml-auto flex h-6 items-center gap-1.5 rounded-[var(--r-1)] px-2 text-[11px] transition-colors",
                  dirty
                    ? "text-text hover:bg-overlay"
                    : "text-text-disabled",
                )}
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Save
              </button>
            </div>
            {error && (
              <div className="shrink-0 border-b border-border bg-accent-dim px-3 py-1.5 text-[11px] text-accent-hover">
                {error}
              </div>
            )}
            <div className="min-h-0 flex-1">
              <MonacoPane
                path={open.path}
                value={value}
                language={open.language}
                onChange={(v) => {
                  setValue(v);
                  setDirty(true);
                }}
              />
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
