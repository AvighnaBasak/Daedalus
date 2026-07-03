import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { listProviderModels, type ModelInfo, type ProviderConfig } from "@/lib/provider";
import { cn } from "@/lib/cn";

/**
 * Live, searchable model list for the configured backend. Only models the
 * provider can actually serve to Claude Code are listed (tool-capable, for
 * OpenRouter). Falls back gracefully when a provider can't enumerate models.
 */
export function ModelPicker({
  config,
  value,
  onPick,
  maxHeight = 220,
}: {
  config: ProviderConfig;
  value?: string;
  onPick: (id: string) => void;
  maxHeight?: number;
}) {
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const refresh = () => {
    setLoading(true);
    setError(null);
    listProviderModels(config)
      .then(setModels)
      .catch((e) => {
        setModels([]);
        setError(String(e));
      })
      .finally(() => setLoading(false));
  };

  // Refetch when the backend identity changes.
  useEffect(refresh, [config.kind, config.base_url, config.api_key]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = models ?? [];
    if (!q) return list.slice(0, 200);
    return list.filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)).slice(0, 200);
  }, [models, query]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[var(--r-1)] border border-border bg-bg px-2">
          <Search size={12} className="shrink-0 text-text-disabled" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${models?.length ?? 0} models…`}
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent py-1.5 font-mono text-[11px] text-text outline-none placeholder:text-text-disabled"
          />
        </div>
        <button
          onClick={refresh}
          className="flex h-7 w-7 items-center justify-center rounded-[var(--r-1)] border border-border text-text-muted hover:text-text"
          aria-label="Refresh models"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        </button>
      </div>

      {error && <p className="px-1 text-[10px] leading-snug text-text-muted">{error}</p>}

      <div className="overflow-y-auto rounded-[var(--r-1)] border border-border" style={{ maxHeight }}>
        {filtered.length === 0 ? (
          <p className="px-2 py-3 text-center text-[11px] text-text-muted">
            {loading ? "Loading models…" : "No models found — type a model name manually below."}
          </p>
        ) : (
          filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => onPick(m.id)}
              className={cn(
                "flex w-full items-baseline gap-2 px-2 py-1.5 text-left transition-colors hover:bg-surface-raised",
                value === m.id && "bg-surface-raised",
              )}
            >
              <span className={cn("truncate font-mono text-[11px]", value === m.id ? "text-text-emphasis" : "text-text-secondary")}>
                {m.id}
              </span>
              {m.name !== m.id && <span className="truncate text-[10px] text-text-disabled">{m.name}</span>}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
