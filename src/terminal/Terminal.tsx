import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke, listen, isTauri } from "@/lib/tauri";
import { daedalusXtermTheme } from "./xtermTheme";

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Renders one interactive `claude` session. Spawns a real pty on the Rust side
 * and wires it bidirectionally to xterm. `sessionId` must be stable per session.
 */
export function Terminal({ sessionId, cwd }: { sessionId: string; cwd: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

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
        // Stream pty output → xterm.
        const unOut = await listen<string>(`pty:output:${sessionId}`, (e) => {
          term.write(b64ToBytes(e.payload));
        });
        const unExit = await listen<null>(`pty:exit:${sessionId}`, () => {
          term.writeln("\r\n\x1b[38;2;229;72;77m● session ended\x1b[0m");
        });
        unlisteners.push(unOut, unExit);

        // Forward keystrokes → pty.
        term.onData((data) => {
          void invoke("pty_write", { id: sessionId, data });
        });

        if (disposed) return;
        try {
          await invoke("pty_spawn", {
            id: sessionId,
            cwd,
            cols: term.cols,
            rows: term.rows,
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
      ro.disconnect();
      unlisteners.forEach((u) => u());
      if (isTauri()) void invoke("pty_kill", { id: sessionId });
      term.dispose();
    };
  }, [sessionId, cwd]);

  return <div ref={hostRef} className="h-full w-full px-3 py-2" />;
}
