import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]",
  secondary: "bg-[var(--color-secondary)] text-[var(--color-text)] hover:bg-[var(--color-secondary-hover)]",
  ghost: "bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-fill-subtle)]",
  destructive: "bg-transparent text-[var(--color-delete)] hover:text-[var(--color-delete-hover)]",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-pill)] px-4 py-2 text-[12.5px] font-semibold transition-colors disabled:opacity-50",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
