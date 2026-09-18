import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "positive" | "negative" | "caution" | "info";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-[var(--color-fill-subtle)] text-[var(--color-text-muted)]",
  positive: "bg-[var(--color-positive-bg)] text-[var(--color-positive-text)]",
  negative: "bg-[var(--color-negative-bg)] text-[var(--color-negative-text)]",
  caution: "bg-[var(--color-caution-bg)] text-[var(--color-caution-text)]",
  info: "bg-[var(--color-info-bg)] text-[var(--color-info-text)]",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-1 text-[11px] font-semibold",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}
