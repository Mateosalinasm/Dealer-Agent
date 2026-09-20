import Link from "next/link";
import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCents, cn } from "@/lib/utils";
import { sourcePerformance } from "@/lib/lead-source-stats";
import { dealFacts } from "@/lib/deal-facts";
import { dealHealth } from "@/lib/deal-health";
import { daysSince } from "@/lib/deal-stage";

const RANGES = [
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "365", label: "1 year", days: 365 },
  { key: "all", label: "All time", days: null },
] as const;

const AGING_BUCKETS = [
  { key: "0-30", label: "0–30 days", max: 30 },
  { key: "31-60", label: "31–60 days", max: 60 },
  { key: "61-90", label: "61–90 days", max: 90 },
  { key: "91-120", label: "91–120 days", max: 120 },
  { key: "120+", label: "120+ days", max: Infinity },
] as const;

function rangeStartDate(days: number | null): string | null {
  if (days == null) return null;
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">{label}</div>
      <div className="mt-1 text-[24px] font-semibold tabular-nums tracking-[-.02em] text-[var(--color-text)]">{value}</div>
    </Card>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeKey = "90" } = await searchParams;
  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[1];
  const rangeStart = rangeStartDate(range.days);

  const [allDeals, leads, lenders, vehicles, appointments] = await Promise.all([
    db.select().from(schema.deals),
    db.select({ source: schema.leads.source, status: schema.leads.status }).from(schema.leads),
    db.select().from(schema.lenders),
    db.select().from(schema.vehicles),
    db.select({ status: schema.appointments.status }).from(schema.appointments),
  ]);

  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  const lenderNameById = new Map(lenders.map((l) => [l.id, l.name]));

  // --- Row 1: performance over the selected range ---
  const inRange = (dateStr: string | null, createdAt: Date) => {
    if (!rangeStart) return true;
    return (dateStr ?? createdAt.toISOString().slice(0, 10)) >= rangeStart;
  };
  const dealsInRange = allDeals.filter((d) => !d.archived && inRange(d.dealDate, d.createdAt));
  const fundedInRange = allDeals.filter((d) => d.funded && d.fundedOn && (!rangeStart || d.fundedOn >= rangeStart));
  const fundingRatePct = dealsInRange.length ? Math.round((fundedInRange.length / dealsInRange.length) * 1000) / 10 : null;
  const commissionBookedCents = dealsInRange.reduce((sum, d) => sum + (d.commission ?? 0), 0);

  const desksHours = fundedInRange
    .filter((d) => d.fundedOn)
    .map((d) => (Date.parse(d.fundedOn! + "T00:00:00") - d.createdAt.getTime()) / 3_600_000)
    .filter((h) => h >= 0 && h < 400 * 24);
  const avgHoursOnDesk = desksHours.length ? Math.round(desksHours.reduce((a, b) => a + b, 0) / desksHours.length) : null;

  // --- Row 2: current snapshot, not range-filtered — "how's the desk right
  // now," same as the pipeline board's own counts, not a historical window. ---
  const activeDeals = allDeals.filter((d) => !d.funded && !d.archived);
  const pendingFundingCount = activeDeals.length;
  const dealsCriticalCount = activeDeals.filter((d) => {
    const vehicle = d.vehicleId ? (vehicleById.get(d.vehicleId) ?? null) : null;
    return dealHealth(d, dealFacts(d, vehicle)).status === "red";
  }).length;
  const stipsOutstandingCount = activeDeals.reduce((sum, d) => sum + d.stips.filter((s) => !s.done).length, 0);
  const openLeadsCount = leads.filter((l) => l.status === "open" || l.status === "contacted" || l.status === "appointment").length;
  const appointmentsSetCount = appointments.filter((a) => a.status === "scheduled").length;

  // --- Lender performance — all-time, not range-filtered (same choice the
  // page made before this rewrite). SENT/APPROVED/DECLINED come from the
  // real submission records (deal.subs[]); FUNDED and AVG RATE fall back to
  // the deal's own lenderId/apr for deals older than the Submissions
  // feature, which never got a subs[] entry. ---
  interface LenderAgg { name: string; sent: number; approved: number; declined: number; funded: number; aprs: number[] }
  const lenderAgg = new Map<string, LenderAgg>();
  const get = (id: string) => {
    let agg = lenderAgg.get(id);
    if (!agg) {
      agg = { name: lenderNameById.get(id) ?? "Unknown", sent: 0, approved: 0, declined: 0, funded: 0, aprs: [] };
      lenderAgg.set(id, agg);
    }
    return agg;
  };
  for (const d of allDeals) {
    for (const sub of d.subs) {
      const agg = get(sub.lenderId);
      agg.sent += 1;
      if (sub.status === "approved" || sub.status === "counter") {
        agg.approved += 1;
        if (sub.apr != null) agg.aprs.push(sub.apr);
      }
      if (sub.status === "declined") agg.declined += 1;
    }
    if (d.funded && d.lenderId) {
      const agg = get(d.lenderId);
      agg.funded += 1;
      if (agg.aprs.length === 0 && d.apr != null) agg.aprs.push(d.apr);
    }
  }
  const lenderStats = Array.from(lenderAgg.values())
    .map((s) => ({ ...s, avgAprPct: s.aprs.length ? Math.round((s.aprs.reduce((a, b) => a + b, 0) / s.aprs.length) / 10) / 10 : null }))
    .sort((a, b) => b.sent - a.sent);

  const leadStats = sourcePerformance(leads);

  // --- Inventory aging — unsold stock only, bucketed by days since acquired. ---
  const agingCounts = new Map(AGING_BUCKETS.map((b) => [b.key, 0]));
  for (const v of vehicles) {
    if (v.sold || !v.acquiredOn) continue;
    const days = daysSince(new Date(v.acquiredOn + "T00:00:00"));
    const bucket = AGING_BUCKETS.find((b) => days <= b.max);
    if (bucket) agingCounts.set(bucket.key, (agingCounts.get(bucket.key) ?? 0) + 1);
  }

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
                "rounded-[calc(var(--radius-panel)-3px)] px-3 py-1 text-[12px] font-medium transition-colors",
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Deals in range" value={String(dealsInRange.length)} />
        <StatTile label="Funded" value={String(fundedInRange.length)} />
        <StatTile label="Funding rate" value={fundingRatePct != null ? `${fundingRatePct}%` : "—"} />
        <StatTile label="Commission booked" value={formatCents(commissionBookedCents)} />
        <StatTile label="Avg hours on desk" value={avgHoursOnDesk != null ? `${avgHoursOnDesk}h` : "—"} />
        <StatTile label="Pending funding" value={String(pendingFundingCount)} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Deals critical" value={String(dealsCriticalCount)} />
        <StatTile label="Stips outstanding" value={String(stipsOutstandingCount)} />
        <StatTile label="Open leads" value={String(openLeadsCount)} />
        <StatTile label="Appointments set" value={String(appointmentsSetCount)} />
      </div>

      <Card className="mt-4">
        <div className="mb-1 text-[13.5px] font-semibold text-[var(--color-text)]">Lender performance</div>
        <p className="mb-3 text-[11px] text-[var(--color-text-muted)]">
          All time, not range-filtered. Sent/approved/declined counted from submission records; funded from the deal&rsquo;s outcome.
        </p>
        {lenderStats.length === 0 ? (
          <p className="text-[12.5px] text-[var(--color-text-muted)]">No submissions on file yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--color-header-rule)] text-left text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                  <th className="px-2 py-2">Lender</th>
                  <th className="px-2 py-2">Sent</th>
                  <th className="px-2 py-2">Approved</th>
                  <th className="px-2 py-2">Declined</th>
                  <th className="px-2 py-2">Funded</th>
                  <th className="px-2 py-2">Avg rate</th>
                </tr>
              </thead>
              <tbody>
                {lenderStats.map((s) => (
                  <tr key={s.name} className="border-b border-[var(--color-hairline)]">
                    <td className="px-2 py-2 font-medium text-[var(--color-text)]">{s.name}</td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">{s.sent}</td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">{s.approved}</td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">{s.declined}</td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text)]">{s.funded}</td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">{s.avgAprPct != null ? `${s.avgAprPct}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <div className="mb-1 text-[13.5px] font-semibold text-[var(--color-text)]">Leads by source</div>
          <p className="mb-3 text-[11px] text-[var(--color-text-muted)]">All time, not range-filtered.</p>
          {leadStats.length === 0 ? (
            <p className="text-[12.5px] text-[var(--color-text-muted)]">No leads yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-[12.5px]">
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

        <Card>
          <div className="mb-1 text-[13.5px] font-semibold text-[var(--color-text)]">Inventory aging</div>
          <p className="mb-3 text-[11px] text-[var(--color-text-muted)]">Unsold stock, by days since acquired.</p>
          <div className="flex flex-col gap-2">
            {AGING_BUCKETS.map((b) => (
              <div key={b.key} className="flex items-center justify-between text-[12.5px]">
                <span className="text-[var(--color-text-muted)]">{b.label}</span>
                <span className="tabular-nums font-semibold text-[var(--color-text)]">{agingCounts.get(b.key)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
