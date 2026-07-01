import { useCallback, useEffect, useState } from "react";
import { DiffEditor, type BeforeMount } from "@monaco-editor/react";
import {
  RefreshCw, Sparkles, GitCommitHorizontal, ShieldAlert, Loader2, GitBranch, FileDiff, History,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { daedalusNoir } from "@/editor/monacoTheme";
import { languageForFile, readTextFile } from "@/lib/files";
import {
  gitStatus, gitShowHead, gitLog, gitCommit, scanSecrets, generateCommitMessage,
  type FileChange, type Commit, type SecretFinding,
} from "@/lib/git";
import { isTauri } from "@/lib/tauri";
import { cn } from "@/lib/cn";
import type { Session } from "@/lib/types";

function joinPath(cwd: string, rel: string): string {
  const sep = cwd.includes("\\") ? "\\" : "/";
  return cwd.replace(/[\\/]$/, "") + sep + rel;
}

const STATUS_TAG: Record<string, string> = {
  added: "A", modified: "M", deleted: "D", renamed: "R", untracked: "?",
};

export function GitPanel({ session }: { session: Session | null }) {
  const [tab, setTab] = useState<"changes" | "history">("changes");
  if (!session) {
    return <div className="flex h-full items-center justify-center text-[12px] text-text-muted">No active session</div>;
  }
  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border px-2">
        <TabBtn active={tab === "changes"} onClick={() => setTab("changes")} icon={<FileDiff size={13} />}>Changes</TabBtn>
        <TabBtn active={tab === "history"} onClick={() => setTab("history")} icon={<History size={13} />}>History</TabBtn>
      </div>
      <div className="min-h-0 flex-1">
        {tab === "changes" ? <Changes session={session} /> : <HistoryTab session={session} />}
      </div>
    </div>
  );
}

function TabBtn({ children, icon, active, onClick }: { children: React.ReactNode; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-[var(--r-2)] px-2.5 text-[12px] transition-colors",
        active ? "bg-surface-raised text-text-emphasis" : "text-text-muted hover:text-text",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function Changes({ session }: { session: Session }) {
  const cwd = session.cwd;
  const [files, setFiles] = useState<FileChange[]>([]);
  const [selected, setSelected] = useState<FileChange | null>(null);
  const [orig, setOrig] = useState("");
  const [mod, setMod] = useState("");
  const [message, setMessage] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [findings, setFindings] = useState<SecretFinding[] | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const list = await gitStatus(cwd);
      setFiles(list);
      setSelected((cur) => cur ?? list[0] ?? null);
    } catch (e) {
      setNote(String(e));
    }
  }, [cwd]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selected) {
      setOrig("");
      setMod("");
      return;
    }
    (async () => {
      const original = await gitShowHead(cwd, selected.path).catch(() => "");
      const modified =
        selected.status === "deleted" ? "" : await readTextFile(joinPath(cwd, selected.path)).catch(() => "");
      setOrig(original);
      setMod(modified);
    })();
  }, [selected, cwd]);

  const generate = async () => {
    setGenBusy(true);
    setNote(null);
    try {
      setMessage(await generateCommitMessage(cwd));
    } catch (e) {
      setNote(String(e));
    } finally {
      setGenBusy(false);
    }
  };

  const doCommit = async () => {
    setCommitting(true);
    setNote(null);
    try {
      await gitCommit(cwd, message.trim());
      setMessage("");
      setFindings(null);
      await refresh();
      setSelected(null);
      setNote("Committed.");
    } catch (e) {
      setNote(String(e));
    } finally {
      setCommitting(false);
    }
  };

  const commit = async () => {
    if (!message.trim()) return;
    setCommitting(true);
    setNote(null);
    try {
      const found = await scanSecrets(cwd);
      if (found.length > 0) {
        setFindings(found);
        setCommitting(false);
        return;
      }
      await doCommit();
    } catch {
      await doCommit();
    }
  };

  const beforeMount: BeforeMount = (monaco) => monaco.editor.defineTheme("daedalus-noir", daedalusNoir);

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        {/* file list */}
        <div className="flex w-48 shrink-0 flex-col border-r border-border">
          <div className="flex h-8 items-center justify-between border-b border-border px-2">
            <span className="mono-label truncate">{files.length} changed</span>
            <button onClick={refresh} className="text-text-disabled hover:text-text" aria-label="Refresh">
              <RefreshCw size={12} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto py-1">
            {files.length === 0 ? (
              <p className="px-2 py-3 text-[11px] text-text-muted">Working tree clean</p>
            ) : (
              files.map((f) => (
                <button
                  key={f.path}
                  onClick={() => setSelected(f)}
                  className={cn(
                    "flex w-full items-center gap-2 px-2 py-1 text-left text-[12px]",
                    selected?.path === f.path ? "bg-surface-raised text-text-emphasis" : "text-text-secondary hover:bg-overlay",
                  )}
                >
                  <span className={cn("w-3 text-center font-mono text-[10px]", f.status === "deleted" ? "text-accent" : "text-text-muted")}>
                    {STATUS_TAG[f.status] ?? "M"}
                  </span>
                  <span className="truncate">{f.path.split(/[\\/]/).pop()}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* diff */}
        <div className="min-w-0 flex-1">
          {selected ? (
            <DiffEditor
              key={selected.path}
              original={orig}
              modified={mod}
              language={languageForFile(selected.path)}
              theme="daedalus-noir"
              beforeMount={beforeMount}
              options={{
                readOnly: true,
                renderSideBySide: false,
                minimap: { enabled: false },
                fontSize: 12,
                fontFamily: 'var(--font-mono), Consolas, monospace',
                scrollBeyondLastLine: false,
                lineNumbers: "off",
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[12px] text-text-muted">
              Select a file to see its diff
            </div>
          )}
        </div>
      </div>

      {/* commit box */}
      <div className="shrink-0 border-t border-border p-2">
        {findings && (
          <div className="mb-2 rounded-[var(--r-2)] border border-[color-mix(in_srgb,var(--red)_45%,transparent)] bg-accent-dim p-2">
            <p className="flex items-center gap-1.5 text-[12px] text-accent-hover">
              <ShieldAlert size={13} /> {findings.length} possible secret{findings.length === 1 ? "" : "s"} in your changes
            </p>
            <ul className="mt-1 max-h-20 overflow-auto">
              {findings.map((f, i) => (
                <li key={i} className="truncate font-mono text-[10px] text-text-muted">
                  {f.rule} · {f.file}: {f.preview}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex items-start gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Commit message…"
            rows={2}
            className="min-h-0 flex-1 resize-none rounded-[var(--r-2)] border border-border bg-surface px-2 py-1.5 text-[12px] text-text outline-none placeholder:text-text-disabled focus:border-border-hover"
          />
          <div className="flex flex-col gap-1.5">
            <Button size="sm" variant="outline" onClick={generate} disabled={genBusy}>
              {genBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Generate
            </Button>
            <Button size="sm" variant={findings ? "danger" : "solid"} onClick={findings ? doCommit : commit} disabled={!message.trim() || committing}>
              {committing ? <Loader2 size={13} className="animate-spin" /> : <GitCommitHorizontal size={13} />}
              {findings ? "Commit anyway" : "Commit"}
            </Button>
          </div>
        </div>
        {note && <p className="mt-1 font-mono text-[11px] text-text-muted">{note}</p>}
      </div>
    </div>
  );
}

function HistoryTab({ session }: { session: Session }) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    gitLog(session.cwd, 60).then(setCommits).catch((e) => setNote(String(e)));
  }, [session.cwd]);

  if (note) return <p className="p-4 text-[12px] text-text-muted">{note}</p>;

  return (
    <div className="h-full overflow-auto p-3">
      <ul className="flex flex-col">
        {commits.map((c, i) => {
          const merge = c.parents.length > 1;
          const refs = c.refs ? c.refs.split(", ").filter(Boolean) : [];
          return (
            <li key={c.hash} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={cn("mt-1.5 text-[10px]", merge ? "text-accent" : "text-text-muted")}>
                  {merge ? "◆" : "●"}
                </span>
                {i < commits.length - 1 && <span className="w-px flex-1 bg-border" />}
              </div>
              <div className="min-w-0 flex-1 pb-3">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] text-text">{c.subject}</span>
                  {refs.map((r) => (
                    <span key={r} className="shrink-0 rounded-[var(--r-1)] border border-border px-1 py-px text-[9px] text-text-muted">
                      <span className="inline-flex items-center gap-0.5">
                        <GitBranch size={8} />
                        {r.replace("HEAD -> ", "").replace("tag: ", "")}
                      </span>
                    </span>
                  ))}
                </div>
                <p className="mt-0.5 font-mono text-[10px] text-text-disabled">
                  {c.short} · {c.author} · {c.date}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
