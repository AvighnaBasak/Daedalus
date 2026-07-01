import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { invoke, isTauri } from "@/lib/tauri";

interface ClaudeVersion {
  is_installed?: boolean;
  version?: string;
}

export function SettingsView() {
  const [version, setVersion] = useState<string>("checking…");

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
