import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "w-full rounded-[var(--radius-panel)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-2 text-[13.5px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-placeholder)] focus:border-[var(--color-primary)]",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "w-full rounded-[var(--radius-panel)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-2 text-[13.5px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]",
        className,
      )}
      {...props}
    />
  );
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
  return (
    <textarea
      className={cn(
        "w-full rounded-[var(--radius-panel)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-2 text-[13.5px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-placeholder)] focus:border-[var(--color-primary)]",
        className,
      )}
      {...props}
    />
  );
}
