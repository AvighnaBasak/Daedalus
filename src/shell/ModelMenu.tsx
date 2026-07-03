import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Cpu, Check, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ModelPicker } from "@/components/ModelPicker";
import { invoke, isTauri } from "@/lib/tauri";
import { useProvider, providerLabel } from "@/lib/provider";

const ANTHROPIC_MODELS: { id: string; label: string; note: string }[] = [
  { id: "opus", label: "Opus", note: "Most capable · priciest" },
  { id: "sonnet", label: "Sonnet", note: "Balanced default" },
  { id: "haiku", label: "Haiku", note: "Fastest · cheapest" },
];

/**
 * Per-session model switch — sends `/model <name>` to the live CLI. With a
 * subscription the Anthropic trio is offered; on Ollama/custom providers any
 * model name the endpoint serves can be typed in.
 */
export function ModelMenu({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const provider = useProvider();

  const choose = (id: string) => {
    if (!id.trim()) return;
    if (isTauri()) void invoke("pty_write", { id: sessionId, data: `/model ${id.trim()}\r` });
    setPicked(id.trim());
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button size="sm" variant="ghost">
          <Cpu size={13} />
          Model
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className={`glass elev-2 z-50 rounded-[var(--r-3)] border border-border-strong p-1.5 ${
            provider.kind === "subscription" ? "w-64" : "w-80"
          }`}
        >
          <div className="flex items-center justify-between px-2 py-1">
            <span className="mono-label">Switch model</span>
            <span className="text-[10px] text-text-disabled">{providerLabel(provider.kind)}</span>
          </div>

          {provider.kind === "subscription" ? (
            ANTHROPIC_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => choose(m.id)}
                className="flex w-full items-center gap-2 rounded-[var(--r-2)] px-2 py-1.5 text-left hover:bg-surface-raised"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-text">{m.label}</p>
                  <p className="text-[11px] text-text-muted">{m.note}</p>
                </div>
                {picked === m.id && <Check size={13} className="text-text" />}
              </button>
            ))
          ) : (
            <div className="flex flex-col gap-1.5 px-1 pb-1">
              {provider.model && (
                <button
                  onClick={() => choose(provider.model)}
                  className="flex w-full items-center gap-2 rounded-[var(--r-2)] px-2 py-1.5 text-left hover:bg-surface-raised"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[12px] text-text">{provider.model}</p>
                    <p className="text-[11px] text-text-muted">Provider default</p>
                  </div>
                  {picked === provider.model && <Check size={13} className="text-text" />}
                </button>
              )}

              {/* live catalog: everything the connected backend serves */}
              <ModelPicker config={provider} value={picked ?? provider.model} onPick={choose} maxHeight={200} />

              <div className="flex items-center gap-1.5">
                <input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && choose(custom)}
                  placeholder="…or type any model id"
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded-[var(--r-1)] border border-border bg-bg px-2 py-1.5 font-mono text-[11px] text-text outline-none placeholder:text-text-disabled focus:border-border-hover"
                />
                <button
                  onClick={() => choose(custom)}
                  disabled={!custom.trim()}
                  className="text-text-muted hover:text-text disabled:opacity-40"
                  aria-label="Switch"
                >
                  <CornerDownLeft size={14} />
                </button>
              </div>
              <p className="px-1 text-[10px] leading-snug text-text-disabled">
                Small models may struggle with agentic tool use — prefer 64k+ context coding models.
              </p>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
