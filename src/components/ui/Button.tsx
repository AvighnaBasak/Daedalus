import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "solid" | "ghost" | "outline" | "danger";
type Size = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  "inline-flex items-center justify-center gap-2 font-medium select-none " +
  "transition-colors duration-[var(--dur-fast)] disabled:opacity-40 disabled:pointer-events-none " +
  "focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-1";

const variants: Record<Variant, string> = {
  // Solid uses the single red accent — reserved for the primary action only.
  solid: "bg-accent text-white hover:bg-accent-hover active:bg-accent-press border border-transparent",
  ghost: "bg-transparent text-text-secondary hover:text-text hover:bg-overlay border border-transparent",
  outline:
    "bg-transparent text-text border border-border hover:border-border-hover hover:bg-surface-raised",
  danger:
    "bg-transparent text-accent border border-[color-mix(in_srgb,var(--red)_40%,transparent)] hover:bg-accent-dim",
};

const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[12px] rounded-[var(--r-1)]",
  md: "h-9 px-3.5 text-[13px] rounded-[var(--r-2)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "outline", size = "md", className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
