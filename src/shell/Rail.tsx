import {
  LayoutGrid,
  FileCode,
  GitCompare,
  Boxes,
  MonitorSmartphone,
  LayoutTemplate,
  BarChart3,
  Bot,
  Lock,
  Settings,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/Tooltip";
import type { DockId, OverlayId } from "@/lib/types";

const DOCKS: { id: DockId; icon: typeof Boxes; label: string }[] = [
  { id: "editor", icon: FileCode, label: "Files & Editor" },
  { id: "git", icon: GitCompare, label: "Git · Diff & History" },
  { id: "mcp", icon: Boxes, label: "MCP Hub" },
  { id: "preview", icon: MonitorSmartphone, label: "Preview" },
];

export function Rail({
  dock,
  onToggleDock,
  overlay,
  onToggleOverlay,
}: {
  dock: DockId | null;
  onToggleDock: (d: DockId) => void;
  overlay: OverlayId | null;
  onToggleOverlay: (o: OverlayId) => void;
}) {
  return (
    <nav className="flex w-14 shrink-0 flex-col items-center border-r border-border bg-bg py-2">
      <div className="flex flex-1 flex-col items-center gap-1">
        <RailItem active={overlay === "board"} label="Board" onClick={() => onToggleOverlay("board")}>
          <LayoutGrid size={18} />
        </RailItem>
        <div className="my-1 h-px w-6 bg-border" />
        {DOCKS.map(({ id, icon: Icon, label }) => (
          <RailItem key={id} active={dock === id} label={label} onClick={() => onToggleDock(id)}>
            <Icon size={18} />
          </RailItem>
        ))}
        <RailItem active={overlay === "templates"} label="Templates" onClick={() => onToggleOverlay("templates")}>
          <LayoutTemplate size={18} />
        </RailItem>
        <RailItem active={overlay === "cost"} label="Cost history" onClick={() => onToggleOverlay("cost")}>
          <BarChart3 size={18} />
        </RailItem>
        <RailItem active={overlay === "subagents"} label="Sub-agents" onClick={() => onToggleOverlay("subagents")}>
          <Bot size={18} />
        </RailItem>
        <RailItem active={overlay === "vault"} label="Secrets vault" onClick={() => onToggleOverlay("vault")}>
          <Lock size={18} />
        </RailItem>
      </div>
      <div className="flex flex-col items-center gap-1">
        <RailItem active={overlay === "theme"} label="Theme preview" onClick={() => onToggleOverlay("theme")}>
          <Palette size={18} />
        </RailItem>
        <RailItem active={overlay === "settings"} label="Settings" onClick={() => onToggleOverlay("settings")}>
          <Settings size={18} />
        </RailItem>
      </div>
    </nav>
  );
}

function RailItem({
  children,
  active,
  label,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip content={label} side="right">
      <button
        onClick={onClick}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-[var(--r-2)] transition-colors",
          active ? "text-text-emphasis" : "text-text-muted hover:bg-overlay hover:text-text",
        )}
      >
        <span
          className={cn(
            "absolute left-[-8px] h-5 w-[2px] rounded-full bg-accent transition-opacity",
            active ? "opacity-100" : "opacity-0",
          )}
        />
        {children}
      </button>
    </Tooltip>
  );
}
