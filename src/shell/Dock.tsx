import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconButton } from "@/components/ui/IconButton";

/**
 * A dockable side panel beside the always-mounted terminal. `side="left"` is used
 * for the file tree / editor; `side="right"` for MCP and Preview. Closing (X)
 * returns Claude to fullscreen. The inner edge is a drag-to-resize handle.
 */
export function Dock({
  side = "right",
  title,
  icon,
  width,
  onWidthChange,
  onClose,
  children,
}: {
  side?: "left" | "right";
  title: string;
  icon?: ReactNode;
  width: number;
  onWidthChange: (w: number) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const startDrag = () => {
    const rectLeft = ref.current?.getBoundingClientRect().left ?? 0;
    const move = (e: MouseEvent) => {
      const w = side === "right" ? window.innerWidth - e.clientX : e.clientX - rectLeft;
      onWidthChange(Math.max(340, Math.min(920, w)));
    };
    const up = () => {
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
    <div
      ref={ref}
      className={cn(
        "relative flex h-full shrink-0 flex-col bg-bg",
        side === "right" ? "border-l border-border" : "border-r border-border",
      )}
      style={{ width }}
    >
      {/* resize handle on the edge that faces the terminal */}
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={startDrag}
        className={cn(
          "absolute top-0 z-10 h-full w-1 cursor-col-resize bg-transparent hover:bg-border-hover",
          side === "right" ? "-left-px" : "-right-px",
        )}
      />
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border pl-3 pr-1.5">
        <div className="flex items-center gap-2">
          {icon && <span className="text-text-muted">{icon}</span>}
          <span className="mono-label">{title}</span>
        </div>
        <IconButton onClick={onClose} aria-label="Close panel">
          <X size={15} />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
