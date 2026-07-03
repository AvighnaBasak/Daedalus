import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Boxes, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusDot } from "@/components/ui/StatusDot";
import { invoke, isTauri } from "@/lib/tauri";
import { cn } from "@/lib/cn";
import type { Session } from "@/lib/types";

interface ServerStatus {
  running: boolean;
  error: string | null;
}
interface MCPServer {
  name: string;
  transport: string;
  scope: string;
  is_active: boolean;
  status: ServerStatus;
}
interface AddServerResult {
  success: boolean;
  message: string;
}

type Load =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; servers: MCPServer[] };

type Transport = "stdio" | "sse";
type Scope = "local" | "user";

/** Curated one-click installs for the most-used MCP servers. */
const POPULAR: { name: string; note: string; command: string; args: string[] }[] = [
  { name: "filesystem", note: "Read/write scoped project files", command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "."] },
  { name: "memory", note: "Persistent knowledge graph memory", command: "npx", args: ["-y", "@modelcontextprotocol/server-memory"] },
  { name: "github", note: "Repos, issues, PRs (needs token)", command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
  { name: "playwright", note: "Drive a real browser", command: "npx", args: ["-y", "@playwright/mcp@latest"] },
  { name: "puppeteer", note: "Headless Chrome automation", command: "npx", args: ["-y", "@modelcontextprotocol/server-puppeteer"] },
];

export function McpView({ session }: { session: Session | null }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    setLoad({ state: "loading" });
    if (!isTauri()) {
      setLoad({ state: "ready", servers: [] });
      return;
    }
    try {
      const servers = await invoke<MCPServer[]>("mcp_list");
      setLoad({ state: "ready", servers: Array.isArray(servers) ? servers : [] });
    } catch (e) {
      setLoad({ state: "error", message: String(e) });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = async (name: string) => {
    try {
      await invoke<string>("mcp_remove", { name });
      await refresh();
    } catch (e) {
      setLoad({ state: "error", message: String(e) });
    }
  };

  const [quickBusy, setQuickBusy] = useState<string | null>(null);
  const quickAdd = async (p: (typeof POPULAR)[number]) => {
    setQuickBusy(p.name);
    try {
      await invoke<AddServerResult>("mcp_add", {
        name: p.name,
        transport: "stdio",
        command: p.command,
        args: p.args,
        env: {},
        url: null,
        scope: "local",
      });
      await refresh();
    } catch (e) {
      setLoad({ state: "error", message: String(e) });
    } finally {
      setQuickBusy(null);
    }
  };

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="truncate text-[11px] text-text-disabled">
          {session ? session.title : "global scope"}
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={refresh}>
            <RefreshCw size={13} />
            Refresh
          </Button>
          <Button size="sm" variant={adding ? "outline" : "solid"} onClick={() => setAdding((v) => !v)}>
            {adding ? <X size={13} /> : <Plus size={13} />}
            {adding ? "Cancel" : "Add server"}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {adding && (
          <AddServerForm
            onDone={async () => {
              setAdding(false);
              await refresh();
            }}
          />
        )}

        {load.state === "loading" && <p className="text-[13px] text-text-muted">Loading MCP servers…</p>}
        {load.state === "error" && (
          <div className="rounded-[var(--r-2)] border border-border bg-surface-raised p-4">
            <p className="text-[13px] text-text">Couldn't read MCP configuration</p>
            <p className="mt-1 font-mono text-[12px] text-text-muted">{load.message}</p>
          </div>
        )}
        {load.state === "ready" && load.servers.length === 0 && !adding && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-[var(--r-3)] border border-border text-text-muted">
              <Boxes size={20} />
            </div>
            <p className="text-[14px] text-text">No MCP servers configured</p>
            <p className="max-w-xs text-[12px] text-text-muted">
              Connect tools like filesystem, GitHub, or Playwright to give Claude more capabilities.
            </p>
          </div>
        )}
        {/* one-click popular installs */}
        {load.state === "ready" && (
          <div className="mb-4">
            <p className="mono-label mb-2">Popular servers</p>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR.filter((p) => !load.servers.some((s) => s.name === p.name)).map((p) => (
                <button
                  key={p.name}
                  onClick={() => quickAdd(p)}
                  disabled={quickBusy !== null}
                  title={`${p.note} — ${p.command} ${p.args.join(" ")}`}
                  className="flex items-center gap-1.5 rounded-[var(--r-2)] border border-border bg-surface px-2.5 py-1.5 text-[12px] text-text-secondary transition-colors hover:border-border-hover hover:text-text disabled:opacity-50"
                >
                  <Plus size={11} className="text-text-disabled" />
                  {quickBusy === p.name ? "Adding…" : p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {load.state === "ready" && load.servers.length > 0 && (
          <ul className="flex flex-col gap-2">
            {load.servers.map((s) => (
              <li
                key={`${s.scope}:${s.name}`}
                className="group flex items-center gap-3 rounded-[var(--r-2)] border border-border bg-surface px-3.5 py-3 hover:border-border-hover"
              >
                <StatusDot tone={s.status.running ? "ok" : s.status.error ? "alert" : "idle"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-text">{s.name}</p>
                  <p className="truncate text-[11px] text-text-muted">
                    {s.transport} · {s.scope}
                    {s.status.error ? ` · ${s.status.error}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => remove(s.name)}
                  className="text-text-disabled opacity-0 transition hover:text-accent group-hover:opacity-100"
                  aria-label={`Remove ${s.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AddServerForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [transport, setTransport] = useState<Transport>("stdio");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("");
  const [scope, setScope] = useState<Scope>("local");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    name.trim().length > 0 && (transport === "stdio" ? command.trim().length > 0 : url.trim().length > 0);

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await invoke<AddServerResult>("mcp_add", {
        name: name.trim(),
        transport,
        command: transport === "stdio" ? command.trim() : null,
        args: transport === "stdio" ? args.trim().split(/\s+/).filter(Boolean) : [],
        env: {},
        url: transport === "sse" ? url.trim() : null,
        scope,
      });
      if (res.success) onDone();
      else setError(res.message || "Failed to add server");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-[var(--r-2)] border border-border bg-surface-raised p-3">
      <div className="flex flex-col gap-2.5">
        <Field label="Name">
          <Input value={name} onChange={setName} placeholder="e.g. filesystem" autoFocus />
        </Field>
        <Field label="Transport">
          <Segmented options={["stdio", "sse"]} value={transport} onChange={(v) => setTransport(v as Transport)} />
        </Field>
        {transport === "stdio" ? (
          <>
            <Field label="Command">
              <Input value={command} onChange={setCommand} placeholder="npx" />
            </Field>
            <Field label="Args">
              <Input value={args} onChange={setArgs} placeholder="-y @modelcontextprotocol/server-filesystem ." />
            </Field>
          </>
        ) : (
          <Field label="URL">
            <Input value={url} onChange={setUrl} placeholder="https://example.com/sse" />
          </Field>
        )}
        <Field label="Scope">
          <Segmented options={["local", "user"]} value={scope} onChange={(v) => setScope(v as Scope)} />
        </Field>

        {error && <p className="font-mono text-[11px] text-accent-hover">{error}</p>}

        <div className="mt-1 flex justify-end">
          <Button size="sm" variant="solid" disabled={!canSubmit || busy} onClick={submit}>
            {busy ? "Adding…" : "Add server"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="mono-label !text-[10px]">{label}</span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      value={value}
      autoFocus={autoFocus}
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="rounded-[var(--r-1)] border border-border bg-bg px-2 py-1.5 font-mono text-[12px] text-text outline-none placeholder:text-text-disabled focus:border-border-hover"
    />
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex w-fit rounded-[var(--r-1)] border border-border p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-[var(--r-1)] px-2.5 py-1 text-[12px] transition-colors",
            value === opt ? "bg-overlay text-text-emphasis" : "text-text-muted hover:text-text",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
