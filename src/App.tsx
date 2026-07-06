import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { FileCode, GitCompare, Boxes, MonitorSmartphone, X, Loader2, Bell } from "lucide-react";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { IconButton } from "@/components/ui/IconButton";
import { Rail } from "@/shell/Rail";
import { TitleBar } from "@/shell/TitleBar";
import { Dock } from "@/shell/Dock";
import { SessionHost } from "@/shell/SessionHost";
import { TerminalDock } from "@/shell/TerminalDock";
import { McpView } from "@/views/McpView";
import { PreviewView, queuePreview } from "@/views/PreviewView";
import { SettingsView } from "@/views/SettingsView";
import { BoardView } from "@/views/BoardView";
import { TemplatesView } from "@/views/TemplatesView";
import { CostView } from "@/views/CostView";
import { VaultView } from "@/views/VaultView";
import { SubagentsView } from "@/views/SubagentsView";
import { MarketView } from "@/views/MarketView";
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
import { pathExists } from "@/lib/features";
import { requestOpenFile } from "@/lib/openFileBus";
import { invoke, listen, isTauri } from "@/lib/tauri";
import { Button } from "@/components/ui/Button";
import { History } from "lucide-react";
import type { DockId, OverlayId, Session, SessionStatus, ShellTerm } from "@/lib/types";
import { useSessionStats } from "@/meter/useSessionStats";

const ONBOARD_KEY = "daedalus.onboarded.v1";
const LAST_PROJECT_KEY = "daedalus.lastProject";
const REOPEN_KEY = "daedalus.reopenLast";

const DOCK_META: Record<DockId, { title: string; icon: ReactNode }> = {
  editor: { title: "Files & Editor", icon: <FileCode size={13} /> },
  git: { title: "Git · Diff & History", icon: <GitCompare size={13} /> },
  mcp: { title: "MCP Hub", icon: <Boxes size={13} /> },
  preview: { title: "Preview", icon: <MonitorSmartphone size={13} /> },
};

/** Quote a dropped path for pasting into a terminal. */
function quotePath(p: string): string {
  return /\s/.test(p) ? `"${p}"` : p;
}

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
  // Folder with prior Claude history — asks "resume or start fresh?".
  const [resumePath, setResumePath] = useState<string | null>(null);
  // Bottom terminal panel: real system shells, all kept alive while collapsed.
  const [shellTerms, setShellTerms] = useState<ShellTerm[]>([]);
  const [termActive, setTermActive] = useState<string | null>(null);
  const [termOpen, setTermOpen] = useState(false);
  const [termHeight, setTermHeight] = useState(240);
  // Transient toast (bridge notifications, marketplace feedback).
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;
  const stats = useSessionStats(activeSession);

  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const activeCwdRef = useRef<string | null>(null);
  activeCwdRef.current = activeSession?.cwd ?? null;
  const termActiveRef = useRef(termActive);
  termActiveRef.current = termActive;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

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
    // Remember plain project sessions for reopen-on-launch (worktrees are transient).
    if (!stamped.worktree) localStorage.setItem(LAST_PROJECT_KEY, stamped.cwd);
  }, []);

  // Kill the pty and respawn the same project on the current provider,
  // resuming the conversation it was in the middle of when possible.
  const restartSession = useCallback(
    async (id: string) => {
      const s = sessions.find((x) => x.id === id);
      if (!s) return;
      setSessions((prev) => prev.filter((x) => x.id !== id));
      const canResume = isTauri()
        ? await invoke<boolean>("has_claude_history", { cwd: s.cwd }).catch(() => false)
        : false;
      await addSession({
        id: crypto.randomUUID(),
        title: s.title,
        cwd: s.cwd,
        worktree: s.worktree,
        launchArgs: canResume ? ["--continue"] : undefined,
      });
    },
    [sessions, addSession],
  );

  const newSession = useCallback(async () => {
    const path = await pickProjectFolder();
    if (!path) return;
    // Prior conversation in this folder? Offer `claude --continue`.
    const hasHistory = isTauri()
      ? await invoke<boolean>("has_claude_history", { cwd: path }).catch(() => false)
      : false;
    if (hasHistory) {
      setResumePath(path);
      return;
    }
    addSession({ id: crypto.randomUUID(), title: basename(path), cwd: path });
  }, [addSession]);

  const startSession = useCallback(
    (path: string, resume: boolean) => {
      setResumePath(null);
      addSession({
        id: crypto.randomUUID(),
        title: basename(path),
        cwd: path,
        launchArgs: resume ? ["--continue"] : undefined,
      });
    },
    [addSession],
  );

  // VS Code-style startup: reopen the last project (resuming its conversation)
  // unless the user turned it off in Settings.
  const reopened = useRef(false);
  useEffect(() => {
    if (reopened.current || !onboarded || !isTauri()) return;
    reopened.current = true;
    if (localStorage.getItem(REOPEN_KEY) === "0") return;
    const last = localStorage.getItem(LAST_PROJECT_KEY);
    if (!last) return;
    (async () => {
      if (!(await pathExists(last).catch(() => false))) return;
      const hasHistory = await invoke<boolean>("has_claude_history", { cwd: last }).catch(() => false);
      startSession(last, hasHistory);
    })();
  }, [onboarded, startSession]);

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

  // ---- bottom terminal panel ----
  const newShellTerm = useCallback(async () => {
    let cwd = activeCwdRef.current;
    if (!cwd) cwd = await invoke<string>("get_home_directory").catch(() => null as unknown as string);
    if (!cwd) cwd = ".";
    const id = crypto.randomUUID();
    setShellTerms((prev) => [...prev, { id, cwd: cwd!, title: basename(cwd!) || "shell" }]);
    setTermActive(id);
    setTermOpen(true);
  }, []);

  const closeShellTerm = useCallback((id: string) => {
    setShellTerms((prev) => {
      const next = prev.filter((t) => t.id !== id);
      setTermActive((cur) => (cur === id ? (next[next.length - 1]?.id ?? null) : cur));
      if (next.length === 0) setTermOpen(false);
      return next;
    });
  }, []);

  const shellTermsRef = useRef(shellTerms);
  shellTermsRef.current = shellTerms;
  const termOpenRef = useRef(termOpen);
  termOpenRef.current = termOpen;

  const toggleTerm = useCallback(() => {
    if (!termOpenRef.current && shellTermsRef.current.length === 0) {
      void newShellTerm(); // creates the first shell and opens the panel
      return;
    }
    setTermOpen((o) => !o);
  }, [newShellTerm]);

  /** Open (never close) the panel — used by the bridge and dev-server events. */
  const openTerminalPanel = useCallback(() => {
    if (shellTermsRef.current.length === 0) {
      void newShellTerm();
      return;
    }
    setTermOpen(true);
  }, [newShellTerm]);

  // ---- preview routing: terminal links, dev-server detection, bridge ----
  const openPreview = useCallback((url: string) => {
    queuePreview(url);
    setOverlay(null);
    setDock("preview");
  }, []);

  useEffect(() => {
    // Clicked localhost link in any terminal → show it in the preview dock.
    const onOpenPreview = (e: Event) => openPreview((e as CustomEvent<string>).detail);
    // A dev server came up → auto-open the preview once per URL (don't keep
    // stealing the dock if the user closed it).
    const seen = new Set<string>();
    const onServer = (e: Event) => {
      const url = (e as CustomEvent<string>).detail;
      if (seen.has(url)) return;
      seen.add(url);
      openPreview(url);
      showToast(`Dev server detected — previewing ${url}`);
    };
    window.addEventListener("daedalus:open-preview", onOpenPreview);
    window.addEventListener("daedalus:server-detected", onServer);
    return () => {
      window.removeEventListener("daedalus:open-preview", onOpenPreview);
      window.removeEventListener("daedalus:server-detected", onServer);
    };
  }, [openPreview, showToast]);

  // Claude drives the house: bridge events raised by the CLI via curl.
  useEffect(() => {
    if (!isTauri()) return;
    const unlisteners: Array<() => void> = [];
    void listen<string>("bridge:preview", (e) => openPreview(e.payload)).then((u) => unlisteners.push(u));
    void listen<string>("bridge:open", (e) => {
      setOverlay(null);
      setDock("editor");
      requestOpenFile(e.payload);
    }).then((u) => unlisteners.push(u));
    void listen<string>("bridge:notify", (e) => {
      showToast(e.payload || "Claude pinged you");
      if (fx.sound) playAttention();
    }).then((u) => unlisteners.push(u));
    void listen<null>("bridge:terminal", openTerminalPanel).then((u) => unlisteners.push(u));
    return () => unlisteners.forEach((u) => u());
  }, [openPreview, showToast, fx.sound, openTerminalPanel]);

  // ---- drag & drop: paths land in the terminal (or open in the editor) ----
  useEffect(() => {
    if (!isTauri()) return;
    let un: (() => void) | undefined;
    (async () => {
      const { getCurrentWebview } = await import("@tauri-apps/api/webview");
      un = await getCurrentWebview().onDragDropEvent((event) => {
        if (event.payload.type !== "drop" || event.payload.paths.length === 0) return;
        const { paths, position } = event.payload;
        // Physical → CSS pixels for hit-testing the drop target.
        const scale = window.devicePixelRatio || 1;
        const el = document.elementFromPoint(position.x / scale, position.y / scale);
        const zone = el?.closest("[data-drop]")?.getAttribute("data-drop");
        if (zone === "editor") {
          requestOpenFile(paths[0]);
          return;
        }
        const targetId =
          zone === "shell" ? termActiveRef.current : activeIdRef.current ?? termActiveRef.current;
        if (!targetId) return;
        const text = paths.map(quotePath).join(" ") + " ";
        void invoke("pty_write", { id: targetId, data: text });
      });
    })();
    return () => un?.();
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
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFocusMode((f) => !f);
      }
      // VS Code muscle memory: Ctrl+` / Ctrl+J toggles the terminal panel.
      if ((e.metaKey || e.ctrlKey) && (e.key === "`" || e.key.toLowerCase() === "j")) {
        e.preventDefault();
        toggleTerm();
      }
      if (e.key === "Escape") {
        setOverlay(null);
        setFocusMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleTerm]);

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
                  <div data-drop="editor" className="h-full">
                    <Suspense fallback={<PanelLoading />}>
                      <EditorPanel session={activeSession} />
                    </Suspense>
                  </div>
                </Dock>
              )}

              <div key="main" className="flex min-w-0 flex-1 flex-col">
                <div className="min-h-0 flex-1">
                  <SessionHost
                    sessions={sessions}
                    activeId={activeId}
                    onNew={newSession}
                    onStatus={setStatus}
                    onToggleFocus={() => setFocusMode((f) => !f)}
                    onRestart={restartSession}
                    onToggleTerminal={toggleTerm}
                  />
                </div>
                <TerminalDock
                  terms={shellTerms}
                  activeId={termActive}
                  open={termOpen}
                  height={termHeight}
                  onHeightChange={setTermHeight}
                  onSelect={setTermActive}
                  onNew={() => void newShellTerm()}
                  onCloseTerm={closeShellTerm}
                  onToggle={toggleTerm}
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
                  {overlay === "market" && <MarketView session={activeSession} />}
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

      {/* Toast — bridge notifications and quick feedback. */}
      {toast && (
        <div className="elev-2 fixed bottom-4 right-4 z-[95] flex max-w-[380px] items-center gap-2.5 rounded-[var(--r-2)] border border-border-strong bg-overlay px-3.5 py-2.5">
          <Bell size={13} className="shrink-0 text-accent" />
          <p className="min-w-0 flex-1 truncate text-[12px] text-text">{toast}</p>
          <button onClick={() => setToast(null)} className="shrink-0 text-text-disabled hover:text-text" aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Resume-or-fresh prompt when a picked folder has prior Claude history */}
      {resumePath && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60">
          <div className="elev-2 w-[420px] max-w-[90vw] rounded-[var(--r-3)] border border-border-strong bg-surface p-5">
            <div className="flex items-center gap-2.5">
              <History size={16} className="text-text-muted" />
              <h2 className="text-[15px] text-text-emphasis">Previous session found</h2>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-text-muted">
              Claude has an earlier conversation in{" "}
              <span className="font-mono text-text-secondary">{basename(resumePath)}</span>. Pick up
              where you left off, or start clean?
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setResumePath(null)}
                className="mr-auto text-[12px] text-text-disabled hover:text-text-muted"
              >
                Cancel
              </button>
              <Button variant="outline" onClick={() => startSession(resumePath, false)}>
                Start fresh
              </Button>
              <Button variant="solid" onClick={() => startSession(resumePath, true)}>
                <History size={13} />
                Resume last conversation
              </Button>
            </div>
          </div>
        </div>
      )}

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        sessions={sessions}
        onSelectSession={setActiveId}
        onNewSession={newSession}
        onOpenDock={toggleDock}
        onOpenOverlay={toggleOverlay}
        onToggleTerminal={toggleTerm}
      />
    </TooltipProvider>
  );
}
