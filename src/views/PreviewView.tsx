import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { RotateCw, QrCode, Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type Device = "desktop" | "iphone" | "android";
const SIZES: Record<Device, { w: number | null; h: number | null; label: string }> = {
  desktop: { w: null, h: null, label: "Desktop" },
  iphone: { w: 390, h: 844, label: "iPhone" },
  android: { w: 360, h: 800, label: "Android" },
};

export function PreviewView() {
  const [url, setUrl] = useState("http://localhost:3000");
  const [live, setLive] = useState("http://localhost:3000");
  const [device, setDevice] = useState<Device>("desktop");
  const [showQr, setShowQr] = useState(false);
  const [nonce, setNonce] = useState(0);

  const go = () => {
    setLive(url);
    setNonce((n) => n + 1);
  };
  const size = SIZES[device];

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <div className="flex items-center gap-1">
          <DeviceBtn active={device === "desktop"} onClick={() => setDevice("desktop")}>
            <Monitor size={15} />
          </DeviceBtn>
          <DeviceBtn active={device === "iphone"} onClick={() => setDevice("iphone")}>
            <Smartphone size={15} />
          </DeviceBtn>
          <DeviceBtn active={device === "android"} onClick={() => setDevice("android")}>
            <Smartphone size={13} />
          </DeviceBtn>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            go();
          }}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            spellCheck={false}
            className="min-w-0 flex-1 rounded-[var(--r-2)] border border-border bg-surface px-3 py-1.5 font-mono text-[12px] text-text outline-none focus:border-border-hover"
          />
          <Button size="sm" variant="ghost" type="submit" aria-label="Reload">
            <RotateCw size={13} />
          </Button>
        </form>
        <Button size="sm" variant={showQr ? "solid" : "outline"} onClick={() => setShowQr((v) => !v)}>
          <QrCode size={13} />
          QR
        </Button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto">
        {device === "desktop" ? (
          <div className="h-full w-full p-3">
            <div className="h-full w-full overflow-hidden rounded-[var(--r-2)] border border-border-strong bg-white">
              <iframe key={nonce} src={live} title="Preview" className="h-full w-full border-0 bg-white" />
            </div>
          </div>
        ) : (
          <div className="flex min-h-full items-start justify-center p-6">
            <div
              className="overflow-hidden rounded-[18px] border border-border-strong bg-white"
              style={{ width: size.w ?? undefined, height: size.h ?? undefined, flex: "0 0 auto" }}
            >
              <iframe key={nonce} src={live} title="Preview" className="h-full w-full border-0 bg-white" />
            </div>
          </div>
        )}

        {showQr && (
          <div className="absolute right-6 top-6 flex flex-col items-center gap-2 rounded-[var(--r-3)] border border-border bg-overlay p-4">
            <div className="rounded-[var(--r-2)] bg-white p-2">
              <QRCodeSVG value={live} size={132} />
            </div>
            <p className="max-w-[160px] text-center text-[11px] text-text-muted">
              Scan on the same network. Public tunnel (cloudflared) lands in v1.1.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DeviceBtn({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
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
