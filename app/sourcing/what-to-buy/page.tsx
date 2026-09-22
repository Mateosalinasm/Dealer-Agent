import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { compKey } from "@/schema-sketch/bid-math";

export const dynamic = "force-dynamic";

function turnDaysBetween(acquiredOn: string, soldOn: string): number {
  return Math.round((Date.parse(soldOn + "T00:00:00") - Date.parse(acquiredOn + "T00:00:00")) / 86_400_000);
}

export default async function WhatToBuyPage() {
  const [leads, vehicles] = await Promise.all([
    db.select().from(schema.leads),
    db.select().from(schema.vehicles),
  ]);

  const openLeads = leads.filter((l) => l.status !== "sold" && l.status !== "lost" && l.wantMake && l.wantModel);
  const inStock = vehicles.filter((v) => !v.sold);

  const demandByKey = new Map<string, { make: string; model: string; count: number }>();
  for (const l of openLeads) {
    const key = compKey(l.wantMake, l.wantModel);
    if (!key) continue;
    const existing = demandByKey.get(key);
    if (existing) existing.count += 1;
    else demandByKey.set(key, { make: l.wantMake!, model: l.wantModel!, count: 1 });
  }

  const stockByKey = new Map<string, number>();
  for (const v of inStock) {
    const key = compKey(v.make, v.model);
    if (!key) continue;
    stockByKey.set(key, (stockByKey.get(key) ?? 0) + 1);
  }

  const allKeys = new Set([...demandByKey.keys(), ...stockByKey.keys()]);
  const demandRows = Array.from(allKeys)
    .map((key) => {
      const demand = demandByKey.get(key);
      const stock = stockByKey.get(key) ?? 0;
      const leadsWanting = demand?.count ?? 0;
      return {
        key,
        make: demand?.make ?? vehicles.find((v) => compKey(v.make, v.model) === key)?.make ?? "—",
        model: demand?.model ?? vehicles.find((v) => compKey(v.make, v.model) === key)?.model ?? "—",
        leadsWanting,
        stock,
        gap: leadsWanting - stock,
      };
    })
    .filter((r) => r.leadsWanting > 0)
    .sort((a, b) => b.gap - a.gap || b.leadsWanting - a.leadsWanting);

  const sold = vehicles.filter((v) => v.sold && v.soldOn && v.acquiredOn);
  const velocityByKey = new Map<string, { make: string; model: string; days: number[] }>();
  for (const v of sold) {
    const key = compKey(v.make, v.model);
    if (!key) continue;
    const days = turnDaysBetween(v.acquiredOn!, v.soldOn!);
    if (days < 0 || days > 400) continue;
    const existing = velocityByKey.get(key);
    if (existing) existing.days.push(days);
    else velocityByKey.set(key, { make: v.make ?? "—", model: v.model ?? "—", days: [days] });
  }
  const velocityRows = Array.from(velocityByKey.values())
    .map((v) => ({ ...v, n: v.days.length, avg: Math.round(v.days.reduce((a, b) => a + b, 0) / v.days.length) }))
    .sort((a, b) => a.avg - b.avg);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">What to buy</h1>
        <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
          Demand your open leads are asking for that you don&apos;t have in stock, and which segments turn fastest
          once you do.
        </p>
      </div>

      <Card>
        <div className="mb-3 text-[13.5px] font-semibold text-[var(--color-text)]">Demand vs. stock</div>
        {demandRows.length === 0 ? (
          <p className="text-[12.5px] text-[var(--color-text-muted)]">
            No open leads with a stated make/model yet — add some on the Leads page.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--color-header-rule)] text-left text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                  <th className="px-2 py-2">Model</th>
                  <th className="px-2 py-2">Leads want it</th>
                  <th className="px-2 py-2">In stock</th>
                  <th className="px-2 py-2">Gap</th>
                </tr>
              </thead>
              <tbody>
                {demandRows.map((r) => (
                  <tr key={r.key} className="border-b border-[var(--color-hairline)]">
                    <td className="px-2 py-2 font-medium text-[var(--color-text)]">
                      {r.make} {r.model}
                    </td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">{r.leadsWanting}</td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">{r.stock}</td>
                    <td className="px-2 py-2">
                      <Badge tone={r.gap > 0 ? "positive" : "neutral"}>{r.gap > 0 ? `Hunt: +${r.gap}` : "Covered"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <div className="mb-1 text-[13.5px] font-semibold text-[var(--color-text)]">Fastest-turning segments</div>
        <p className="mb-3 text-[11px] text-[var(--color-text-muted)]">
          Average days from acquired to sold, by make/model. Builds up as you mark vehicles sold.
        </p>
        {velocityRows.length === 0 ? (
          <p className="text-[12.5px] text-[var(--color-text-muted)]">
            No sold-vehicle history yet — this fills in as deals get funded.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--color-header-rule)] text-left text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                  <th className="px-2 py-2">Model</th>
                  <th className="px-2 py-2">Sold</th>
                  <th className="px-2 py-2">Avg days to sell</th>
                </tr>
              </thead>
              <tbody>
                {velocityRows.map((v) => (
                  <tr key={`${v.make}-${v.model}`} className="border-b border-[var(--color-hairline)]">
                    <td className="px-2 py-2 font-medium text-[var(--color-text)]">
                      {v.make} {v.model}
                    </td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">{v.n}</td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text)]">{v.avg}d</td>
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
