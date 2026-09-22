import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { sourcePerformance } from "@/lib/lead-source-stats";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const leads = await db
    .select({ source: schema.leads.source, status: schema.leads.status })
    .from(schema.leads);

  const stats = sourcePerformance(leads);
  const totalLeads = leads.length;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">Marketing</h1>
        <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
          Which channels are actually bringing leads in — set a lead&apos;s source on the Leads page and it shows up
          here.
        </p>
      </div>

      <Card>
        <div className="mb-3 text-[13.5px] font-semibold text-[var(--color-text)]">Channel performance</div>
        {totalLeads === 0 ? (
          <p className="text-[12.5px] text-[var(--color-text-muted)]">
            No leads yet — once you add some (with a source), this fills in.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--color-header-rule)] text-left text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                  <th className="px-2 py-2">Channel</th>
                  <th className="px-2 py-2">Leads</th>
                  <th className="px-2 py-2">Sold</th>
                  <th className="px-2 py-2">Lost</th>
                  <th className="px-2 py-2">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.source} className="border-b border-[var(--color-hairline)]">
                    <td className="px-2 py-2 font-medium text-[var(--color-text)]">{s.source}</td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">{s.total}</td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">{s.sold}</td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">{s.lost}</td>
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
    </div>
  );
}
