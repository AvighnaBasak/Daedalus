import { cn } from "@/lib/cn";

type Tone = "ok" | "alert" | "idle" | "busy";

/**
 * Status conveyed without extra chroma: safe/idle states are greyscale,
 * anything needing attention is red. Never green/amber.
 */
export function StatusDot({ tone = "idle", pulse }: { tone?: Tone; pulse?: boolean }) {
  const color: Record<Tone, string> = {
    ok: "bg-grey-100",
    idle: "bg-grey-400",
    busy: "bg-grey-050",
    alert: "bg-accent",
  };
  return (
    <span className="relative inline-flex h-2 w-2">
      {pulse && tone === "alert" && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
      )}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", color[tone])} />
    </span>
  );
}
