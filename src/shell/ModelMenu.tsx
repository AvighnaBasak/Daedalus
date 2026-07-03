import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Cpu, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { invoke, isTauri } from "@/lib/tauri";

const MODELS: { id: string; label: string; note: string }[] = [
  { id: "opus", label: "Opus", note: "Most capable · priciest" },
  { id: "sonnet", label: "Sonnet", note: "Balanced default" },
  { id: "haiku", label: "Haiku", note: "Fastest · cheapest" },
];

/** Quick per-session model switch — sends `/model <name>` to the live CLI. */
export function ModelMenu({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const choose = (id: string) => {
    if (isTauri()) void invoke("pty_write", { id: sessionId, data: `/model ${id}\r` });
    setPicked(id);
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
          className="glass elev-2 z-50 w-56 rounded-[var(--r-3)] border border-border-strong p-1.5"
        >
          <span className="mono-label block px-2 py-1">Switch model</span>
          {MODELS.map((m) => (
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
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
