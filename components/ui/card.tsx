import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}
