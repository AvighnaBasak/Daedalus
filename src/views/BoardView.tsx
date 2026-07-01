import { FolderOpen, GitBranch, Trash2, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusDot } from "@/components/ui/StatusDot";
import { Meter } from "@/components/ui/Meter";
import { useSessionStats } from "@/meter/useSessionStats";
import type { Session } from "@/lib/types";

function ago(ts?: number): string {
  if (!ts) return "—";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

const STATUS_LABEL = { idle: "Idle", working: "Working", attention: "Needs you" } as const;

export function BoardView({
  sessions,
  activeId,
  onFocus,
  onNew,
  onNewIsolated,
  onRemoveWorktree,
  onClose,
}: {
  sessions: Session[];
  activeId: string | null;
  onFocus: (id: string) => void;
  onNew: () => void;
  onNewIsolated: () => void;
  onRemoveWorktree: (session: Session) => void;
  onClose: (id: string) => void;
}) {
  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto max-w-5xl px-8 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <span className="mono-label">Agent Board</span>
            <h1 className="mt-1 text-[22px] text-text-emphasis">
              {sessions.length} session{sessions.length === 1 ? "" : "s"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onNew}>
              <FolderOpen size={14} />
              Open folder
            </Button>
            <Button variant="solid" onClick={onNewIsolated}>
              <GitBranch size={14} />
              New isolated agent
            </Button>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-[var(--r-3)] border border-border text-text-muted">
              <Plus size={20} />
            </div>
            <p className="text-[14px] text-text">No agents running</p>
            <p className="max-w-sm text-[12px] text-text-muted">
              Start an isolated agent to run Claude on its own git worktree — parallel work that never
              collides with your main branch.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {sessions.map((s) => (
              <BoardCard
                key={s.id}
                session={s}
                active={s.id === activeId}
                onFocus={() => onFocus(s.id)}
                onRemoveWorktree={() => onRemoveWorktree(s)}
                onClose={() => onClose(s.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BoardCard({
  session,
  active,
  onFocus,
  onRemoveWorktree,
  onClose,
}: {
  session: Session;
  active: boolean;
  onFocus: () => void;
  onRemoveWorktree: () => void;
  onClose: () => void;
}) {
  const stats = useSessionStats(session);
  const status = session.status ?? "idle";
  const ratio = stats.maxTokens > 0 ? stats.usedTokens / stats.maxTokens : 0;

  return (
    <div
      onClick={onFocus}
      className={cnCard(active)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusDot tone={status === "attention" ? "alert" : status === "working" ? "busy" : "idle"} pulse={status === "attention"} />
          <span className="mono-label !text-[10px]">{STATUS_LABEL[status]}</span>
        </div>
        <div className="flex items-center gap-1">
          {session.worktree && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveWorktree();
              }}
              className="text-text-disabled hover:text-accent"
              aria-label="Remove worktree"
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-text-disabled hover:text-accent"
            aria-label="Close session"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <p className="mt-2 truncate text-[14px] text-text-emphasis">{session.title}</p>
      {session.worktree && (
        <span className="mt-1 flex w-fit items-center gap-1 rounded-[var(--r-1)] border border-border px-1.5 py-0.5 text-[10px] text-text-muted">
          <GitBranch size={10} />
          {session.worktree.branch}
        </span>
      )}
      <p className="mt-1 truncate text-[11px] text-text-disabled">{session.cwd}</p>

      <div className="mt-3">
        <Meter value={ratio} />
        <div className="mt-1.5 flex items-center justify-between text-[11px]">
          <span className="tabular text-text-muted">{Math.round(ratio * 100)}% ctx</span>
          <span className="tabular text-text">${stats.costUsd.toFixed(4)}</span>
          <span className="text-text-disabled">{ago(session.lastActivity)}</span>
        </div>
      </div>
    </div>
  );
}

function cnCard(active: boolean): string {
  return [
    "cursor-pointer rounded-[var(--r-2)] border bg-surface p-3 transition-colors",
    active ? "border-border-strong" : "border-border hover:border-border-hover",
  ].join(" ");
}
