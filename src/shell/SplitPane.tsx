import { useCallback, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Minimal two-pane horizontal split with a draggable hairline divider.
 * `fraction` is the left pane's share (0..1). No dependency, no gradient.
 */
export function SplitPane({
  left,
  right,
  initial = 0.55,
  min = 0.25,
  max = 0.8,
}: {
  left: ReactNode;
  right: ReactNode;
  initial?: number;
  min?: number;
  max?: number;
}) {
  const [fraction, setFraction] = useState(initial);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onMove = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const f = (clientX - rect.left) / rect.width;
      setFraction(Math.max(min, Math.min(max, f)));
    },
    [min, max],
  );

  const startDrag = () => {
    dragging.current = true;
    const move = (e: MouseEvent) => dragging.current && onMove(e.clientX);
    const up = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden">
      <div style={{ width: `${fraction * 100}%` }} className="h-full min-w-0">
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={startDrag}
        className={cn(
          "relative w-px shrink-0 cursor-col-resize bg-border",
          "before:absolute before:inset-y-0 before:-left-1 before:-right-1 before:content-['']",
          "hover:bg-border-hover",
        )}
      />
      <div style={{ width: `${(1 - fraction) * 100}%` }} className="h-full min-w-0">
        {right}
      </div>
    </div>
  );
}
