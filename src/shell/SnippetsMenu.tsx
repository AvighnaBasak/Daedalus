import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ClipboardList, ClipboardPaste, Plus, Trash2, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { invoke, isTauri } from "@/lib/tauri";

function keyFor(cwd: string) {
  return `daedalus.snippets.${cwd}`;
}
function load(cwd: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(keyFor(cwd)) ?? "[]");
  } catch {
    return [];
  }
}
function persist(cwd: string, list: string[]) {
  localStorage.setItem(keyFor(cwd), JSON.stringify(list.slice(0, 30)));
}

/** Per-project snippet history: capture from clipboard, paste into the live CLI. */
export function SnippetsMenu({ sessionId, cwd }: { sessionId: string; cwd: string }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  const refresh = () => setList(load(cwd));

  const add = (text: string) => {
    const t = text.trim();
    if (!t) return;
    const next = [t, ...load(cwd).filter((s) => s !== t)];
    persist(cwd, next);
    setList(next);
  };

  const fromClipboard = async () => {
    try {
      add(await navigator.clipboard.readText());
    } catch {
      /* clipboard permission */
    }
  };

  const paste = (text: string) => {
    if (isTauri()) void invoke("pty_write", { id: sessionId, data: text });
    setOpen(false);
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) refresh();
      }}
    >
      <Popover.Trigger asChild>
        <Button size="sm" variant="ghost">
          <ClipboardList size={13} />
          Snippets
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="glass elev-2 z-50 w-80 rounded-[var(--r-3)] border border-border-strong p-2 text-text"
        >
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="mono-label">Snippets</span>
            <Button size="sm" variant="outline" onClick={fromClipboard}>
              <ClipboardPaste size={12} />
              From clipboard
            </Button>
          </div>

          <div className="flex items-center gap-1.5 pb-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  add(draft);
                  setDraft("");
                }
              }}
              placeholder="New snippet…"
              className="min-w-0 flex-1 rounded-[var(--r-1)] border border-border bg-bg px-2 py-1.5 font-mono text-[11px] text-text outline-none placeholder:text-text-disabled focus:border-border-hover"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                add(draft);
                setDraft("");
              }}
              disabled={!draft.trim()}
            >
              <Plus size={13} />
            </Button>
          </div>

          {list.length === 0 ? (
            <p className="px-1 py-4 text-center text-[12px] text-text-muted">
              Nothing saved for this project yet.
            </p>
          ) : (
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {list.map((s, i) => (
                <li key={i} className="group flex items-center gap-2 rounded-[var(--r-2)] px-2 py-1.5 hover:bg-surface-raised">
                  <button onClick={() => paste(s)} className="min-w-0 flex-1 text-left" title="Paste into terminal">
                    <span className="block truncate font-mono text-[11px] text-text-secondary">{s}</span>
                  </button>
                  <CornerDownLeft size={11} className="shrink-0 text-text-disabled opacity-0 group-hover:opacity-100" />
                  <button
                    onClick={() => {
                      const next = load(cwd).filter((x) => x !== s);
                      persist(cwd, next);
                      setList(next);
                    }}
                    className="shrink-0 text-text-disabled opacity-0 hover:text-accent group-hover:opacity-100"
                    aria-label="Delete snippet"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
