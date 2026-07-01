import { useEffect, useState } from "react";
import { Check, FolderOpen, Loader2, TriangleAlert, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { invoke, isTauri } from "@/lib/tauri";

interface ClaudeVersion {
  is_installed?: boolean;
  version?: string;
  output?: string;
}

type Probe = { state: "checking" } | { state: "ok"; version?: string } | { state: "missing" };

export function Onboarding({
  onDone,
  onOpenFolder,
}: {
  onDone: () => void;
  onOpenFolder: () => Promise<void>;
}) {
  const [probe, setProbe] = useState<Probe>({ state: "checking" });
  const [step, setStep] = useState(0);
  const [openedFolder, setOpenedFolder] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!isTauri()) {
        if (alive) setProbe({ state: "ok", version: "browser preview" });
        return;
      }
      try {
        const res = await invoke<ClaudeVersion>("check_claude_version");
        if (!alive) return;
        if (res?.is_installed) setProbe({ state: "ok", version: res.version });
        else setProbe({ state: "missing" });
      } catch {
        if (alive) setProbe({ state: "missing" });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg text-text">
      <div className="w-[480px] overflow-hidden rounded-[var(--r-3)] border border-border bg-surface">
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-center gap-2">
            <span className="text-accent">◆</span>
            <span className="mono-label !text-text-secondary">DAEDALUS</span>
          </div>
          <h1 className="mt-3 text-[20px] text-text-emphasis">
            {step === 0 ? "Let's check your setup" : "Open your first project"}
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {step === 0
              ? "Daedalus runs the real Claude Code CLI. It must be installed and authenticated."
              : "Pick a folder — Daedalus opens a live claude session inside it."}
          </p>
        </div>

        <div className="px-6 py-5">
          {step === 0 ? (
            <PreflightRow probe={probe} />
          ) : (
            <div className="flex flex-col gap-3">
              <Button variant={openedFolder ? "outline" : "solid"} onClick={async () => {
                await onOpenFolder();
                setOpenedFolder(true);
              }}>
                <FolderOpen size={15} />
                {openedFolder ? "Choose a different folder" : "Open project folder"}
              </Button>
              {openedFolder && (
                <p className="flex items-center gap-2 text-[12px] text-text-muted">
                  <Check size={14} className="text-text" /> Session ready.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <div className="flex gap-1.5">
            {[0, 1].map((i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${i === step ? "bg-accent" : "bg-grey-600"}`}
              />
            ))}
          </div>
          {step === 0 ? (
            <div className="flex items-center gap-2">
              {probe.state === "missing" && (
                <button onClick={() => setStep(1)} className="text-[12px] text-text-disabled hover:text-text-muted">
                  Skip
                </button>
              )}
              <Button variant="solid" disabled={probe.state === "checking"} onClick={() => setStep(1)}>
                Continue
              </Button>
            </div>
          ) : (
            <Button variant="solid" onClick={onDone}>
              Enter Daedalus
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function PreflightRow({ probe }: { probe: Probe }) {
  if (probe.state === "checking") {
    return (
      <Row icon={<Loader2 size={16} className="animate-spin text-text-muted" />} title="Checking for the claude CLI…" />
    );
  }
  if (probe.state === "ok") {
    return (
      <Row
        icon={<Check size={16} className="text-text" />}
        title="Claude Code detected"
        subtitle={probe.version ? `Version ${probe.version}` : undefined}
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <Row
        icon={<TriangleAlert size={16} className="text-accent" />}
        title="Claude Code was not found on your PATH"
        subtitle="Install it, then reopen Daedalus."
      />
      <CopyLine text="npm install -g @anthropic-ai/claude-code" />
      <CopyLine text="claude   # sign in when prompted" />
    </div>
  );
}

function Row({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--r-2)] border border-border bg-surface-raised px-3 py-3">
      <span className="mt-0.5">{icon}</span>
      <div>
        <p className="text-[13px] text-text">{title}</p>
        {subtitle && <p className="text-[12px] text-text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

function CopyLine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
      className="flex items-center justify-between gap-2 rounded-[var(--r-2)] border border-border bg-bg px-3 py-2 text-left font-mono text-[12px] text-text-secondary hover:border-border-hover"
    >
      <span className="truncate">{text}</span>
      {copied ? <Check size={13} className="text-text" /> : <Copy size={13} className="text-text-disabled" />}
    </button>
  );
}
