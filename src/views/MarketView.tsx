import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Plus, Search, Send, Star, Store } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { invoke, isTauri } from "@/lib/tauri";
import { cn } from "@/lib/cn";
import { CATALOG, CATEGORY_LABEL, type MarketCategory, type MarketEntry } from "@/market/catalog";
import type { Session } from "@/lib/types";

interface AddServerResult {
  success: boolean;
  message: string;
}

async function openExternal(url: string) {
  if (isTauri()) {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
      return;
    } catch (e) {
      console.error("openExternal failed:", e);
    }
  }
  window.open(url, "_blank", "noopener");
}

async function copyText(text: string): Promise<boolean> {
  if (isTauri()) {
    try {
      const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
      await writeText(text);
      return true;
    } catch {
      /* fall through */
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const FILTERS: Array<MarketCategory | "all"> = ["all", "mcp", "plugin", "agents", "tool", "collection"];

/**
 * The Bazaar — a curated, offline marketplace for the Claude Code ecosystem.
 * MCP servers install with one click (same plumbing as the MCP hub); plugins
 * send their slash command straight into the live Claude session; the rest
 * copy an install command or open the repo.
 */
export function MarketView({ session }: { session: Session | null }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MarketCategory | "all">("all");
  const [installedMcp, setInstalledMcp] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});

  // Which MCP servers are already registered (marketplace names are matched
  // against the mcp config by our catalog id suffix).
  useEffect(() => {
    if (!isTauri()) return;
    invoke<Array<{ name: string }>>("mcp_list")
      .then((servers) => setInstalledMcp(new Set(servers.map((s) => s.name))))
      .catch(() => {});
  }, []);

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATALOG.filter((e) => {
      if (filter !== "all" && e.category !== filter) return false;
      if (!q) return true;
      return `${e.name} ${e.description} ${e.url}`.toLowerCase().includes(q);
    });
  }, [query, filter]);

  const mcpName = (e: MarketEntry) => e.id.replace(/^mcp-/, "");

  const act = async (e: MarketEntry) => {
    setBusy(e.id);
    try {
      switch (e.install.kind) {
        case "mcp": {
          const res = await invoke<AddServerResult>("mcp_add", {
            name: mcpName(e),
            transport: "stdio",
            command: e.install.command,
            args: e.install.args,
            env: {},
            url: null,
            scope: "local",
          });
          if (res.success) {
            setInstalledMcp((prev) => new Set(prev).add(mcpName(e)));
            setDone((d) => ({ ...d, [e.id]: "Added" }));
          } else {
            setDone((d) => ({ ...d, [e.id]: res.message || "Failed" }));
          }
          break;
        }
        case "claude": {
          if (!session) break;
          await invoke("pty_write", { id: session.id, data: `${e.install.text}\r` });
          setDone((d) => ({ ...d, [e.id]: "Sent to Claude" }));
          break;
        }
        case "shell": {
          const ok = await copyText(e.install.text);
          setDone((d) => ({ ...d, [e.id]: ok ? "Copied" : "Copy failed" }));
          break;
        }
        case "link":
          await openExternal(e.url);
          break;
      }
    } catch (err) {
      setDone((d) => ({ ...d, [e.id]: String(err) }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto max-w-4xl px-8 py-8">
        <span className="mono-label">Marketplace</span>
        <h1 className="mt-1 flex items-center gap-2.5 text-[22px] text-text-emphasis">
          <Store size={20} className="text-text-muted" />
          The Bazaar
        </h1>
        <p className="mt-1.5 max-w-xl text-[12px] leading-relaxed text-text-muted">
          Hand-picked MCP servers, plugins, agents, and tools for Claude Code. MCP servers install
          with one click; plugins type their install command into your live session.
        </p>

        {/* search + filters */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="flex min-w-[220px] items-center gap-2 rounded-[var(--r-2)] border border-border bg-surface px-2.5 py-1.5">
            <Search size={13} className="shrink-0 text-text-disabled" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the catalog…"
              spellCheck={false}
              className="w-full bg-transparent text-[12px] text-text outline-none placeholder:text-text-disabled"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-[var(--r-1)] border px-2.5 py-1 text-[11px] transition-colors",
                  filter === f
                    ? "border-border-strong bg-surface-raised text-text-emphasis"
                    : "border-border text-text-muted hover:text-text",
                )}
              >
                {f === "all" ? "All" : CATEGORY_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        {/* cards */}
        <div className="mt-5 grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {entries.map((e) => {
            const isMcpInstalled = e.install.kind === "mcp" && installedMcp.has(mcpName(e));
            const note = done[e.id];
            return (
              <div
                key={e.id}
                className="group flex flex-col rounded-[var(--r-2)] border border-border bg-surface p-3.5 transition-colors hover:border-border-hover"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-text">{e.name}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wider text-text-disabled">
                      {CATEGORY_LABEL[e.category]}
                      {e.stars && (
                        <span className="ml-2 inline-flex items-center gap-0.5 normal-case tracking-normal">
                          <Star size={9} /> {e.stars}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => void openExternal(e.url)}
                    className="shrink-0 text-text-disabled transition-colors hover:text-text"
                    aria-label={`Open ${e.name} repository`}
                    title={e.url}
                  >
                    <ExternalLink size={13} />
                  </button>
                </div>
                <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-text-muted">{e.description}</p>
                {(e.install.kind === "mcp" || e.install.kind === "shell") && (
                  <p className="mt-2 truncate rounded-[var(--r-1)] border border-border bg-bg px-2 py-1 font-mono text-[10px] text-text-disabled">
                    {e.install.kind === "mcp"
                      ? `${e.install.command} ${e.install.args.join(" ")}`
                      : e.install.text}
                  </p>
                )}
                <div className="mt-2.5 flex items-center gap-2">
                  {e.install.kind === "mcp" &&
                    (isMcpInstalled ? (
                      <span className="flex items-center gap-1.5 text-[11px] text-text-muted">
                        <Check size={12} /> Installed
                      </span>
                    ) : (
                      <Button size="sm" variant="solid" disabled={busy !== null} onClick={() => void act(e)}>
                        <Plus size={12} />
                        {busy === e.id ? "Adding…" : "Add server"}
                      </Button>
                    ))}
                  {e.install.kind === "claude" && (
                    <Button
                      size="sm"
                      variant="solid"
                      disabled={busy !== null || !session}
                      onClick={() => void act(e)}
                      title={session ? undefined : "Open a Claude session first"}
                    >
                      <Send size={12} />
                      Send to Claude
                    </Button>
                  )}
                  {e.install.kind === "shell" && (
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void act(e)}>
                      <Copy size={12} />
                      Copy command
                    </Button>
                  )}
                  {e.install.kind === "link" && (
                    <Button size="sm" variant="outline" onClick={() => void act(e)}>
                      <ExternalLink size={12} />
                      Open repo
                    </Button>
                  )}
                  {note && <span className="truncate text-[11px] text-text-muted">{note}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {entries.length === 0 && (
          <p className="mt-10 text-center text-[12px] text-text-muted">Nothing matches that search.</p>
        )}

        <p className="mt-8 text-[11px] leading-relaxed text-text-disabled">
          Curated and shipped with Daedalus — no telemetry, no remote calls. Entries marked with an
          API key note need credentials in your environment before they work.
        </p>
      </div>
    </div>
  );
}
