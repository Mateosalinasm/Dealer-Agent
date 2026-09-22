import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeleteCompButton } from "@/components/delete-comp-button";
import { formatCents, cn } from "@/lib/utils";
import { compKey, compStats, outbidBy, type Comp } from "@/schema-sketch/bid-math";

export const dynamic = "force-dynamic";

const HOUSE_LABEL: Record<string, string> = { manheim: "Manheim", americas: "America's", iaa: "IAA" };

export default async function SaleLedgerPage() {
  const comps = await db.select().from(schema.saleComps).orderBy(desc(schema.saleComps.observedOn));

  const compRows: Comp[] = comps.map((c) => ({
    make: c.make,
    model: c.model,
    soldFor: c.soldFor,
    ourMaxBid: c.ourMaxBid,
    won: c.won,
    observedOn: c.observedOn,
  }));

  const outbid = outbidBy(compRows);
  const won = comps.filter((c) => c.won).length;
  const lost = comps.length - won;

  const seenKeys = new Set<string>();
  const modelSummaries: Array<{ key: string; make: string; model: string; stats: NonNullable<ReturnType<typeof compStats>> }> = [];
  for (const c of comps) {
    const key = compKey(c.make, c.model);
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);
    const stats = compStats(compRows, c.make, c.model);
    if (stats) modelSummaries.push({ key, make: c.make ?? "—", model: c.model ?? "—", stats });
  }
  modelSummaries.sort((a, b) => b.stats.n - a.stats.n);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">Sale ledger</h1>
        <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
          The operator&apos;s own market data. This is the app&apos;s most valuable table.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <div className="text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
            Outbid by, on average
          </div>
          {outbid ? (
            <>
              <div
                className={cn(
                  "mt-1 text-[32px] font-semibold tracking-[-.02em] tabular-nums",
                  outbid.avg > 0 ? "text-[var(--color-negative)]" : "text-[var(--color-positive)]",
                )}
              >
                {outbid.avg >= 0 ? "−" : "+"}
                {formatCents(Math.abs(outbid.avg)).slice(1)}
              </div>
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                {outbid.avg > 0
                  ? `On the ${outbid.n} you lost, the lane went ${formatCents(outbid.avg)} past your max bid on average. If you want those cars you need cheaper retail, less recon, or a smaller target gross.`
                  : "The ones you lost went for less than your max bid. You were in the money and stopped bidding."}
              </p>
            </>
          ) : (
            <>
              <div className="mt-1 text-[32px] font-semibold tracking-[-.02em] text-[var(--color-text-placeholder)]">—</div>
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                Log what a unit brought when you lose it and this tells you how far off your max bid really is.
              </p>
            </>
          )}
        </Card>

        <Card>
          <div className="text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
            Lane activity
          </div>
          <div className="mt-1 text-[32px] font-semibold tracking-[-.02em] tabular-nums text-[var(--color-text)]">
            {comps.length}
          </div>
          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
            units watched through a lane · {won} won · {lost} lost
          </p>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="mb-1 text-[13.5px] font-semibold text-[var(--color-text)]">What each model brings in your lane</div>
        <p className="mb-3 text-[11px] text-[var(--color-text-muted)]">
          Your own numbers, not a book. Year and trim are ignored on purpose.
        </p>
        {modelSummaries.length === 0 ? (
          <p className="text-[12.5px] text-[var(--color-text-muted)]">No comps logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--color-header-rule)] text-left text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                  <th className="px-2 py-2">Model</th>
                  <th className="px-2 py-2">Seen</th>
                  <th className="px-2 py-2">Avg</th>
                  <th className="px-2 py-2">Range</th>
                  <th className="px-2 py-2">Won</th>
                  <th className="px-2 py-2">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {modelSummaries.map((m) => (
                  <tr key={m.key} className="border-b border-[var(--color-hairline)]">
                    <td className="px-2 py-2 font-medium text-[var(--color-text)]">
                      {m.make} {m.model}
                    </td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">{m.stats.n}</td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text)]">{formatCents(m.stats.avg)}</td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">
                      {formatCents(m.stats.lo)} – {formatCents(m.stats.hi)}
                    </td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">{m.stats.won}</td>
                    <td className="px-2 py-2 text-[var(--color-text-muted)]">{m.stats.lastSeen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <div className="mb-3 text-[13.5px] font-semibold text-[var(--color-text)]">Full log</div>
        {comps.length === 0 ? (
          <p className="text-[12.5px] text-[var(--color-text-muted)]">
            Nothing logged yet — Auction day writes here every time you log what a unit brought, won or lost.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--color-header-rule)] text-left text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Unit</th>
                  <th className="px-2 py-2">Title</th>
                  <th className="px-2 py-2">House</th>
                  <th className="px-2 py-2">Brought</th>
                  <th className="px-2 py-2">Your max</th>
                  <th className="px-2 py-2">vs. max</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {comps.map((c) => {
                  const vsMax = c.ourMaxBid != null ? c.soldFor - c.ourMaxBid : null;
                  return (
                    <tr key={c.id} className="border-b border-[var(--color-hairline)] hover:bg-[var(--color-row-hover)]">
                      <td className="px-2 py-2 text-[var(--color-text-muted)]">{c.observedOn}</td>
                      <td className="px-2 py-2 text-[var(--color-text)]">
                        {c.year} {c.make} {c.model} {c.trim ?? ""}
                      </td>
                      <td className="px-2 py-2 text-[var(--color-text-muted)]">{c.title ?? "—"}</td>
                      <td className="px-2 py-2 text-[var(--color-text-muted)]">{HOUSE_LABEL[c.house] ?? c.house}</td>
                      <td className="px-2 py-2 tabular-nums text-[var(--color-text)]">{formatCents(c.soldFor)}</td>
                      <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">
                        {c.ourMaxBid != null ? formatCents(c.ourMaxBid) : "—"}
                      </td>
                      <td className="px-2 py-2 tabular-nums">
                        {vsMax != null ? (
                          <span className={vsMax > 0 ? "text-[var(--color-negative)]" : "text-[var(--color-positive)]"}>
                            {vsMax > 0 ? "+" : "−"}
                            {formatCents(Math.abs(vsMax)).slice(1)}
                          </span>
                        ) : (
                          <span className="text-[var(--color-text-placeholder)]">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <Badge tone={c.won ? "positive" : "neutral"}>{c.won ? "Bought" : "Lost"}</Badge>
                      </td>
                      <td className="px-2 py-2">
                        <DeleteCompButton compId={c.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
