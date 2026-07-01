import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ active, className, ...props }, ref) => (
    <button
      ref={ref}
      data-active={active ? "" : undefined}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-2)] transition-colors duration-[var(--dur-fast)]",
        "text-text-muted hover:text-text hover:bg-overlay",
        "focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-1",
        "disabled:opacity-40 disabled:pointer-events-none",
        active && "text-text-emphasis bg-overlay",
        className,
      )}
      {...props}
    />
  ),
);
IconButton.displayName = "IconButton";
