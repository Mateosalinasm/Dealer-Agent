import Link from "next/link";
import { and, eq, gte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCents, cn } from "@/lib/utils";
import { sourcePerformance } from "@/lib/lead-source-stats";

const RANGES = [
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "365", label: "1 year", days: 365 },
  { key: "all", label: "All time", days: null },
] as const;

function rangeStartDate(days: number | null): string | null {
  if (days == null) return null;
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeKey = "90" } = await searchParams;
  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[1];

  const rangeStart = rangeStartDate(range.days);

  const fundedDeals = await db
    .select()
    .from(schema.deals)
    .where(rangeStart ? and(eq(schema.deals.funded, true), gte(schema.deals.fundedOn, rangeStart)) : eq(schema.deals.funded, true));

  const totalGross = fundedDeals.reduce((sum, d) => sum + d.backEndGross, 0);

  const desksDays = fundedDeals
    .filter((d) => d.fundedOn)
    .map((d) => Math.round((Date.parse(d.fundedOn! + "T00:00:00") - d.createdAt.getTime()) / 86_400_000))
    .filter((d) => d >= 0 && d < 400);
  const avgDaysOnDesk = desksDays.length ? Math.round((desksDays.reduce((a, b) => a + b, 0) / desksDays.length) * 10) / 10 : null;

  const [leads, allDeals, lenders] = await Promise.all([
    db.select({ source: schema.leads.source, status: schema.leads.status }).from(schema.leads),
    db.select().from(schema.deals),
    db.select().from(schema.lenders),
  ]);

  const lenderNameById = new Map(lenders.map((l) => [l.id, l.name]));
  const lenderStatsMap = new Map<string, { name: string; submitted: number; funded: number; aprs: number[] }>();
  for (const d of allDeals) {
    if (!d.lenderId) continue;
    const name = lenderNameById.get(d.lenderId) ?? "Unknown";
    const existing = lenderStatsMap.get(d.lenderId) ?? { name, submitted: 0, funded: 0, aprs: [] };
    existing.submitted += 1;
    if (d.funded) {
      existing.funded += 1;
      if (d.apr != null) existing.aprs.push(d.apr);
    }
    lenderStatsMap.set(d.lenderId, existing);
  }
  const lenderStats = Array.from(lenderStatsMap.values())
    .map((s) => ({
      ...s,
      closeRatePct: s.submitted ? Math.round((s.funded / s.submitted) * 1000) / 10 : 0,
      avgAprPct: s.aprs.length ? Math.round((s.aprs.reduce((a, b) => a + b, 0) / s.aprs.length) / 10) / 10 : null,
    }))
    .sort((a, b) => b.submitted - a.submitted);

  const leadStats = sourcePerformance(leads);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">Analytics</h1>
        <div className="flex gap-1 rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-1">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/desk/analytics?range=${r.key}`}
              className={cn(
                "rounded-[calc(var(--radius-panel)-3px)] px-3 py-1 text-[12px] font-medium",
                r.key === range.key
                  ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm"
                  : "text-[var(--color-text-muted)]",
              )}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
            Deals funded
          </div>
          <div className="mt-1 text-[32px] font-semibold tabular-nums tracking-[-.02em] text-[var(--color-text)]">
            {fundedDeals.length}
          </div>
        </Card>
        <Card>
          <div className="text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
            Total gross
          </div>
          <div className="mt-1 text-[32px] font-semibold tabular-nums tracking-[-.02em] text-[var(--color-text)]">
            {formatCents(totalGross)}
          </div>
        </Card>
        <Card>
          <div className="text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
            Avg. days on the desk
          </div>
          <div className="mt-1 text-[32px] font-semibold tabular-nums tracking-[-.02em] text-[var(--color-text)]">
            {avgDaysOnDesk != null ? `${avgDaysOnDesk}d` : "—"}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="mb-1 text-[13.5px] font-semibold text-[var(--color-text)]">Lead performance by source</div>
        <p className="mb-3 text-[11px] text-[var(--color-text-muted)]">All time, not range-filtered.</p>
        {leadStats.length === 0 ? (
          <p className="text-[12.5px] text-[var(--color-text-muted)]">No leads yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--color-header-rule)] text-left text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                  <th className="px-2 py-2">Source</th>
                  <th className="px-2 py-2">Leads</th>
                  <th className="px-2 py-2">Sold</th>
                  <th className="px-2 py-2">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {leadStats.map((s) => (
                  <tr key={s.source} className="border-b border-[var(--color-hairline)]">
                    <td className="px-2 py-2 font-medium text-[var(--color-text)]">{s.source}</td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">{s.total}</td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">{s.sold}</td>
                    <td className="px-2 py-2">
                      <Badge tone={s.conversionPct >= 20 ? "positive" : "neutral"}>{s.conversionPct}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <div className="mb-1 text-[13.5px] font-semibold text-[var(--color-text)]">Lender performance</div>
        <p className="mb-3 text-[11px] text-[var(--color-text-muted)]">
          All time. Approval/decline-stage tracking isn&apos;t in the data model yet — this reflects submitted vs.
          funded only.
        </p>
        {lenderStats.length === 0 ? (
          <p className="text-[12.5px] text-[var(--color-text-muted)]">No deals submitted to a lender yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--color-header-rule)] text-left text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                  <th className="px-2 py-2">Lender</th>
                  <th className="px-2 py-2">Submitted</th>
                  <th className="px-2 py-2">Funded</th>
                  <th className="px-2 py-2">Close rate</th>
                  <th className="px-2 py-2">Avg APR</th>
                </tr>
              </thead>
              <tbody>
                {lenderStats.map((s) => (
                  <tr key={s.name} className="border-b border-[var(--color-hairline)]">
                    <td className="px-2 py-2 font-medium text-[var(--color-text)]">{s.name}</td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">{s.submitted}</td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">{s.funded}</td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text)]">{s.closeRatePct}%</td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">
                      {s.avgAprPct != null ? `${s.avgAprPct}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
