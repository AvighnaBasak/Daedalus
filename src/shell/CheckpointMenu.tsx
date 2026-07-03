import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { GitCommitVertical, RotateCcw, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { gitCheckpoint, gitRewind } from "@/lib/git";
import type { Session } from "@/lib/types";

interface Checkpoint {
  sha: string;
  label: string;
  ts: number;
}

function keyFor(cwd: string) {
  return `daedalus.ckpt.${cwd}`;
}
function load(cwd: string): Checkpoint[] {
  try {
    return JSON.parse(localStorage.getItem(keyFor(cwd)) ?? "[]");
  } catch {
    return [];
  }
}
function persist(cwd: string, list: Checkpoint[]) {
  localStorage.setItem(keyFor(cwd), JSON.stringify(list.slice(0, 20)));
}
function ago(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

/** Snapshot-before-a-risky-run control: git-plumbing checkpoints + one-click rewind. */
export function CheckpointMenu({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Checkpoint[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirmSha, setConfirmSha] = useState<string | null>(null);

  const refresh = () => setList(load(session.cwd));

  const snapshot = async () => {
    setBusy(true);
    setNote(null);
    try {
      const label = new Date().toLocaleTimeString();
      const sha = await gitCheckpoint(session.cwd, label);
      const next = [{ sha, label, ts: Date.now() }, ...load(session.cwd)];
      persist(session.cwd, next);
      setList(next);
    } catch (e) {
      setNote(String(e));
    } finally {
      setBusy(false);
    }
  };

  const rewind = async (sha: string) => {
    setBusy(true);
    setNote(null);
    try {
      const msg = await gitRewind(session.cwd, sha);
      setNote(msg || "Rewound to checkpoint.");
      setConfirmSha(null);
    } catch (e) {
      setNote(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) refresh();
        else {
          setNote(null);
          setConfirmSha(null);
        }
      }}
    >
      <Popover.Trigger asChild>
        <Button size="sm" variant="ghost">
          <GitCommitVertical size={13} />
          Checkpoint
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="glass elev-2 z-50 w-72 rounded-[var(--r-3)] border border-border-strong p-2 text-text"
        >
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="mono-label">Checkpoints</span>
            <Button size="sm" variant="solid" onClick={snapshot} disabled={busy}>
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Snapshot
            </Button>
          </div>

          {note && (
            <p className="mb-2 rounded-[var(--r-1)] border border-border bg-bg px-2 py-1.5 font-mono text-[11px] text-text-muted">
              {note}
            </p>
          )}

          {list.length === 0 ? (
            <p className="px-1 py-3 text-center text-[12px] text-text-muted">
              No checkpoints yet. Snapshot before a risky run.
            </p>
          ) : (
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {list.map((c) => (
                <li
                  key={c.sha}
                  className="flex items-center gap-2 rounded-[var(--r-2)] px-2 py-1.5 hover:bg-surface-raised"
                >
                  <span className="tabular font-mono text-[11px] text-text-disabled">
                    {c.sha.slice(0, 7)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-text">{c.label}</span>
                  <span className="text-[10px] text-text-disabled">{ago(c.ts)}</span>
                  {confirmSha === c.sha ? (
                    <button
                      onClick={() => rewind(c.sha)}
                      disabled={busy}
                      className="rounded-[var(--r-1)] bg-accent px-1.5 py-0.5 text-[10px] text-white hover:bg-accent-hover"
                    >
                      Confirm
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmSha(c.sha)}
                      className="text-text-disabled hover:text-accent"
                      aria-label="Rewind to checkpoint"
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
