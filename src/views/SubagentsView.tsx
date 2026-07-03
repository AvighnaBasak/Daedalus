import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusDot } from "@/components/ui/StatusDot";
import { spawnSubagent, killSubagent } from "@/lib/features";
import { listen, isTauri } from "@/lib/tauri";
import { cn } from "@/lib/cn";
import type { Session } from "@/lib/types";

interface Task {
  id: string;
  prompt: string;
  model: string;
  output: string[];
  state: "running" | "done" | "failed";
}

const MODELS = ["haiku", "sonnet", "opus"];

export function SubagentsView({ session }: { session: Session | null }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("haiku");
  const unlisteners = useRef<Map<string, Array<() => void>>>(new Map());

  useEffect(() => {
    const map = unlisteners.current;
    return () => {
      map.forEach((uns) => uns.forEach((u) => u()));
    };
  }, []);

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-text-muted">
        Open a session first — sub-agents run in its project folder.
      </div>
    );
  }

  const spawn = async () => {
    if (!prompt.trim() || !isTauri()) return;
    const id = crypto.randomUUID();
    const task: Task = { id, prompt: prompt.trim(), model, output: [], state: "running" };
    setTasks((t) => [task, ...t]);
    setPrompt("");

    const uns: Array<() => void> = [];
    uns.push(
      await listen<string>(`subagent:output:${id}`, (e) => {
        setTasks((t) =>
          t.map((x) => (x.id === id ? { ...x, output: [...x.output.slice(-400), e.payload] } : x)),
        );
      }),
    );
    uns.push(
      await listen<{ success: boolean }>(`subagent:exit:${id}`, (e) => {
        setTasks((t) =>
          t.map((x) => (x.id === id ? { ...x, state: e.payload.success ? "done" : "failed" } : x)),
        );
      }),
    );
    unlisteners.current.set(id, uns);

    try {
      await spawnSubagent(id, session.cwd, task.prompt, model);
    } catch (err) {
      setTasks((t) =>
        t.map((x) => (x.id === id ? { ...x, state: "failed", output: [String(err)] } : x)),
      );
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto max-w-3xl px-8 py-6">
        <span className="mono-label">Sub-agents</span>
        <h1 className="mt-1 text-[22px] text-text-emphasis">Headless tasks</h1>
        <p className="mt-1 text-[13px] text-text-muted">
          Fork a scoped, headless Claude run (tests, docs, refactor) in{" "}
          <span className="font-mono">{session.title}</span> without touching your main session's
          context. Default model is Haiku — cheap by design.
        </p>

        <div className="mt-5 rounded-[var(--r-2)] border border-border bg-surface-raised p-3 elev-1">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder="e.g. Write unit tests for src/lib/theme.ts and save them next to it"
            className="w-full resize-none rounded-[var(--r-1)] border border-border bg-bg px-2 py-1.5 text-[13px] text-text outline-none placeholder:text-text-disabled focus:border-border-hover"
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="flex rounded-[var(--r-1)] border border-border p-0.5">
              {MODELS.map((m) => (
                <button
                  key={m}
                  onClick={() => setModel(m)}
                  className={cn(
                    "rounded-[var(--r-1)] px-2.5 py-1 text-[12px] transition-colors",
                    model === m ? "bg-overlay text-text-emphasis" : "text-text-muted hover:text-text",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <Button size="sm" variant="solid" onClick={spawn} disabled={!prompt.trim()}>
              <Play size={13} />
              Spawn
            </Button>
          </div>
        </div>

        <ul className="mt-5 flex flex-col gap-3">
          {tasks.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Bot size={22} className="text-text-disabled" />
              <p className="text-[12px] text-text-muted">No sub-agents run yet.</p>
            </div>
          )}
          {tasks.map((t) => (
            <li key={t.id} className="rounded-[var(--r-2)] border border-border bg-surface elev-1">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                {t.state === "running" ? (
                  <Loader2 size={13} className="animate-spin text-text-muted" />
                ) : (
                  <StatusDot tone={t.state === "failed" ? "alert" : "ok"} />
                )}
                <span className="min-w-0 flex-1 truncate text-[13px] text-text">{t.prompt}</span>
                <span className="mono-label !text-[10px]">{t.model}</span>
                {t.state === "running" && (
                  <button
                    onClick={() => {
                      void killSubagent(t.id).catch(() => {});
                    }}
                    className="text-text-disabled hover:text-accent"
                    aria-label="Stop"
                  >
                    <Square size={12} />
                  </button>
                )}
              </div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-[11px] leading-relaxed text-text-secondary">
                {t.output.length ? t.output.join("\n") : t.state === "running" ? "Working…" : "(no output)"}
              </pre>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
