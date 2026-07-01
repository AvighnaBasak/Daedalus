import { useCallback, useEffect, useState, type ReactNode } from "react";
import { FileCode, Boxes, MonitorSmartphone, X } from "lucide-react";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { IconButton } from "@/components/ui/IconButton";
import { Rail } from "@/shell/Rail";
import { TitleBar } from "@/shell/TitleBar";
import { Dock } from "@/shell/Dock";
import { SessionView } from "@/views/SessionView";
import { McpView } from "@/views/McpView";
import { PreviewView } from "@/views/PreviewView";
import { SettingsView } from "@/views/SettingsView";
import { EditorPanel } from "@/editor/EditorPanel";
import { ThemePreview } from "@/theme/ThemePreview";
import { CommandPalette } from "@/palette/CommandPalette";
import { Onboarding } from "@/onboarding/Onboarding";
import { pickProjectFolder, basename } from "@/lib/project";
import type { DockId, OverlayId, Session } from "@/lib/types";
import { useSessionStats } from "@/meter/useSessionStats";

const ONBOARD_KEY = "daedalus.onboarded.v1";

const DOCK_META: Record<DockId, { title: string; icon: ReactNode }> = {
  editor: { title: "Files & Editor", icon: <FileCode size={13} /> },
  mcp: { title: "MCP Hub", icon: <Boxes size={13} /> },
  preview: { title: "Preview", icon: <MonitorSmartphone size={13} /> },
};

export default function App() {
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem(ONBOARD_KEY) === "1");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dock, setDock] = useState<DockId | null>(null);
  const [leftWidth, setLeftWidth] = useState(640);
  const [rightWidth, setRightWidth] = useState(580);
  const [overlay, setOverlay] = useState<OverlayId | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;
  const stats = useSessionStats(activeSession);

  const newSession = useCallback(async () => {
    const path = await pickProjectFolder();
    if (!path) return;
    const session: Session = { id: crypto.randomUUID(), title: basename(path), cwd: path };
    setSessions((prev) => [...prev, session]);
    setActiveId(session.id);
  }, []);

  const closeSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      setActiveId((cur) => (cur === id ? (next[next.length - 1]?.id ?? null) : cur));
      return next;
    });
  }, []);

  const toggleDock = useCallback((d: DockId) => {
    setOverlay(null);
    setDock((cur) => (cur === d ? null : d));
  }, []);

  const toggleOverlay = useCallback((o: OverlayId) => {
    setOverlay((cur) => (cur === o ? null : o));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if (e.key === "Escape") {
        setOverlay(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const finishOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARD_KEY, "1");
    setOnboarded(true);
  }, []);

  if (!onboarded) {
    return (
      <TooltipProvider>
        <Onboarding onDone={finishOnboarding} onOpenFolder={newSession} />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg text-text">
        <TitleBar
          sessions={sessions}
          activeId={activeId}
          onSelect={setActiveId}
          onClose={closeSession}
          onNew={newSession}
          onOpenPalette={() => setPaletteOpen(true)}
          stats={stats}
        />

        <div className="flex min-h-0 flex-1">
          <Rail dock={dock} onToggleDock={toggleDock} overlay={overlay} onToggleOverlay={toggleOverlay} />

          {/* Main area: terminal stays mounted (stable keys); editor docks left, MCP/Preview right */}
          <div className="relative min-w-0 flex-1">
            <div className="flex h-full">
              {dock === "editor" && (
                <Dock
                  key="leftdock"
                  side="left"
                  title={DOCK_META.editor.title}
                  icon={DOCK_META.editor.icon}
                  width={leftWidth}
                  onWidthChange={setLeftWidth}
                  onClose={() => setDock(null)}
                >
                  <EditorPanel session={activeSession} />
                </Dock>
              )}

              <div key="main" className="min-w-0 flex-1">
                <SessionView session={activeSession} onNew={newSession} />
              </div>

              {(dock === "mcp" || dock === "preview") && (
                <Dock
                  key="rightdock"
                  side="right"
                  title={DOCK_META[dock].title}
                  icon={DOCK_META[dock].icon}
                  width={rightWidth}
                  onWidthChange={setRightWidth}
                  onClose={() => setDock(null)}
                >
                  {dock === "mcp" && <McpView session={activeSession} />}
                  {dock === "preview" && <PreviewView />}
                </Dock>
              )}
            </div>

            {overlay && (
              <div className="absolute inset-0 z-40 bg-bg">
                <div className="flex h-9 items-center justify-end border-b border-border px-1.5">
                  <IconButton onClick={() => setOverlay(null)} aria-label="Close">
                    <X size={16} />
                  </IconButton>
                </div>
                <div className="h-[calc(100%-2.25rem)]">
                  {overlay === "settings" && <SettingsView />}
                  {overlay === "theme" && <ThemePreview />}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        sessions={sessions}
        onSelectSession={setActiveId}
        onNewSession={newSession}
        onOpenDock={toggleDock}
        onOpenOverlay={toggleOverlay}
      />
    </TooltipProvider>
  );
}
