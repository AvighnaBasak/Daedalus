import { useEffect, useState } from "react";
import { RefreshCw, TrendingUp } from "lucide-react";
import { getCostHistory, type ProjectCost } from "@/lib/features";
import { isTauri } from "@/lib/tauri";
import { basename } from "@/lib/project";

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}
function ago(ms: number): string {
  if (!ms) return "—";
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function CostView() {
  const [rows, setRows] = useState<ProjectCost[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    if (!isTauri()) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getCostHistory()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };
  useEffect(refresh, []);

  const max = Math.max(0.0001, ...rows.map((r) => r.cost_usd));
  const total = rows.reduce((a, r) => a + r.cost_usd, 0);

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto max-w-3xl px-8 py-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <span className="mono-label">Cost history</span>
            <h1 className="mt-1 text-[22px] text-text-emphasis">
              <span className="tabular">${total.toFixed(2)}</span>{" "}
              <span className="text-[14px] text-text-muted">across {rows.length} projects</span>
            </h1>
          </div>
          <button onClick={refresh} className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text">
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="text-[13px] text-text-muted">Reading transcripts…</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <TrendingUp size={22} className="text-text-disabled" />
            <p className="text-[13px] text-text-muted">No usage recorded yet.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {rows.map((r) => (
              <li key={r.project} className="rounded-[var(--r-2)] border border-border bg-surface p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px] text-text">{basename(r.project)}</span>
                  <span className="tabular shrink-0 text-[14px] text-text-emphasis">${r.cost_usd.toFixed(4)}</span>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-[var(--r-1)] bg-grey-800">
                  <div className="h-full rounded-[var(--r-1)] bg-accent" style={{ width: `${(r.cost_usd / max) * 100}%` }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-text-disabled">
                  <span className="truncate">{r.project}</span>
                  <span className="tabular shrink-0">
                    {fmtTokens(r.total_tokens)} tok · {r.sessions} sess · {ago(r.last_active_ms)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
