import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { formatCents, cn } from "@/lib/utils";
import { HOUSE_FEES, type House } from "@/schema-sketch/bid-math";

export default async function BuyScorecardPage() {
  const [vehicles, deals] = await Promise.all([
    db.select().from(schema.vehicles).where(eq(schema.vehicles.sold, true)),
    db.select().from(schema.deals),
  ]);

  const dealByVehicleId = new Map<string, (typeof deals)[number]>();
  for (const d of deals) {
    if (!d.vehicleId) continue;
    const existing = dealByVehicleId.get(d.vehicleId);
    if (!existing || (d.funded && !existing.funded)) dealByVehicleId.set(d.vehicleId, d);
  }

  const rows = vehicles.map((v) => {
    const deal = dealByVehicleId.get(v.id) ?? null;
    const landedCost =
      (v.hammer ?? 0) + (v.buyFee ?? 0) + v.tow + v.recon;
    const salePrice = deal?.salePrice ?? null;
    const appraisalVariance = salePrice != null && v.bookValue != null ? salePrice - v.bookValue : null;
    const actualGross = salePrice != null ? salePrice - landedCost : null;
    return { v, deal, landedCost, salePrice, appraisalVariance, actualGross };
  });

  const withVariance = rows.filter((r) => r.appraisalVariance != null);
  const avgVariance = withVariance.length
    ? Math.round(withVariance.reduce((sum, r) => sum + r.appraisalVariance!, 0) / withVariance.length)
    : null;

  const withGross = rows.filter((r) => r.actualGross != null);
  const avgGross = withGross.length
    ? Math.round(withGross.reduce((sum, r) => sum + r.actualGross!, 0) / withGross.length)
    : null;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">Buy scorecard</h1>
        <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
          The retail you bought on versus what the unit actually brought when it sold — whether your appraisals run
          optimistic, and by how much.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <div className="text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
            Appraisal variance, on average
          </div>
          {avgVariance != null ? (
            <>
              <div
                className={cn(
                  "mt-1 text-[32px] font-semibold tracking-[-.02em] tabular-nums",
                  avgVariance < 0 ? "text-[var(--color-negative)]" : "text-[var(--color-positive)]",
                )}
              >
                {avgVariance >= 0 ? "+" : "−"}
                {formatCents(Math.abs(avgVariance)).slice(1)}
              </div>
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                {avgVariance < 0
                  ? `Across ${withVariance.length} sold unit${withVariance.length === 1 ? "" : "s"}, actual sale price ran ${formatCents(Math.abs(avgVariance))} under the retail you bought on — appraisals are running optimistic.`
                  : `Across ${withVariance.length} sold unit${withVariance.length === 1 ? "" : "s"}, actual sale price ran ${formatCents(avgVariance)} over the retail you bought on.`}
              </p>
            </>
          ) : (
            <>
              <div className="mt-1 text-[32px] font-semibold tracking-[-.02em] text-[var(--color-text-placeholder)]">—</div>
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                Needs sold units with both a book value and a recorded sale price on their deal.
              </p>
            </>
          )}
        </Card>

        <Card>
          <div className="text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
            Actual gross, on average
          </div>
          <div className="mt-1 text-[32px] font-semibold tracking-[-.02em] tabular-nums text-[var(--color-text)]">
            {avgGross != null ? formatCents(avgGross) : "—"}
          </div>
          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
            Sale price minus hammer, buy fee, tow, and recon — across {withGross.length} sold unit
            {withGross.length === 1 ? "" : "s"}.
          </p>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="mb-3 text-[13.5px] font-semibold text-[var(--color-text)]">Per unit</div>
        {rows.length === 0 ? (
          <p className="text-[12.5px] text-[var(--color-text-muted)]">
            Nothing sold yet — this fills in as vehicles get marked sold or their deal gets funded.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--color-header-rule)] text-left text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                  <th className="px-2 py-2">Unit</th>
                  <th className="px-2 py-2">House</th>
                  <th className="px-2 py-2">Book value</th>
                  <th className="px-2 py-2">Landed cost</th>
                  <th className="px-2 py-2">Sold for</th>
                  <th className="px-2 py-2">Appraisal variance</th>
                  <th className="px-2 py-2">Actual gross</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.v.id} className="border-b border-[var(--color-hairline)]">
                    <td className="px-2 py-2 text-[var(--color-text)]">
                      {r.v.year} {r.v.make} {r.v.model} {r.v.trim ?? ""}
                    </td>
                    <td className="px-2 py-2 text-[var(--color-text-muted)]">
                      {r.v.house ? HOUSE_FEES[r.v.house as House]?.label ?? r.v.house : "—"}
                    </td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">{formatCents(r.v.bookValue)}</td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">{formatCents(r.landedCost)}</td>
                    <td className="px-2 py-2 tabular-nums text-[var(--color-text)]">
                      {r.salePrice != null ? formatCents(r.salePrice) : "—"}
                    </td>
                    <td className="px-2 py-2 tabular-nums">
                      {r.appraisalVariance != null ? (
                        <span className={r.appraisalVariance < 0 ? "text-[var(--color-negative)]" : "text-[var(--color-positive)]"}>
                          {r.appraisalVariance >= 0 ? "+" : "−"}
                          {formatCents(Math.abs(r.appraisalVariance)).slice(1)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-2 tabular-nums">
                      {r.actualGross != null ? (
                        <span className={r.actualGross < 0 ? "text-[var(--color-negative)]" : "text-[var(--color-positive)]"}>
                          {formatCents(r.actualGross)}
                        </span>
                      ) : (
                        "—"
                      )}
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
