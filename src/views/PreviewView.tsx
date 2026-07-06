import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  RotateCw, QrCode, Monitor, Smartphone, Globe, Zap, Plus, X, Loader2, ExternalLink, ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { listen, isTauri } from "@/lib/tauri";
import { startTunnel, stopTunnel, watchDir, unwatchDir, previewProbe } from "@/lib/features";
import type { Session } from "@/lib/types";

type Device = "desktop" | "iphone" | "android";
const SIZES: Record<Device, { w: number | null; h: number | null }> = {
  desktop: { w: null, h: null },
  iphone: { w: 390, h: 844 },
  android: { w: 360, h: 800 },
};

interface Tab {
  url: string;
  live: string;
}

function portOf(url: string): number {
  const m = url.match(/:(\d{2,5})/);
  return m ? parseInt(m[1], 10) : 3000;
}

// URL handed over before the panel mounted (terminal link / dev-server detection /
// bridge call while the dock was closed). Consumed once on mount.
let pendingUrl: string | null = null;
/** Queue a URL for the preview panel; App opens the dock right after. */
export function queuePreview(url: string) {
  pendingUrl = url;
  window.dispatchEvent(new CustomEvent("daedalus:preview-navigate", { detail: url }));
}

/** Server state behind the active tab — gates when the iframe mounts. */
type Probe = "checking" | "waiting" | "ok" | "blocked";

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

export function PreviewView({ session }: { session: Session | null }) {
  const [tabs, setTabs] = useState<Tab[]>(() => {
    const initial = pendingUrl ?? "http://localhost:3000";
    pendingUrl = null;
    return [{ url: initial, live: initial }];
  });
  const [active, setActive] = useState(0);
  const [device, setDevice] = useState<Device>("desktop");
  const [showQr, setShowQr] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [autoReload, setAutoReload] = useState(false);
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [tunneling, setTunneling] = useState(false);
  const [probe, setProbe] = useState<Probe>("checking");
  const tab = tabs[active];
  const size = SIZES[device];
  const activeRef = useRef(active);
  activeRef.current = active;

  const setUrl = (url: string) => setTabs((t) => t.map((x, i) => (i === active ? { ...x, url } : x)));
  const go = () => {
    setTabs((t) => t.map((x, i) => (i === active ? { ...x, live: x.url } : x)));
    setReloadKey((k) => k + 1);
  };
  const addTab = () => {
    setTabs((t) => [...t, { url: "http://localhost:3000", live: "http://localhost:3000" }]);
    setActive(tabs.length);
  };
  const closeTab = (i: number) => {
    if (tabs.length === 1) return;
    setTabs((t) => t.filter((_, idx) => idx !== i));
    setActive((a) => (a >= i && a > 0 ? a - 1 : a));
  };

  // Navigation pushed from outside: terminal links, dev-server detection, bridge.
  // Reuse a tab on the same origin, otherwise open a new one.
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const url = (e as CustomEvent<string>).detail;
      if (!url) return;
      pendingUrl = null; // we're mounted — consume it here
      setTabs((prev) => {
        const originOf = (u: string) => {
          try {
            return new URL(u).origin;
          } catch {
            return u;
          }
        };
        const idx = prev.findIndex((t) => originOf(t.live) === originOf(url));
        if (idx >= 0) {
          setActive(idx);
          return prev.map((t, i) => (i === idx ? { url, live: url } : t));
        }
        setActive(prev.length);
        return [...prev, { url, live: url }];
      });
      setReloadKey((k) => k + 1);
    };
    window.addEventListener("daedalus:preview-navigate", onNavigate);
    return () => window.removeEventListener("daedalus:preview-navigate", onNavigate);
  }, []);

  // Gate the iframe behind a reachability probe: a dev server that isn't up yet
  // gets a calm "waiting" state (retried until it appears) instead of WebView2's
  // "This content is blocked" page; sites that refuse framing get the truth.
  useEffect(() => {
    if (!isTauri()) {
      setProbe("ok");
      return;
    }
    let alive = true;
    setProbe("checking");
    (async () => {
      let delay = 700;
      while (alive) {
        try {
          const r = await previewProbe(tab.live);
          if (!alive) return;
          if (r.reachable) {
            setProbe(r.frame_blocked ? "blocked" : "ok");
            return;
          }
          setProbe("waiting");
        } catch {
          if (!alive) return;
          setProbe("waiting");
        }
        await new Promise((res) => setTimeout(res, delay));
        delay = Math.min(delay + 150, 2000);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tab.live, reloadKey]);

  // Auto-reload: watch the project dir and refresh on save.
  useEffect(() => {
    if (!autoReload || !session) return;
    let un: (() => void) | undefined;
    void watchDir(session.cwd).catch(() => {});
    listen("fs:changed", () => {
      if (activeRef.current >= 0) setReloadKey((k) => k + 1);
    }).then((u) => (un = u));
    return () => {
      un?.();
      void unwatchDir().catch(() => {});
    };
  }, [autoReload, session]);

  const toggleTunnel = async () => {
    if (tunnelUrl) {
      await stopTunnel().catch(() => {});
      setTunnelUrl(null);
      return;
    }
    setTunneling(true);
    try {
      setTunnelUrl(await startTunnel(portOf(tab.live)));
      setShowQr(true);
    } catch (e) {
      alert(String(e));
    } finally {
      setTunneling(false);
    }
  };

  const frame = (
    <iframe key={`${active}-${reloadKey}`} src={tab.live} title="Preview" className="h-full w-full border-0 bg-white" />
  );
  const gate =
    probe === "ok" ? (
      frame
    ) : probe === "blocked" ? (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg p-6 text-center">
        <ShieldAlert size={20} className="text-text-muted" />
        <p className="max-w-[300px] text-[12px] leading-relaxed text-text-muted">
          This site refuses to be embedded (X-Frame-Options / frame-ancestors), so the built-in
          preview can't show it.
        </p>
        <Button size="sm" variant="outline" onClick={() => void openExternal(tab.live)}>
          <ExternalLink size={13} />
          Open in browser
        </Button>
      </div>
    ) : (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg p-6 text-center">
        <Loader2 size={18} className="animate-spin text-text-muted" />
        <p className="max-w-[300px] text-[12px] leading-relaxed text-text-muted">
          {probe === "checking" ? (
            "Checking server…"
          ) : (
            <>
              Waiting for <span className="font-mono text-text-secondary">{tab.live}</span> — start
              your dev server and this connects automatically.
            </>
          )}
        </p>
      </div>
    );

  return (
    <div className="flex h-full flex-col bg-bg">
      {/* tab strip */}
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border px-2">
        {tabs.map((t, i) => (
          <div
            key={i}
            onClick={() => setActive(i)}
            className={cn(
              "group flex h-6 max-w-[160px] cursor-pointer items-center gap-1.5 rounded-[var(--r-1)] border px-2 text-[11px]",
              i === active ? "border-border-strong bg-surface-raised text-text" : "border-transparent text-text-muted hover:bg-overlay",
            )}
          >
            <Globe size={11} />
            <span className="truncate">{t.live.replace(/^https?:\/\//, "")}</span>
            {tabs.length > 1 && (
              <button onClick={(e) => { e.stopPropagation(); closeTab(i); }} className="opacity-0 group-hover:opacity-100 hover:text-accent">
                <X size={11} />
              </button>
            )}
          </div>
        ))}
        <button onClick={addTab} className="flex h-6 w-6 items-center justify-center rounded-[var(--r-1)] text-text-muted hover:bg-overlay hover:text-text">
          <Plus size={13} />
        </button>
      </div>

      {/* toolbar */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-2">
        <div className="flex items-center gap-1">
          <DeviceBtn active={device === "desktop"} onClick={() => setDevice("desktop")}><Monitor size={15} /></DeviceBtn>
          <DeviceBtn active={device === "iphone"} onClick={() => setDevice("iphone")}><Smartphone size={15} /></DeviceBtn>
          <DeviceBtn active={device === "android"} onClick={() => setDevice("android")}><Smartphone size={13} /></DeviceBtn>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); go(); }} className="flex min-w-0 flex-1 items-center gap-2">
          <input
            value={tab.url}
            onChange={(e) => setUrl(e.target.value)}
            spellCheck={false}
            className="min-w-0 flex-1 rounded-[var(--r-2)] border border-border bg-surface px-3 py-1.5 font-mono text-[12px] text-text outline-none focus:border-border-hover"
          />
          <Button size="sm" variant="ghost" type="submit" aria-label="Reload"><RotateCw size={13} /></Button>
        </form>
        <Button size="sm" variant="ghost" onClick={() => void openExternal(tab.live)} aria-label="Open in browser" title="Open in browser">
          <ExternalLink size={13} />
        </Button>
        <Button size="sm" variant={autoReload ? "solid" : "outline"} onClick={() => setAutoReload((v) => !v)} disabled={!session} title="Reload on file save">
          <Zap size={13} />
        </Button>
        <Button size="sm" variant={tunnelUrl ? "solid" : "outline"} onClick={toggleTunnel} disabled={tunneling}>
          {tunneling ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}
          {tunnelUrl ? "Tunnel on" : "Tunnel"}
        </Button>
        <Button size="sm" variant={showQr ? "solid" : "outline"} onClick={() => setShowQr((v) => !v)}>
          <QrCode size={13} />
        </Button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto">
        {device === "desktop" ? (
          <div className="h-full w-full p-3">
            <div className={cn("h-full w-full overflow-hidden rounded-[var(--r-2)] border border-border-strong", probe === "ok" ? "bg-white" : "bg-bg")}>
              {gate}
            </div>
          </div>
        ) : (
          <div className="flex min-h-full items-start justify-center p-6">
            <div className={cn("overflow-hidden rounded-[18px] border border-border-strong", probe === "ok" ? "bg-white" : "bg-bg")} style={{ width: size.w ?? undefined, height: size.h ?? undefined, flex: "0 0 auto" }}>
              {gate}
            </div>
          </div>
        )}

        {showQr && (
          <div className="absolute right-6 top-6 flex flex-col items-center gap-2 rounded-[var(--r-3)] border border-border bg-overlay p-4">
            <div className="rounded-[var(--r-2)] bg-white p-2">
              <QRCodeSVG value={tunnelUrl ?? tab.live} size={132} />
            </div>
            <p className="max-w-[170px] text-center text-[11px] text-text-muted">
              {tunnelUrl ? "Public tunnel — scan from anywhere." : "Local URL — same network only. Start a tunnel for public access."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DeviceBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-[var(--r-2)] transition-colors",
        active ? "bg-overlay text-text-emphasis" : "text-text-muted hover:bg-overlay hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
