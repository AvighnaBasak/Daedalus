import { Command } from "cmdk";
import { FolderOpen, Boxes, MonitorSmartphone, Settings, Palette, TerminalSquare, FileCode } from "lucide-react";
import type { DockId, OverlayId, Session } from "@/lib/types";

export function CommandPalette({
  open,
  onOpenChange,
  sessions,
  onSelectSession,
  onNewSession,
  onOpenDock,
  onOpenOverlay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: Session[];
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onOpenDock: (d: DockId) => void;
  onOpenOverlay: (o: OverlayId) => void;
}) {
  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      overlayClassName="fixed inset-0 z-50 bg-black/50"
      contentClassName="fixed left-1/2 top-[12vh] z-50 w-full max-w-[560px] -translate-x-1/2 overflow-hidden rounded-[var(--r-3)] border border-border-strong bg-overlay"
    >
      <Command.Input
        placeholder="Search sessions, views, actions…"
        className="w-full border-b border-border bg-transparent px-4 py-3 text-[14px] text-text outline-none placeholder:text-text-disabled"
      />
      <Command.List className="max-h-[50vh] overflow-y-auto p-1.5">
        <Command.Empty className="px-3 py-6 text-center text-[13px] text-text-muted">
          No results.
        </Command.Empty>

        <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:mono-label [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
          <Item onSelect={() => run(onNewSession)} icon={<FolderOpen size={15} />}>
            Open project folder…
          </Item>
        </Command.Group>

        {sessions.length > 0 && (
          <Command.Group heading="Sessions" className="[&_[cmdk-group-heading]]:mono-label [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
            {sessions.map((s) => (
              <Item
                key={s.id}
                onSelect={() => run(() => onSelectSession(s.id))}
                icon={<TerminalSquare size={15} />}
              >
                {s.title}
                <span className="ml-auto truncate text-[11px] text-text-disabled">{s.cwd}</span>
              </Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading="Open panel" className="[&_[cmdk-group-heading]]:mono-label [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
          <Item onSelect={() => run(() => onOpenDock("editor"))} icon={<FileCode size={15} />}>Files & Editor</Item>
          <Item onSelect={() => run(() => onOpenDock("mcp"))} icon={<Boxes size={15} />}>MCP Hub</Item>
          <Item onSelect={() => run(() => onOpenDock("preview"))} icon={<MonitorSmartphone size={15} />}>Preview</Item>
          <Item onSelect={() => run(() => onOpenOverlay("theme"))} icon={<Palette size={15} />}>Theme preview</Item>
          <Item onSelect={() => run(() => onOpenOverlay("settings"))} icon={<Settings size={15} />}>Settings</Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}

function Item({
  children,
  icon,
  onSelect,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-[var(--r-2)] px-2.5 py-2 text-[13px] text-text-secondary data-[selected=true]:bg-surface-raised data-[selected=true]:text-text-emphasis"
    >
      <span className="text-text-muted">{icon}</span>
      {children}
    </Command.Item>
  );
}
