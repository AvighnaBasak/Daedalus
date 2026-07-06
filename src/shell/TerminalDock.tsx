import { useRef } from "react";
import { ChevronDown, Plus, TerminalSquare, X } from "lucide-react";
import { Terminal } from "@/terminal/Terminal";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";
import type { ShellTerm } from "@/lib/types";

/**
 * VS Code-style bottom panel hosting real system shells (PowerShell on Windows)
 * over the same pty layer as the claude terminal. Every shell stays mounted while
 * the panel is collapsed, so background processes keep running. Toggled with
 * Ctrl+` / Ctrl+J or the button in the session header.
 */
export function TerminalDock({
  terms,
  activeId,
  open,
  height,
  onHeightChange,
  onSelect,
  onNew,
  onCloseTerm,
  onToggle,
}: {
  terms: ShellTerm[];
  activeId: string | null;
  open: boolean;
  height: number;
  onHeightChange: (h: number) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onCloseTerm: (id: string) => void;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = height;
    const move = (ev: MouseEvent) => {
      onHeightChange(Math.max(120, Math.min(window.innerHeight - 220, startH + (startY - ev.clientY))));
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  if (terms.length === 0) return null;

  return (
    <div
      ref={ref}
      data-drop="shell"
      className={cn(
        "relative shrink-0 flex-col border-t border-border bg-bg",
        open ? "flex" : "hidden",
      )}
      style={open ? { height } : undefined}
    >
      {/* top-edge resize handle */}
      <div
        role="separator"
        aria-orientation="horizontal"
        onMouseDown={startDrag}
        className="absolute -top-px left-0 z-10 h-1 w-full cursor-row-resize bg-transparent hover:bg-border-hover"
      />
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border px-2">
        <TerminalSquare size={12} className="text-text-muted" />
        <span className="mono-label mr-1">Terminal</span>
        {terms.map((t, i) => (
          <div
            key={t.id}
            onClick={() => onSelect(t.id)}
            title={t.cwd}
            className={cn(
              "group flex h-6 cursor-pointer items-center gap-1.5 rounded-[var(--r-1)] border px-2 text-[11px]",
              t.id === activeId
                ? "border-border-strong bg-surface-raised text-text"
                : "border-transparent text-text-muted hover:bg-overlay",
            )}
          >
            <span className="truncate">{t.title || `Shell ${i + 1}`}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTerm(t.id);
              }}
              className="opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
              aria-label={`Close ${t.title}`}
            >
              <X size={11} />
            </button>
          </div>
        ))}
        <button
          onClick={onNew}
          className="flex h-6 w-6 items-center justify-center rounded-[var(--r-1)] text-text-muted hover:bg-overlay hover:text-text"
          aria-label="New terminal"
          title="New terminal"
        >
          <Plus size={13} />
        </button>
        <div className="ml-auto">
          <IconButton onClick={onToggle} aria-label="Hide terminal panel (Ctrl+`)">
            <ChevronDown size={15} />
          </IconButton>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        {terms.map((t) => (
          <div key={t.id} className={cn("absolute inset-0", t.id === activeId ? "" : "hidden")}>
            <Terminal sessionId={t.id} cwd={t.cwd} program="shell" />
          </div>
        ))}
      </div>
    </div>
  );
}
