import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ProviderEditor } from "@/components/ProviderEditor";
import { invoke, isTauri } from "@/lib/tauri";
import { getLeanContext, setLeanContext } from "@/lib/features";
import type { Session } from "@/lib/types";

interface ClaudeVersion {
  is_installed?: boolean;
  version?: string;
}

export function SettingsView({ session }: { session: Session | null }) {
  const [version, setVersion] = useState<string>("checking…");
  const [lean, setLean] = useState(false);

  useEffect(() => {
    if (session && isTauri()) getLeanContext(session.cwd).then(setLean).catch(() => setLean(false));
    else setLean(false);
  }, [session]);

  const toggleLean = async () => {
    if (!session) return;
    const next = !lean;
    setLean(next);
    try {
      await setLeanContext(session.cwd, next);
    } catch {
      setLean(!next);
    }
  };

  useEffect(() => {
    (async () => {
      if (!isTauri()) {
        setVersion("browser preview");
        return;
      }
      try {
        const res = await invoke<ClaudeVersion>("check_claude_version");
        setVersion(res?.is_installed ? (res.version ?? "installed") : "not found");
      } catch {
        setVersion("not found");
      }
    })();
  }, []);

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto max-w-2xl px-8 py-8">
        <span className="mono-label">Settings</span>
        <h1 className="mt-1 text-[22px] text-text-emphasis">Preferences</h1>

        <div className="mt-6 flex flex-col gap-3">
          <Field label="Claude Code" value={version} />
          <Field label="Daedalus" value="v0.1.0 · AGPL-3.0" />
        </div>

        <div className="mt-8">
          <h2 className="mono-label mb-3">Model provider</h2>
          <p className="mb-3 text-[12px] text-text-muted">
            Where Claude Code sends its requests. Changing it applies to <b>new</b> sessions
            (restart existing tabs to switch them over).
          </p>
          <ProviderEditor />
        </div>

        <div className="mt-8">
          <h2 className="mono-label mb-3">Lean context</h2>
          <div className="flex items-center justify-between rounded-[var(--r-2)] border border-border bg-surface px-4 py-3">
            <div className="min-w-0 pr-4">
              <p className="text-[13px] text-text">Keep Claude out of heavy directories</p>
              <p className="mt-0.5 text-[12px] text-text-muted">
                {session
                  ? "Denies Read on node_modules, dist, build, target, lockfiles… via .claude/settings.local.json."
                  : "Open a session to configure its context."}
              </p>
            </div>
            <button
              disabled={!session}
              onClick={toggleLean}
              aria-pressed={lean}
              className={
                "relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-40 " +
                (lean ? "bg-accent" : "bg-grey-600")
              }
            >
              <span
                className={
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all " +
                  (lean ? "left-[18px]" : "left-0.5")
                }
              />
            </button>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="mono-label mb-3">Onboarding</h2>
          <Button
            variant="outline"
            onClick={() => {
              localStorage.removeItem("daedalus.onboarded.v1");
              location.reload();
            }}
          >
            Re-run first-run setup
          </Button>
        </div>

        <p className="mt-10 text-[12px] text-text-disabled">
          Daedalus houses the Claude Code CLI, which remains an external dependency owned by Anthropic.
        </p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-[var(--r-2)] border border-border bg-surface px-4 py-3">
      <span className="text-[13px] text-text">{label}</span>
      <span className="tabular text-[12px] text-text-muted">{value}</span>
    </div>
  );
}
