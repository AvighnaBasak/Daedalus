import { Meter } from "@/components/ui/Meter";
import type { HudStats } from "@/meter/useSessionStats";

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

/** Compact always-visible cockpit readout that lives in the title bar so the
 * terminal can stay fullscreen. */
export function HudStrip({ stats, active }: { stats: HudStats; active: boolean }) {
  if (!active) return null;
  const ratio = stats.maxTokens > 0 ? stats.usedTokens / stats.maxTokens : 0;
  const pct = Math.round(ratio * 100);

  return (
    <div className="flex items-center gap-3 border-l border-border pl-3 pr-1 text-[11px]">
      <div className="flex items-center gap-2" title={`${fmt(stats.usedTokens)} / ${fmt(stats.maxTokens)} tokens`}>
        <span className="mono-label !text-[10px]">CTX</span>
        <div className="w-16">
          <Meter value={ratio} />
        </div>
        <span className="tabular w-8 text-text-muted">{pct}%</span>
      </div>
      <div className="flex items-center gap-1.5 tabular text-text">
        <span className="text-text-emphasis">${stats.costUsd.toFixed(4)}</span>
      </div>
      <span className="hidden rounded-[var(--r-1)] border border-border px-1.5 py-0.5 text-text-muted sm:inline">
        {stats.model}
      </span>
    </div>
  );
}
