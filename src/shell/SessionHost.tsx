import { FolderOpen, TerminalSquare, GitBranch, Minimize2 } from "lucide-react";
import { Terminal } from "@/terminal/Terminal";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { CheckpointMenu } from "./CheckpointMenu";
import { ModelMenu } from "./ModelMenu";
import { invoke, isTauri } from "@/lib/tauri";
import { cn } from "@/lib/cn";
import type { Session, SessionStatus } from "@/lib/types";

/**
 * Hosts every session's terminal at once (only the active one visible) so that
 * background agents keep running when you switch tabs or open the board.
 */
export function SessionHost({
  sessions,
  activeId,
  onNew,
  onStatus,
}: {
  sessions: Session[];
  activeId: string | null;
  onNew: () => void;
  onStatus: (id: string, status: SessionStatus) => void;
}) {
  const active = sessions.find((s) => s.id === activeId) ?? null;

  if (sessions.length === 0) return <EmptyState onNew={onNew} />;

  const compact = () => {
    if (active && isTauri()) void invoke("pty_write", { id: active.id, data: "/compact\r" });
  };

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
        <TerminalSquare size={13} className="text-text-muted" />
        <span className="mono-label">Terminal · claude</span>
        {active?.worktree && (
          <span className="flex items-center gap-1 rounded-[var(--r-1)] border border-border px-1.5 py-0.5 text-[10px] text-text-muted">
            <GitBranch size={10} />
            {active.worktree.branch}
          </span>
        )}
        <span className="ml-1 truncate text-[11px] text-text-disabled">{active?.cwd}</span>

        <div className="ml-auto flex items-center gap-1.5">
          {active && <ModelMenu sessionId={active.id} />}
          {active && <CheckpointMenu session={active} />}
          <Tooltip content="Summarize & prune context (/compact)" side="bottom">
            <Button size="sm" variant="ghost" onClick={compact} disabled={!active}>
              <Minimize2 size={13} />
              Compact
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {sessions.map((s) => (
          <div key={s.id} className={cn("absolute inset-0", s.id === activeId ? "" : "hidden")}>
            <Terminal sessionId={s.id} cwd={s.cwd} onStatus={(st) => onStatus(s.id, st)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 bg-bg">
      <div className="flex h-14 w-14 items-center justify-center rounded-[var(--r-3)] border border-border text-text-muted">
        <TerminalSquare size={24} />
      </div>
      <div className="text-center">
        <h2 className="text-[16px] text-text-emphasis">No active session</h2>
        <p className="mt-1 max-w-xs text-[13px] text-text-muted">
          Open a project folder to start a live Claude Code session in an isolated terminal.
        </p>
      </div>
      <Button variant="solid" onClick={onNew}>
        <FolderOpen size={15} />
        Open project folder
      </Button>
    </div>
  );
}
