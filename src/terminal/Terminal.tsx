import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke, listen, isTauri } from "@/lib/tauri";
import { daedalusXtermTheme, TERMINAL_FONT } from "./xtermTheme";
import { currentAccent, accentAlpha } from "@/lib/theme";
import type { SessionStatus } from "@/lib/types";

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Strip ANSI / control sequences so we can pattern-match the visible text.
function stripAnsi(s: string): string {
  return s
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, "")
    .replace(/\x1B\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

// Signature of a permission / plan prompt waiting on the user.
const ATTENTION = /❯\s*1\.\s*Yes|\bDo you want to\b|\bWould you like to\b|Ready to code\?/i;

/** A URL served from this machine — the built-in preview can show it. */
const LOCAL_URL = /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d{2,5})?/i;
/** Dev-server announcements in CLI output ("Local: http://localhost:5173/", …). */
const SERVER_URL = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{2,5})(?:\/\S*)?/gi;

/** 0.0.0.0 binds aren't navigable — rewrite to localhost. */
function normalizeLocalUrl(url: string): string {
  return url.replace(/\/\/0\.0\.0\.0(?=[:/]|$)/, "//localhost");
}

async function openExternal(url: string) {
  if (isTauri()) {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
      return;
    } catch (e) {
      console.error("openExternal failed:", e);
    }
  }
  window.open(url, "_blank", "noopener");
}

/**
 * Renders one interactive pty session — the `claude` CLI by default, or the
 * system shell for the bottom terminal panel (`program="shell"`). Spawns a real
 * pty on the Rust side and wires it bidirectionally to xterm. `sessionId` must
 * be stable per session. `onStatus` reports live activity for the board.
 */
export function Terminal({
  sessionId,
  cwd,
  launchArgs,
  program,
  onStatus,
}: {
  sessionId: string;
  cwd: string;
  /** Extra flags for the claude CLI at spawn, e.g. ["--continue"] to resume. */
  launchArgs?: string[];
  /** What runs in the pty: the claude CLI (default) or the system shell. */
  program?: "claude" | "shell";
  onStatus?: (status: SessionStatus) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  // Spawn-time only — changing these later must not restart the pty.
  const launchArgsRef = useRef(launchArgs);
  const programRef = useRef(program);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const isShell = programRef.current === "shell";

    const accent = currentAccent();
    const term = new XTerm({
      // Must be concrete font names — xterm's canvas measurer can't resolve var().
      fontFamily: TERMINAL_FONT,
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: "block",
      theme: {
        ...daedalusXtermTheme,
        cursor: accent,
        selectionBackground: accentAlpha(accent, 0.22),
        red: accent,
      },
      allowProposedApi: true,
      scrollback: 10000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    // Local URLs open in the built-in preview panel; everything else goes to the browser.
    term.loadAddon(
      new WebLinksAddon((_event, uri) => {
        if (LOCAL_URL.test(uri)) {
          window.dispatchEvent(
            new CustomEvent("daedalus:open-preview", { detail: normalizeLocalUrl(uri) }),
          );
        } else {
          void openExternal(uri);
        }
      }),
    );
    term.open(host);

    let disposed = false;
    const unlisteners: Array<() => void> = [];

    // ---- status + dev-server detection ----
    const decoder = new TextDecoder();
    let recent = "";
    let lastStatus: SessionStatus = "idle";
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const announced = new Set<string>();
    const emit = (s: SessionStatus) => {
      if (s !== lastStatus) {
        lastStatus = s;
        onStatusRef.current?.(s);
      }
    };
    const onChunk = (bytes: Uint8Array) => {
      recent = (recent + stripAnsi(decoder.decode(bytes, { stream: true }))).slice(-3000);
      // A dev server came up — surface it in the preview panel (once per origin).
      for (const m of recent.matchAll(SERVER_URL)) {
        try {
          const url = normalizeLocalUrl(new URL(m[0]).origin);
          if (!announced.has(url)) {
            announced.add(url);
            window.dispatchEvent(new CustomEvent("daedalus:server-detected", { detail: url }));
          }
        } catch {
          /* mangled URL fragment — ignore */
        }
      }
      if (isShell) return; // activity/attention tracking is for claude sessions
      if (ATTENTION.test(recent)) emit("attention");
      else emit("working");
      if (idleTimer) clearTimeout(idleTimer);
      // Fall back to idle after quiet — but keep "attention" pinned until new output.
      idleTimer = setTimeout(() => {
        if (lastStatus !== "attention") emit("idle");
      }, 2500);
    };

    const safeFit = () => {
      try {
        fit.fit();
      } catch {
        /* host not measured yet */
      }
    };
    safeFit();

    if (!isTauri()) {
      term.writeln("\x1b[90m  Daedalus — browser preview.\x1b[0m");
      term.writeln("\x1b[90m  The live claude session runs inside the desktop app.\x1b[0m");
    } else {
      (async () => {
        const unOut = await listen<string>(`pty:output:${sessionId}`, (e) => {
          const bytes = b64ToBytes(e.payload);
          term.write(bytes);
          onChunk(bytes);
        });
        const unExit = await listen<null>(`pty:exit:${sessionId}`, () => {
          term.writeln("\r\n\x1b[38;2;229;72;77m● session ended\x1b[0m");
          emit("idle");
        });
        unlisteners.push(unOut, unExit);

        term.onData((data) => {
          void invoke("pty_write", { id: sessionId, data });
          // User answered / typed → no longer waiting on us.
          if (lastStatus === "attention") emit("working");
        });

        if (disposed) return;
        try {
          await invoke("pty_spawn", {
            id: sessionId,
            cwd,
            cols: term.cols,
            rows: term.rows,
            args: launchArgsRef.current ?? null,
            program: programRef.current ?? null,
          });
        } catch (err) {
          term.writeln(`\r\n\x1b[38;2;229;72;77m● ${String(err)}\x1b[0m`);
        }
      })();
    }

    const ro = new ResizeObserver(() => {
      safeFit();
      if (isTauri()) {
        void invoke("pty_resize", { id: sessionId, cols: term.cols, rows: term.rows });
      }
    });
    ro.observe(host);

    return () => {
      disposed = true;
      if (idleTimer) clearTimeout(idleTimer);
      ro.disconnect();
      unlisteners.forEach((u) => u());
      if (isTauri()) void invoke("pty_kill", { id: sessionId });
      term.dispose();
    };
  }, [sessionId, cwd]);

  // Extra bottom padding keeps the CLI's input line off the window edge.
  return <div ref={hostRef} className="h-full w-full px-3 pb-5 pt-2" />;
}
