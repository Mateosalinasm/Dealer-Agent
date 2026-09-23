import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-hover)]",
  secondary: "bg-[var(--color-secondary)] text-[var(--color-text)] hover:bg-[var(--color-secondary-hover)] active:bg-[var(--color-secondary-hover)]",
  ghost: "bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-fill-subtle)] active:bg-[var(--color-fill-subtle)]",
  destructive: "bg-transparent text-[var(--color-delete)] hover:text-[var(--color-delete-hover)] active:text-[var(--color-delete-hover)]",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-pill)] px-4 py-2 text-[12.5px] font-semibold",
        "transition-[background-color,color,transform] duration-150 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.97]",
        "disabled:pointer-events-none disabled:opacity-50",
        "outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
