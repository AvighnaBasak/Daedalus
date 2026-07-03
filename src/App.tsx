import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { FileCode, GitCompare, Boxes, MonitorSmartphone, X, Loader2 } from "lucide-react";
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
import { VaultView } from "@/views/VaultView";
import { SubagentsView } from "@/views/SubagentsView";
import { loadTheme } from "@/lib/theme";
import { playAttention } from "@/lib/fx";
// Monaco-backed panels load lazily — keeps the initial bundle small and startup fast.
const EditorPanel = lazy(() =>
  import("@/editor/EditorPanel").then((m) => ({ default: m.EditorPanel })),
);
const GitPanel = lazy(() => import("@/views/GitPanel").then((m) => ({ default: m.GitPanel })));

function PanelLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 size={18} className="animate-spin text-text-muted" />
    </div>
  );
}
import { ThemePreview } from "@/theme/ThemePreview";
import { CommandPalette } from "@/palette/CommandPalette";
import { Onboarding } from "@/onboarding/Onboarding";
import { pickProjectFolder, basename } from "@/lib/project";
import { gitRepoRoot, gitCreateWorktree, gitRemoveWorktree } from "@/lib/git";
import { getProvider } from "@/lib/provider";
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
  const [focusMode, setFocusMode] = useState(false);
  const [fx, setFx] = useState(() => loadTheme());

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;
  const stats = useSessionStats(activeSession);

  // React to theme edits (grain/sound toggles) from the Theme view.
  useEffect(() => {
    const onTheme = () => setFx(loadTheme());
    window.addEventListener("daedalus:theme", onTheme);
    return () => window.removeEventListener("daedalus:theme", onTheme);
  }, []);

  const addSession = useCallback(async (session: Session) => {
    // Stamp the backend the pty will actually spawn with, so a later provider
    // change can surface a "restart to apply" prompt instead of silently lying.
    const p = await getProvider().catch(() => null);
    const stamped: Session = p
      ? { ...session, spawnedWith: { kind: p.kind, model: p.model, base_url: p.base_url } }
      : session;
    setSessions((prev) => [...prev, stamped]);
    setActiveId(stamped.id);
  }, []);

  // Kill the pty and respawn the same project on the current provider.
  const restartSession = useCallback(
    async (id: string) => {
      const s = sessions.find((x) => x.id === id);
      if (!s) return;
      setSessions((prev) => prev.filter((x) => x.id !== id));
      await addSession({ id: crypto.randomUUID(), title: s.title, cwd: s.cwd, worktree: s.worktree });
    },
    [sessions, addSession],
  );

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

  const setStatus = useCallback(
    (id: string, status: SessionStatus) => {
      setSessions((prev) => {
        const before = prev.find((s) => s.id === id)?.status;
        if (status === "attention" && before !== "attention" && fx.sound) playAttention();
        return prev.map((s) => (s.id === id ? { ...s, status, lastActivity: Date.now() } : s));
      });
    },
    [fx.sound],
  );

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
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFocusMode((f) => !f);
      }
      if (e.key === "Escape") {
        setOverlay(null);
        setFocusMode(false);
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
      {/* Thin accent frame around the whole app + optional film grain. */}
      <div className="flex h-screen w-screen flex-col overflow-hidden border border-accent bg-bg text-text">
        {fx.grain && <div className="grain pointer-events-none fixed inset-0 z-[90]" />}
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
          {!focusMode && (
            <Rail dock={dock} onToggleDock={toggleDock} overlay={overlay} onToggleOverlay={toggleOverlay} />
          )}

          <div className="relative min-w-0 flex-1">
            <div className="flex h-full">
              {!focusMode && dock === "editor" && (
                <Dock
                  key="leftdock"
                  side="left"
                  title={DOCK_META.editor.title}
                  icon={DOCK_META.editor.icon}
                  width={leftWidth}
                  onWidthChange={setLeftWidth}
                  onClose={() => setDock(null)}
                >
                  <Suspense fallback={<PanelLoading />}>
                    <EditorPanel session={activeSession} />
                  </Suspense>
                </Dock>
              )}

              <div key="main" className="min-w-0 flex-1">
                <SessionHost
                  sessions={sessions}
                  activeId={activeId}
                  onNew={newSession}
                  onStatus={setStatus}
                  onToggleFocus={() => setFocusMode((f) => !f)}
                  onRestart={restartSession}
                />
              </div>

              {!focusMode && (dock === "git" || dock === "mcp" || dock === "preview") && (
                <Dock
                  key="rightdock"
                  side="right"
                  title={DOCK_META[dock].title}
                  icon={DOCK_META[dock].icon}
                  width={rightWidth}
                  onWidthChange={setRightWidth}
                  onClose={() => setDock(null)}
                >
                  {dock === "git" && (
                    <Suspense fallback={<PanelLoading />}>
                      <GitPanel session={activeSession} />
                    </Suspense>
                  )}
                  {dock === "mcp" && <McpView session={activeSession} />}
                  {dock === "preview" && <PreviewView session={activeSession} />}
                </Dock>
              )}
            </div>

            {overlay && (
              <div className="glass-deep absolute inset-0 z-40">
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
                  {overlay === "vault" && <VaultView session={activeSession} />}
                  {overlay === "subagents" && <SubagentsView session={activeSession} />}
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
