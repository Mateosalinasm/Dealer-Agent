import { getWatchListData } from "@/lib/watch-list-data";
import { WatchItemCard } from "@/components/watch-item-card";
import { PricingAssumptionsBar } from "@/components/pricing-assumptions-bar";
import { AddWatchItemModal } from "@/components/add-watch-item-modal";
import { formatCents } from "@/lib/utils";

export default async function WatchListPage() {
  const { rows, turnDays, holdingPerDay, targetGross, assumedDown } = await getWatchListData();

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">
            Auction watch-list
          </h1>
          <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
            The units you priced, with the full math open for each one. Holding cost assumes{" "}
            {turnDays} days at {formatCents(holdingPerDay)}/day, from your actual average turn time.
          </p>
        </div>
        <div className="flex-none">
          <AddWatchItemModal />
        </div>
      </div>

      <PricingAssumptionsBar targetGrossCents={targetGross} assumedDownCents={assumedDown} holdingPerDayCents={holdingPerDay} />

      {rows.length === 0 ? (
        <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-8 text-center">
          <div className="text-[15px] font-semibold text-[var(--color-text)]">
            Nothing on the watch-list yet
          </div>
          <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
            Price a run list to send units here, or click &ldquo;Add unit&rdquo; above to add one by hand.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <WatchItemCard key={row.item.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
