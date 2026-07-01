import { FolderOpen, TerminalSquare } from "lucide-react";
import { Terminal } from "@/terminal/Terminal";
import { Button } from "@/components/ui/Button";
import type { Session } from "@/lib/types";

export function SessionView({
  session,
  onNew,
}: {
  session: Session | null;
  onNew: () => void;
}) {
  if (!session) return <EmptyState onNew={onNew} />;

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
        <TerminalSquare size={13} className="text-text-muted" />
        <span className="mono-label">Terminal · claude</span>
        <span className="ml-2 truncate text-[11px] text-text-disabled">{session.cwd}</span>
      </div>
      <div className="min-h-0 flex-1">
        <Terminal key={session.id} sessionId={session.id} cwd={session.cwd} />
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
