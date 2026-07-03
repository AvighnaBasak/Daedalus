import { useCallback, useEffect, useState } from "react";
import { Lock, Plus, Trash2, Eye, EyeOff, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { vaultList, vaultSet, vaultDelete, vaultWriteEnv, type VaultEntry } from "@/lib/features";
import { isTauri } from "@/lib/tauri";
import type { Session } from "@/lib/types";

export function VaultView({ session }: { session: Session | null }) {
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const cwd = session?.cwd ?? null;

  const refresh = useCallback(async () => {
    if (!cwd || !isTauri()) {
      setEntries([]);
      return;
    }
    try {
      setEntries(await vaultList(cwd));
    } catch (e) {
      setNote(String(e));
    }
  }, [cwd]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-text-muted">
        Open a session to manage its secrets.
      </div>
    );
  }

  const add = async () => {
    if (!name.trim() || !value.trim() || busy) return;
    setBusy(true);
    setNote(null);
    try {
      await vaultSet(session.cwd, name.trim().toUpperCase().replace(/\s+/g, "_"), value.trim());
      setName("");
      setValue("");
      await refresh();
    } catch (e) {
      setNote(String(e));
    } finally {
      setBusy(false);
    }
  };

  const writeEnv = async () => {
    setBusy(true);
    setNote(null);
    try {
      setNote(await vaultWriteEnv(session.cwd));
    } catch (e) {
      setNote(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto max-w-2xl px-8 py-6">
        <span className="mono-label">Secrets Vault</span>
        <h1 className="mt-1 flex items-center gap-2 text-[22px] text-text-emphasis">
          <Lock size={18} className="text-text-muted" />
          {session.title}
        </h1>
        <p className="mt-1 text-[13px] text-text-muted">
          Stored AES-256-GCM encrypted outside the project — raw keys never sit in Claude's context.
          Write them into a git-ignored <span className="font-mono">.env</span> only when needed.
        </p>

        {/* add form */}
        <div className="mt-6 flex items-start gap-2 rounded-[var(--r-2)] border border-border bg-surface-raised p-3 elev-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="API_KEY"
            spellCheck={false}
            className="w-44 rounded-[var(--r-1)] border border-border bg-bg px-2 py-1.5 font-mono text-[12px] text-text outline-none placeholder:text-text-disabled focus:border-border-hover"
          />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="value"
            type="password"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-[var(--r-1)] border border-border bg-bg px-2 py-1.5 font-mono text-[12px] text-text outline-none placeholder:text-text-disabled focus:border-border-hover"
          />
          <Button size="sm" variant="solid" onClick={add} disabled={!name.trim() || !value.trim() || busy}>
            <Plus size={13} />
            Add
          </Button>
        </div>

        {note && (
          <p className="mt-3 rounded-[var(--r-1)] border border-border bg-surface px-3 py-2 font-mono text-[11px] text-text-muted">
            {note}
          </p>
        )}

        {/* entries */}
        <ul className="mt-4 flex flex-col gap-1.5">
          {entries.length === 0 && (
            <p className="py-8 text-center text-[12px] text-text-muted">No secrets stored for this project yet.</p>
          )}
          {entries.map((e) => {
            const shown = revealed.has(e.name);
            return (
              <li key={e.name} className="flex items-center gap-3 rounded-[var(--r-2)] border border-border bg-surface px-3 py-2.5">
                <span className="w-44 truncate font-mono text-[12px] text-text">{e.name}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-text-muted">
                  {shown ? e.value : "•".repeat(Math.min(24, Math.max(8, e.value.length)))}
                </span>
                <button
                  onClick={() =>
                    setRevealed((prev) => {
                      const next = new Set(prev);
                      if (next.has(e.name)) next.delete(e.name);
                      else next.add(e.name);
                      return next;
                    })
                  }
                  className="text-text-disabled hover:text-text"
                  aria-label={shown ? "Hide" : "Reveal"}
                >
                  {shown ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  onClick={async () => {
                    await vaultDelete(session.cwd, e.name).catch(() => {});
                    await refresh();
                  }}
                  className="text-text-disabled hover:text-accent"
                  aria-label="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>

        {entries.length > 0 && (
          <div className="mt-5 flex justify-end">
            <Button variant="outline" onClick={writeEnv} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              Write .env to project
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
