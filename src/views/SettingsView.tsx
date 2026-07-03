import { useCallback, useEffect, useState } from "react";
import { Loader2, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProviderEditor } from "@/components/ProviderEditor";
import { invoke, isTauri } from "@/lib/tauri";
import { getLeanContext, setLeanContext } from "@/lib/features";
import type { Session } from "@/lib/types";

interface ClaudeProbeResult {
  installed: boolean;
  version: string | null;
}

export function SettingsView({ session }: { session: Session | null }) {
  const [cli, setCli] = useState<{ state: "checking" | "installed" | "missing"; version?: string }>({
    state: "checking",
  });
  const [cliBusy, setCliBusy] = useState<null | "install" | "uninstall">(null);
  const [confirmUninstall, setConfirmUninstall] = useState(false);
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

  const recheck = useCallback(async () => {
    if (!isTauri()) {
      setCli({ state: "missing", version: undefined });
      return;
    }
    setCli({ state: "checking" });
    try {
      const res = await invoke<ClaudeProbeResult>("probe_claude");
      setCli(res.installed ? { state: "installed", version: res.version ?? undefined } : { state: "missing" });
    } catch {
      setCli({ state: "missing" });
    }
  }, []);

  useEffect(() => {
    void recheck();
  }, [recheck]);

  const npm = async (action: "install" | "uninstall") => {
    setCliBusy(action);
    setConfirmUninstall(false);
    try {
      await invoke<string>("run_scaffold", {
        command: "npm",
        args: [action, "-g", "@anthropic-ai/claude-code"],
        cwd: ".",
      });
    } catch {
      /* surfaced by re-probe below */
    } finally {
      setCliBusy(null);
      await recheck();
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto max-w-2xl px-8 py-8">
        <span className="mono-label">Settings</span>
        <h1 className="mt-1 text-[22px] text-text-emphasis">Preferences</h1>

        <div className="mt-6 flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-[var(--r-2)] border border-border bg-surface px-4 py-3">
            <div>
              <span className="text-[13px] text-text">Claude Code CLI</span>
              <p className="mt-0.5 text-[12px] text-text-muted">
                {cli.state === "checking" && "Checking…"}
                {cli.state === "installed" && `Installed${cli.version ? ` · v${cli.version}` : ""}`}
                {cli.state === "missing" && "Not found on this machine"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {cli.state === "missing" && (
                <Button size="sm" variant="solid" disabled={cliBusy !== null} onClick={() => npm("install")}>
                  {cliBusy === "install" ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  Install
                </Button>
              )}
              {cli.state === "installed" &&
                (confirmUninstall ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmUninstall(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" variant="danger" disabled={cliBusy !== null} onClick={() => npm("uninstall")}>
                      {cliBusy === "uninstall" ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      Confirm uninstall
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" disabled={cliBusy !== null} onClick={() => setConfirmUninstall(true)}>
                    <Trash2 size={13} />
                    Uninstall
                  </Button>
                ))}
            </div>
          </div>
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
