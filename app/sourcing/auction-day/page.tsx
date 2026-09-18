import { and, eq, gte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getWatchListData } from "@/lib/watch-list-data";
import { getDealershipTimezone, todayInTimezone } from "@/lib/dealership-time";
import { AuctionDayRow } from "@/components/auction-day-row";
import { LaneBudgetInput } from "@/components/lane-budget-input";
import { TimezoneInput } from "@/components/timezone-input";
import { formatCents } from "@/lib/utils";

export default async function AuctionDayPage() {
  const [{ rows }, [settingsRow], timezone] = await Promise.all([
    getWatchListData(),
    db.select().from(schema.settings).limit(1),
    getDealershipTimezone(),
  ]);

  // "Today" for the budget strip has to track the lane's local calendar day,
  // not server UTC — the server may run anywhere, the auction doesn't. See
  // lib/dealership-time.ts.
  const today = todayInTimezone(timezone);
  const todaysComps = await db
    .select()
    .from(schema.saleComps)
    .where(and(eq(schema.saleComps.won, true), gte(schema.saleComps.observedOn, today)));

  const laneBudget = settingsRow?.laneBudget ?? null;
  const committedToday = todaysComps.reduce((sum, c) => sum + c.soldFor, 0);
  const leftToSpend = laneBudget != null ? laneBudget - committedToday : null;

  const sorted = [...rows].sort((a, b) => {
    const an = a.item.runNumber ? Number(a.item.runNumber) : NaN;
    const bn = b.item.runNumber ? Number(b.item.runNumber) : NaN;
    const aValid = Number.isFinite(an);
    const bValid = Number.isFinite(bn);
    if (aValid !== bValid) return aValid ? -1 : 1;
    if (aValid && bValid) return an - bn;
    return 0;
  });

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">Auction day</h1>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center gap-6">
          <LaneBudgetInput initialCents={laneBudget} />
          <TimezoneInput initialTimezone={timezone} />
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
              Committed today
            </div>
            <div className="text-[26px] font-semibold tabular-nums tracking-[-.01em] text-[var(--color-text)]">
              {formatCents(committedToday)}
            </div>
          </div>
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
              Left to spend
            </div>
            <div
              className={`text-[26px] font-semibold tabular-nums tracking-[-.01em] ${
                leftToSpend != null && leftToSpend < 0 ? "text-[var(--color-negative)]" : "text-[var(--color-text)]"
              }`}
            >
              {leftToSpend != null ? formatCents(leftToSpend) : "—"}
            </div>
          </div>
        </div>
        <div className="text-right text-[12px] text-[var(--color-text-muted)]">
          <div>{rows.length} units priced</div>
          <div>{todaysComps.length} units bought today</div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-8 text-center">
          <div className="text-[15px] font-semibold text-[var(--color-text)]">Nothing priced for a sale yet</div>
          <p className="mx-auto mt-1 max-w-md text-[12.5px] text-[var(--color-text-muted)]">
            Paste a run list, price it against your numbers, and Watch the units you want — they&apos;ll show up here
            ready to bid on.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[1010px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-[var(--color-header-rule)] text-left text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                <th className="w-16 px-3 py-2">Run</th>
                <th className="px-3 py-2">Unit</th>
                <th className="w-28 px-3 py-2">Title</th>
                <th className="w-32 px-3 py-2">Max bid</th>
                <th className="px-3 py-2">Your lane history</th>
                <th className="w-[210px] px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <AuctionDayRow key={row.item.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-[12px] text-[var(--color-text-muted)]">
        Log the price even on the ones you lose. Those are the numbers nobody else at the sale is writing down.
      </p>
    </div>
  );
}
