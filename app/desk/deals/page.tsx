import Link from "next/link";
import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/utils";
import { dealStageInfo, monthOf, pipelineTab, STAGES, type PipelineTab } from "@/lib/deal-stage";
import { setDealArchived } from "@/app/desk/deals/actions";

const TAB_LABEL: Record<PipelineTab | "all", string> = {
  working: "Dashboard",
  funding: "In funding",
  booked: "Booked",
  funded: "Funded",
  all: "All this month",
  archived: "Archived",
};

const TABS: (PipelineTab | "all")[] = ["working", "funding", "booked", "funded", "all", "archived"];

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const tab = (TABS.includes(rawTab as (typeof TABS)[number]) ? rawTab : "working") as (typeof TABS)[number];

  const deals = await db.select().from(schema.deals);
  const vehicleIds = deals.map((d) => d.vehicleId).filter((v): v is string => !!v);
  const vehicles = vehicleIds.length ? await db.select().from(schema.vehicles) : [];
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));

  const currentMonth = monthOf(new Date());
  const counts: Record<(typeof TABS)[number], number> = {
    working: 0,
    funding: 0,
    booked: 0,
    funded: 0,
    all: 0,
    archived: 0,
  };

  const rows = deals
    .map((deal) => {
      const bucket = pipelineTab(deal.done, deal.archived);
      const month = monthOf(deal.dealDate ?? deal.createdAt);
      if (bucket !== "archived" && month === currentMonth) counts.all++;
      counts[bucket]++;
      return { deal, bucket, month, info: dealStageInfo(deal.done) };
    })
    .filter((row) => (tab === "all" ? row.bucket !== "archived" && row.month === currentMonth : row.bucket === tab))
    .sort((a, b) =>
      tab === "archived"
        ? (b.deal.archivedAt?.getTime() ?? 0) - (a.deal.archivedAt?.getTime() ?? 0)
        : a.deal.createdAt.getTime() - b.deal.createdAt.getTime(),
    );

  const now = Date.now();

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">Deals</h1>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/desk/deals?tab=${t}`}
            className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-[12.5px] font-medium ${
              t === tab
                ? "bg-[var(--color-info-bg)] text-[var(--color-info-text)]"
                : "bg-[var(--color-fill-subtle)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
            }`}
          >
            {TAB_LABEL[t]}
            {counts[t] > 0 && <span className="ml-1.5 tabular-nums opacity-70">{counts[t]}</span>}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-8 text-center">
          <div className="text-[15px] font-semibold text-[var(--color-text)]">Nothing here</div>
          <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
            {tab === "working" ? "Create a deal to start tracking it through to funding." : "No deals in this tab right now."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map(({ deal, bucket, info }) => {
            const vehicle = deal.vehicleId ? vehicleById.get(deal.vehicleId) : null;
            const stageName = info.stageIdx === 3 ? "Complete" : STAGES[info.stageIdx].name;
            const daysInFunding = deal.fundingSince ? Math.floor((now - deal.fundingSince.getTime()) / (24 * 60 * 60 * 1000)) : 0;
            const alarm = bucket === "funding" ? "!".repeat(Math.max(0, Math.min(3, daysInFunding - 1))) : "";

            return (
              <Card key={deal.id} className="flex items-center justify-between gap-3">
                <Link href={`/desk/deals/${deal.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13.5px] font-semibold text-[var(--color-text)]">
                    {deal.customerName}
                    {alarm && <span className="text-[var(--color-negative)]">{alarm}</span>}
                  </div>
                  <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                    {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "No vehicle attached"}
                  </div>
                </Link>
                <div className="flex items-center gap-4">
                  {deal.salePrice != null && (
                    <span className="tabular-nums text-[12.5px] text-[var(--color-text-muted)]">{formatCents(deal.salePrice)}</span>
                  )}
                  <Badge tone={info.stageIdx === 3 ? "positive" : "info"}>{stageName}</Badge>
                  <span className="w-10 text-right tabular-nums text-[12px] text-[var(--color-text-muted)]">{info.pct}%</span>
                  <form action={setDealArchived.bind(null, deal.id, !deal.archived)}>
                    <button
                      type="submit"
                      className="rounded-[var(--radius-pill)] bg-[var(--color-fill-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
                    >
                      {deal.archived ? "Restore" : "Archive"}
                    </button>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
