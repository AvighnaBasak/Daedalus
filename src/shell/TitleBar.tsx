import { Minus, Square, X, Command, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { StatusDot } from "@/components/ui/StatusDot";
import { HudStrip } from "./HudStrip";
import { minimizeWindow, toggleMaximizeWindow, closeWindow } from "@/lib/window";
import mark from "@/assets/appicon.png";
import type { Session } from "@/lib/types";
import type { HudStats } from "@/meter/useSessionStats";

export function TitleBar({
  sessions,
  activeId,
  onSelect,
  onClose,
  onNew,
  onOpenPalette,
  stats,
}: {
  sessions: Session[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onOpenPalette: () => void;
  stats: HudStats;
}) {
  return (
    <div
      data-tauri-drag-region
      className="flex h-10 shrink-0 items-center gap-1 border-b border-border bg-bg pl-3 pr-1"
    >
      {/* Brand mark */}
      <div data-tauri-drag-region className="flex items-center gap-2 pr-2">
        <img src={mark} alt="" className="pointer-events-none h-[18px] w-[18px] rounded-[3px]" />
        <span className="mono-label !text-text-secondary">DAEDALUS</span>
      </div>

      {/* Session tabs */}
      <div className="flex h-full min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {sessions.map((s) => {
          const active = s.id === activeId;
          return (
            <div
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={cn(
                "group flex h-7 max-w-[200px] cursor-pointer items-center gap-2 rounded-[var(--r-2)] border px-2.5 text-[12px] transition-colors",
                active
                  ? "border-border-strong bg-surface-raised text-text-emphasis"
                  : "border-transparent text-text-muted hover:bg-overlay hover:text-text",
              )}
            >
              <StatusDot
                tone={s.status === "attention" ? "alert" : s.status === "working" ? "busy" : active ? "busy" : "idle"}
                pulse={s.status === "attention"}
              />
              <span className="truncate">{s.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(s.id);
                }}
                className="opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
                aria-label="Close session"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
        <button
          onClick={onNew}
          className="flex h-7 w-7 items-center justify-center rounded-[var(--r-2)] text-text-muted hover:bg-overlay hover:text-text"
          aria-label="New session"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Compact cockpit HUD (keeps the terminal fullscreen) */}
      <HudStrip stats={stats} active={activeId !== null} />

      {/* Command palette hint */}
      <button
        onClick={onOpenPalette}
        className="mx-1 flex h-7 items-center gap-1.5 rounded-[var(--r-2)] border border-border px-2 text-[11px] text-text-muted hover:border-border-hover hover:text-text"
      >
        <Command size={12} />
        <span className="tabular">K</span>
      </button>

      {/* Window controls */}
      <div className="flex items-center">
        <WinBtn onClick={minimizeWindow} label="Minimize">
          <Minus size={14} />
        </WinBtn>
        <WinBtn onClick={toggleMaximizeWindow} label="Maximize">
          <Square size={11} />
        </WinBtn>
        <WinBtn onClick={closeWindow} label="Close" danger>
          <X size={14} />
        </WinBtn>
      </div>
    </div>
  );
}

function WinBtn({
  children,
  onClick,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex h-8 w-10 items-center justify-center text-text-muted transition-colors",
        danger ? "hover:bg-accent hover:text-white" : "hover:bg-overlay hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
