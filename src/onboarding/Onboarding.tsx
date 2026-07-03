import { useCallback, useEffect, useState } from "react";
import { Check, FolderOpen, Loader2, TriangleAlert, Copy, Download, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProviderEditor } from "@/components/ProviderEditor";
import { invoke, isTauri } from "@/lib/tauri";
import logo from "@/assets/logo.png";
import mark from "@/assets/appicon.png";

const DOCS_URL = "https://docs.anthropic.com/en/docs/claude-code/setup";

async function openDocs() {
  if (!isTauri()) {
    window.open(DOCS_URL, "_blank");
    return;
  }
  const { open } = await import("@tauri-apps/plugin-shell");
  await open(DOCS_URL);
}

interface ClaudeVersion {
  is_installed?: boolean;
  version?: string;
  output?: string;
}

type Probe = { state: "checking" } | { state: "ok"; version?: string } | { state: "missing" };

const STEPS = ["Setup", "Provider", "Project"] as const;

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

  const recheck = useCallback(async () => {
    if (!isTauri()) {
      setProbe({ state: "ok", version: "browser preview" });
      return;
    }
    setProbe({ state: "checking" });
    try {
      const res = await invoke<ClaudeVersion>("check_claude_version");
      if (res?.is_installed) setProbe({ state: "ok", version: res.version });
      else setProbe({ state: "missing" });
    } catch {
      setProbe({ state: "missing" });
    }
  }, []);

  useEffect(() => {
    void recheck();
  }, [recheck]);

  return (
    <div className="flex h-screen w-screen items-center justify-center border border-accent bg-bg text-text">
      <div className="elev-2 w-[560px] overflow-hidden rounded-[var(--r-3)] border border-border bg-surface">
        <div className="border-b border-border px-7 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <img src={mark} alt="" className="h-9 w-9 rounded-[var(--r-2)]" />
            <img src={logo} alt="Daedalus" className="h-5 opacity-90" />
          </div>
          <h1 className="mt-4 text-[20px] text-text-emphasis">
            {step === 0 && "Let's check your setup"}
            {step === 1 && "How should Claude Code think?"}
            {step === 2 && "Open your first project"}
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {step === 0 && "Daedalus runs the real Claude Code CLI. It must be installed first."}
            {step === 1 &&
              "Use your Claude subscription, a free local model via Ollama, or any API key — switchable later in Settings."}
            {step === 2 && "Pick a folder — Daedalus opens a live claude session inside it."}
          </p>
        </div>

        <div className="max-h-[52vh] overflow-y-auto px-7 py-5">
          {step === 0 && <PreflightRow probe={probe} onInstalled={recheck} />}
          {step === 1 && <ProviderEditor onSaved={() => setStep(2)} />}
          {step === 2 && (
            <div className="flex flex-col gap-3">
              <Button
                variant={openedFolder ? "outline" : "solid"}
                onClick={async () => {
                  await onOpenFolder();
                  setOpenedFolder(true);
                }}
              >
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

        <div className="flex items-center justify-between border-t border-border px-7 py-4">
          <div className="flex items-center gap-3">
            {STEPS.map((label, i) => (
              <button
                key={label}
                onClick={() => i < step && setStep(i)}
                className="flex items-center gap-1.5"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${i === step ? "bg-accent" : i < step ? "bg-grey-300" : "bg-grey-600"}`}
                />
                <span className={`text-[10px] ${i === step ? "text-text-secondary" : "text-text-disabled"}`}>
                  {label}
                </span>
              </button>
            ))}
          </div>

          {step === 0 && (
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
          )}
          {step === 1 && (
            <Button variant="ghost" onClick={() => setStep(2)}>
              Keep default & continue
            </Button>
          )}
          {step === 2 && (
            <Button variant="solid" onClick={onDone}>
              Enter Daedalus
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function PreflightRow({ probe, onInstalled }: { probe: Probe; onInstalled: () => Promise<void> }) {
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

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

  const install = async () => {
    setInstalling(true);
    setInstallError(null);
    // Open the official setup guide alongside the install.
    void openDocs().catch(() => {});
    try {
      await invoke<string>("run_scaffold", {
        command: "npm",
        args: ["install", "-g", "@anthropic-ai/claude-code"],
        cwd: ".",
      });
      await onInstalled();
    } catch (e) {
      setInstallError(String(e));
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Row
        icon={<TriangleAlert size={16} className="text-accent" />}
        title="Claude Code is required for Daedalus to work"
        subtitle="It's the engine under everything here. You do NOT need a Claude subscription — you can run it with Ollama (free, local) or open-source model APIs through Claude Code, so don't worry about cost. Install it now?"
      />

      {installing ? (
        <div className="flex items-center gap-2 rounded-[var(--r-2)] border border-border bg-bg px-3 py-2.5">
          <Loader2 size={14} className="animate-spin text-text-muted" />
          <span className="text-[12px] text-text-secondary">
            Installing via <span className="font-mono">npm install -g @anthropic-ai/claude-code</span> — the setup
            guide just opened in your browser…
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="solid" onClick={install}>
            <Download size={14} />
            Yes, install it for me
          </Button>
          <Button variant="ghost" onClick={() => setDeclined(true)}>
            No, I'll install it myself
          </Button>
          <button
            onClick={() => void openDocs()}
            className="ml-auto flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text"
          >
            <BookOpen size={13} />
            Setup guide
          </button>
        </div>
      )}

      {installError && (
        <p className="rounded-[var(--r-1)] border border-border bg-bg px-3 py-2 font-mono text-[11px] text-accent-hover">
          Install failed: {installError}
        </p>
      )}

      {(declined || installError) && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-text-muted">Run this in any terminal, then come back and re-check:</p>
          <CopyLine text="npm install -g @anthropic-ai/claude-code" />
          <Button size="sm" variant="outline" onClick={() => void onInstalled()} className="self-start">
            Re-check
          </Button>
        </div>
      )}

      <p className="text-[11px] leading-snug text-text-disabled">
        After installing: your first session opens the real Claude Code terminal, where you sign in (or skip
        sign-in entirely by picking Ollama / an API key in the next step).
      </p>
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
