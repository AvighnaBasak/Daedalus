import { useEffect, useState } from "react";
import { invoke, isTauri } from "@/lib/tauri";
import type { Session } from "@/lib/types";

export interface HudStats {
  usedTokens: number;
  maxTokens: number;
  costUsd: number;
  model: string;
}

const DEFAULT: HudStats = {
  usedTokens: 0,
  maxTokens: 200_000,
  costUsd: 0,
  model: "—",
};

interface LiveUsage {
  used_tokens: number;
  max_tokens: number;
  cost_usd: number;
  model: string;
}

/**
 * Live token/cost stats for the active session, derived from Claude Code's own
 * transcripts (~/.claude/projects/**). Polls lightly; falls back to zeros when
 * no transcript exists yet or when running outside Tauri.
 */
export function useSessionStats(session: Session | null): HudStats {
  const [stats, setStats] = useState<HudStats>(DEFAULT);

  useEffect(() => {
    if (!session || !isTauri()) {
      setStats(DEFAULT);
      return;
    }
    let alive = true;
    const poll = async () => {
      try {
        const u = await invoke<LiveUsage>("get_live_session_usage", { cwd: session.cwd });
        if (!alive) return;
        setStats({
          usedTokens: u.used_tokens,
          maxTokens: u.max_tokens || 200_000,
          costUsd: u.cost_usd,
          model: u.model || "—",
        });
      } catch {
        if (alive) setStats(DEFAULT);
      }
    };
    void poll();
    const t = setInterval(poll, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [session]);

  return stats;
}
