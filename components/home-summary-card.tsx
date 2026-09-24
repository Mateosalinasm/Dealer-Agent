import Link from "next/link";
import { Card } from "@/components/ui/card";

export interface SummaryStat {
  value: number | string;
  label: string;
  tone?: "default" | "caution" | "positive";
}

const TONE_CLASSES: Record<NonNullable<SummaryStat["tone"]>, string> = {
  default: "text-[var(--color-text)]",
  caution: "text-[var(--color-caution-text)]",
  positive: "text-[var(--color-positive-text)]",
};

export function HomeSummaryCard({ title, viewHref, stats }: { title: string; viewHref: string; stats: SummaryStat[] }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[14px] font-semibold text-[var(--color-text)]">{title}</div>
        <Link href={viewHref} className="text-[11.5px] font-semibold text-[var(--color-primary)] hover:underline">
          View all
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-2.5">
            <div className={`w-10 flex-none text-[15px] font-semibold tabular-nums ${TONE_CLASSES[s.tone ?? "default"]}`}>{s.value}</div>
            <div className="text-[12.5px] text-[var(--color-text-muted)]">{s.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
