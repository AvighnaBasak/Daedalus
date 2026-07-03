import { FolderOpen, TerminalSquare, GitBranch, Minimize2, Focus, RotateCw } from "lucide-react";
import { Terminal } from "@/terminal/Terminal";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { CheckpointMenu } from "./CheckpointMenu";
import { ModelMenu } from "./ModelMenu";
import { SnippetsMenu } from "./SnippetsMenu";
import { invoke, isTauri } from "@/lib/tauri";
import { cn } from "@/lib/cn";
import { useProvider } from "@/lib/provider";
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
  onToggleFocus,
  onRestart,
}: {
  sessions: Session[];
  activeId: string | null;
  onNew: () => void;
  onStatus: (id: string, status: SessionStatus) => void;
  onToggleFocus: () => void;
  onRestart: (id: string) => void;
}) {
  const active = sessions.find((s) => s.id === activeId) ?? null;
  const provider = useProvider();

  if (sessions.length === 0) return <EmptyState onNew={onNew} />;

  // Provider env applies at pty spawn — flag sessions running on an older backend.
  const stale =
    !!active?.spawnedWith &&
    (active.spawnedWith.kind !== provider.kind ||
      active.spawnedWith.model !== provider.model ||
      active.spawnedWith.base_url !== provider.base_url);
  const backendLabel =
    (active?.spawnedWith?.kind ?? "subscription") === "subscription"
      ? "ANTHROPIC"
      : active?.spawnedWith?.kind === "ollama"
        ? "OLLAMA"
        : "CUSTOM";

  const compact = () => {
    if (active && isTauri()) void invoke("pty_write", { id: active.id, data: "/compact\r" });
  };

  return (
    <div className="relative flex h-full flex-col bg-bg">
      {/* attention pulse: 1px hairline across the top when the agent needs you */}
      {active?.status === "attention" && (
        <div className="attention-hairline absolute inset-x-0 top-0 z-10 h-px" />
      )}
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
        <TerminalSquare size={13} className="text-text-muted" />
        <span className="mono-label">Terminal · claude</span>
        {active?.worktree && (
          <span className="flex items-center gap-1 rounded-[var(--r-1)] border border-border px-1.5 py-0.5 text-[10px] text-text-muted">
            <GitBranch size={10} />
            {active.worktree.branch}
          </span>
        )}
        <span
          className="rounded-[var(--r-1)] border border-border px-1.5 py-0.5 text-[9px] tracking-wider text-text-muted"
          title="Backend this session was started on"
        >
          {backendLabel}
        </span>
        <span className="ml-1 truncate text-[11px] text-text-disabled">{active?.cwd}</span>

        {stale && active && (
          <button
            onClick={() => onRestart(active.id)}
            className="flex shrink-0 items-center gap-1.5 rounded-[var(--r-1)] border border-[color-mix(in_srgb,var(--red)_45%,transparent)] bg-accent-dim px-2 py-1 text-[11px] text-accent-hover transition-colors hover:bg-accent hover:text-white"
            title="Your provider settings changed after this session started. Restart the session to apply them."
          >
            <RotateCw size={11} />
            Provider changed — restart to apply
          </button>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {active && <SnippetsMenu sessionId={active.id} cwd={active.cwd} />}
          {active && <ModelMenu sessionId={active.id} />}
          {active && <CheckpointMenu session={active} />}
          <Tooltip content="Summarize & prune context (/compact)" side="bottom">
            <Button size="sm" variant="ghost" onClick={compact} disabled={!active}>
              <Minimize2 size={13} />
              Compact
            </Button>
          </Tooltip>
          <Tooltip content="Focus mode (Ctrl+Shift+F)" side="bottom">
            <IconButton onClick={onToggleFocus} aria-label="Focus mode">
              <Focus size={15} />
            </IconButton>
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
