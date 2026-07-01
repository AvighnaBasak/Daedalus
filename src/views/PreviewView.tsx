import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { RotateCw, QrCode, Monitor, Smartphone, Globe, Zap, Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { listen } from "@/lib/tauri";
import { startTunnel, stopTunnel, watchDir, unwatchDir } from "@/lib/features";
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

export function PreviewView({ session }: { session: Session | null }) {
  const [tabs, setTabs] = useState<Tab[]>([{ url: "http://localhost:3000", live: "http://localhost:3000" }]);
  const [active, setActive] = useState(0);
  const [device, setDevice] = useState<Device>("desktop");
  const [showQr, setShowQr] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [autoReload, setAutoReload] = useState(false);
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [tunneling, setTunneling] = useState(false);
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
            <div className="h-full w-full overflow-hidden rounded-[var(--r-2)] border border-border-strong bg-white">
              <iframe key={`${active}-${reloadKey}`} src={tab.live} title="Preview" className="h-full w-full border-0 bg-white" />
            </div>
          </div>
        ) : (
          <div className="flex min-h-full items-start justify-center p-6">
            <div className="overflow-hidden rounded-[18px] border border-border-strong bg-white" style={{ width: size.w ?? undefined, height: size.h ?? undefined, flex: "0 0 auto" }}>
              <iframe key={`${active}-${reloadKey}`} src={tab.live} title="Preview" className="h-full w-full border-0 bg-white" />
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
