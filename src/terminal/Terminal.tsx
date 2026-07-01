import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke, listen, isTauri } from "@/lib/tauri";
import { daedalusXtermTheme } from "./xtermTheme";
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

/**
 * Renders one interactive `claude` session. Spawns a real pty on the Rust side
 * and wires it bidirectionally to xterm. `sessionId` must be stable per session.
 * `onStatus` reports live activity (idle / working / attention) for the board.
 */
export function Terminal({
  sessionId,
  cwd,
  onStatus,
}: {
  sessionId: string;
  cwd: string;
  onStatus?: (status: SessionStatus) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const term = new XTerm({
      fontFamily: 'var(--font-mono), "JetBrains Mono", Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: "block",
      theme: daedalusXtermTheme,
      allowProposedApi: true,
      scrollback: 10000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(host);

    let disposed = false;
    const unlisteners: Array<() => void> = [];

    // ---- status detection ----
    const decoder = new TextDecoder();
    let recent = "";
    let lastStatus: SessionStatus = "idle";
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const emit = (s: SessionStatus) => {
      if (s !== lastStatus) {
        lastStatus = s;
        onStatusRef.current?.(s);
      }
    };
    const onChunk = (bytes: Uint8Array) => {
      recent = (recent + stripAnsi(decoder.decode(bytes, { stream: true }))).slice(-3000);
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
          await invoke("pty_spawn", { id: sessionId, cwd, cols: term.cols, rows: term.rows });
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

  return <div ref={hostRef} className="h-full w-full px-3 py-2" />;
}
