import { useCallback, useEffect, useState, type ReactNode } from "react";
import { FileCode, GitCompare, Boxes, MonitorSmartphone, X } from "lucide-react";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { IconButton } from "@/components/ui/IconButton";
import { Rail } from "@/shell/Rail";
import { TitleBar } from "@/shell/TitleBar";
import { Dock } from "@/shell/Dock";
import { SessionHost } from "@/shell/SessionHost";
import { McpView } from "@/views/McpView";
import { PreviewView } from "@/views/PreviewView";
import { SettingsView } from "@/views/SettingsView";
import { BoardView } from "@/views/BoardView";
import { TemplatesView } from "@/views/TemplatesView";
import { CostView } from "@/views/CostView";
import { EditorPanel } from "@/editor/EditorPanel";
import { GitPanel } from "@/views/GitPanel";
import { ThemePreview } from "@/theme/ThemePreview";
import { CommandPalette } from "@/palette/CommandPalette";
import { Onboarding } from "@/onboarding/Onboarding";
import { pickProjectFolder, basename } from "@/lib/project";
import { gitRepoRoot, gitCreateWorktree, gitRemoveWorktree } from "@/lib/git";
import type { DockId, OverlayId, Session, SessionStatus } from "@/lib/types";
import { useSessionStats } from "@/meter/useSessionStats";

const ONBOARD_KEY = "daedalus.onboarded.v1";

const DOCK_META: Record<DockId, { title: string; icon: ReactNode }> = {
  editor: { title: "Files & Editor", icon: <FileCode size={13} /> },
  git: { title: "Git · Diff & History", icon: <GitCompare size={13} /> },
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

  const addSession = useCallback((session: Session) => {
    setSessions((prev) => [...prev, session]);
    setActiveId(session.id);
  }, []);

  const newSession = useCallback(async () => {
    const path = await pickProjectFolder();
    if (!path) return;
    addSession({ id: crypto.randomUUID(), title: basename(path), cwd: path });
  }, [addSession]);

  // New session on an isolated git worktree so parallel agents never collide.
  const newIsolatedSession = useCallback(async () => {
    const path = await pickProjectFolder();
    if (!path) return;
    const repo = await gitRepoRoot(path).catch(() => null);
    if (!repo) {
      // Not a git repo — fall back to a plain session.
      addSession({ id: crypto.randomUUID(), title: basename(path), cwd: path });
      return;
    }
    const branch = `agent-${Date.now().toString(36).slice(-5)}`;
    try {
      const worktreePath = await gitCreateWorktree(repo, branch);
      addSession({
        id: crypto.randomUUID(),
        title: `${basename(repo)} · ${branch}`,
        cwd: worktreePath,
        worktree: { repoPath: repo, branch, path: worktreePath },
      });
    } catch {
      addSession({ id: crypto.randomUUID(), title: basename(path), cwd: path });
    }
  }, [addSession]);

  const closeSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      setActiveId((cur) => (cur === id ? (next[next.length - 1]?.id ?? null) : cur));
      return next;
    });
  }, []);

  const removeWorktree = useCallback(
    async (session: Session) => {
      if (!session.worktree) return;
      await gitRemoveWorktree(session.worktree.repoPath, session.worktree.path).catch(() => {});
      closeSession(session.id);
    },
    [closeSession],
  );

  const setStatus = useCallback((id: string, status: SessionStatus) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status, lastActivity: Date.now() } : s)),
    );
  }, []);

  const toggleDock = useCallback((d: DockId) => {
    setOverlay(null);
    setDock((cur) => (cur === d ? null : d));
  }, []);

  const toggleOverlay = useCallback((o: OverlayId) => {
    setOverlay((cur) => (cur === o ? null : o));
  }, []);

  const focusSession = useCallback((id: string) => {
    setActiveId(id);
    setOverlay(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if (e.key === "Escape") setOverlay(null);
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
                <SessionHost sessions={sessions} activeId={activeId} onNew={newSession} onStatus={setStatus} />
              </div>

              {(dock === "git" || dock === "mcp" || dock === "preview") && (
                <Dock
                  key="rightdock"
                  side="right"
                  title={DOCK_META[dock].title}
                  icon={DOCK_META[dock].icon}
                  width={rightWidth}
                  onWidthChange={setRightWidth}
                  onClose={() => setDock(null)}
                >
                  {dock === "git" && <GitPanel session={activeSession} />}
                  {dock === "mcp" && <McpView session={activeSession} />}
                  {dock === "preview" && <PreviewView session={activeSession} />}
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
                  {overlay === "board" && (
                    <BoardView
                      sessions={sessions}
                      activeId={activeId}
                      onFocus={focusSession}
                      onNew={newSession}
                      onNewIsolated={newIsolatedSession}
                      onRemoveWorktree={removeWorktree}
                      onClose={closeSession}
                    />
                  )}
                  {overlay === "templates" && (
                    <TemplatesView
                      onScaffolded={(s) => {
                        addSession(s);
                        setOverlay(null);
                      }}
                    />
                  )}
                  {overlay === "cost" && <CostView />}
                  {overlay === "settings" && <SettingsView session={activeSession} />}
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
