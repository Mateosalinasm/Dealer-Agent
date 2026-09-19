import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ackHealthIssue, reopenHealthIssue } from "@/app/desk/deals/actions";
import type { DealHealth } from "@/lib/deal-health";

const STATUS_TONE = { red: "negative", yellow: "caution", green: "positive" } as const;

export function DealHealthCard({ dealId, health }: { dealId: string; health: DealHealth }) {
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <div className="text-[13.5px] font-semibold text-[var(--color-text)]">Deal health</div>
        <Badge tone={STATUS_TONE[health.status]}>{health.label}</Badge>
      </div>

      {health.issues.length === 0 ? (
        <p className="text-[12.5px] text-[var(--color-text-muted)]">Nothing flagged.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {health.issues.map((issue) => (
            <div
              key={issue.key}
              className={`flex items-start gap-3 rounded-[var(--radius-panel)] p-3 ${
                issue.acked
                  ? "bg-[var(--color-fill-subtle)] opacity-60"
                  : issue.sev === "red"
                    ? "bg-[var(--color-negative-bg)]"
                    : "bg-[var(--color-caution-bg)]"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className={`text-[12.5px] font-semibold ${issue.acked ? "text-[var(--color-text-muted)]" : issue.sev === "red" ? "text-[var(--color-negative-text)]" : "text-[var(--color-caution-text)]"}`}>
                  {issue.title}
                </div>
                <div className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">{issue.detail}</div>
              </div>
              {issue.acked ? (
                <form action={reopenHealthIssue.bind(null, dealId, issue.key)}>
                  <button type="submit" className="flex-none text-[11px] font-semibold text-[var(--color-text-muted)] hover:underline">
                    Reopen
                  </button>
                </form>
              ) : (
                <form action={ackHealthIssue.bind(null, dealId, issue.key, issue.title)}>
                  <button
                    type="submit"
                    className="flex-none rounded-full bg-[var(--color-positive-bg)] p-1.5 text-[var(--color-positive-text)] hover:opacity-80"
                    aria-label="Approve"
                    title="Approve — stops driving status, stays visible as a reminder"
                  >
                    ✓
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
