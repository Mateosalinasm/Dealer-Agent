import { cn } from "@/lib/utils";

const FIELD_BASE =
  "w-full rounded-[var(--radius-panel)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-2 text-[13.5px] text-[var(--color-text)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 disabled:cursor-not-allowed disabled:bg-[var(--color-fill-subtle)] disabled:text-[var(--color-text-muted)]";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(FIELD_BASE, "placeholder:text-[var(--color-text-placeholder)]", className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(FIELD_BASE, className)} {...props} />;
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "mb-1 block text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(FIELD_BASE, "placeholder:text-[var(--color-text-placeholder)]", className)} {...props} />;
}
