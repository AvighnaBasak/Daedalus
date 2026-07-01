import { cn } from "@/lib/cn";

/**
 * Flat progress meter. Stays greyscale while healthy and ramps toward red as it
 * approaches the limit — the only chroma the app ever adds.
 */
export function Meter({
  value,
  warnAt = 0.7,
  className,
}: {
  value: number;
  warnAt?: number;
  className?: string;
}) {
  const v = Math.max(0, Math.min(1, value));
  let fill = "var(--grey-500)";
  if (v >= warnAt) {
    // 0 at warnAt → 100% red at 1.0
    const t = Math.round(((v - warnAt) / (1 - warnAt)) * 100);
    fill = `color-mix(in srgb, var(--red) ${t}%, var(--grey-500))`;
  }
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-[var(--r-1)] bg-grey-800", className)}>
      <div
        className="h-full rounded-[var(--r-1)] transition-[width,background-color] duration-[var(--dur-base)]"
        style={{ width: `${v * 100}%`, background: fill }}
      />
    </div>
  );
}
