import Link from "next/link";
import { inArray } from "drizzle-orm";
import { Home, Landmark, TriangleAlert } from "lucide-react";
import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressRing } from "@/components/progress-ring";
import { CreditGradeBadge } from "@/components/credit-grade-modal";
import { IncomeReportBadge } from "@/components/income-report-badge";
import { StopPropagation } from "@/components/stop-propagation";
import { BoardChecklistPreview } from "@/components/board-checklist-preview";
import { SortMenu, type SortKey } from "@/components/sort-menu";
import { formatCents } from "@/lib/utils";
import { dealStageInfo, monthOf, msSince, pipelineTab, STAGES, type PipelineTab } from "@/lib/deal-stage";
import { dealFacts } from "@/lib/deal-facts";
import { dealHealth, nextAction, bucketOf } from "@/lib/deal-health";
import { setDealArchived } from "@/app/desk/deals/actions";
import { getUnderwritingSnapshotsForDeals } from "@/lib/deal-underwriting";

export const dynamic = "force-dynamic";

const HEALTH_ORDER: Record<"red" | "yellow" | "green", number> = { red: 0, yellow: 1, green: 2 };

const TAB_LABEL: Record<PipelineTab | "all", string> = {
  working: "Dashboard",
  funding: "In funding",
  booked: "Booked",
  funded: "Funded",
  all: "All this month",
  archived: "Archived",
};

const TABS: (PipelineTab | "all")[] = ["working", "funding", "booked", "funded", "all", "archived"];

const STAGE_TONE = ["info", "caution", "positive"] as const;

function monthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function hoursOnDesk(createdAt: Date): string {
  const hours = Math.floor(msSince(createdAt) / 3_600_000);
  return hours < 24 ? `${hours}h on desk` : `${Math.floor(hours / 24)}d on desk`;
}

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; monthOffset?: string; metric?: string; sort?: string }>;
}) {
  const { tab: rawTab, monthOffset: rawOffset, metric: rawMetric, sort: rawSort } = await searchParams;
  const tab = (TABS.includes(rawTab as (typeof TABS)[number]) ? rawTab : "working") as (typeof TABS)[number];
  const monthOffset = Number.isFinite(Number(rawOffset)) ? Math.trunc(Number(rawOffset)) : 0;
  const metric = rawMetric === "profit" ? "profit" : "commission";
  const sort: SortKey = rawSort === "oldest" ? "oldest" : rawSort === "urgent" ? "urgent" : "newest";

  type DocumentRow = typeof schema.documents.$inferSelect;

  const [deals, lenders] = await Promise.all([db.select().from(schema.deals), db.select().from(schema.lenders)]);
  const vehicleIds = deals.map((d) => d.vehicleId).filter((v): v is string => !!v);
  const dealIds = deals.map((d) => d.id);
  const [vehicles, documents, snapshotByDeal] = await Promise.all([
    vehicleIds.length ? db.select().from(schema.vehicles) : Promise.resolve([]),
    dealIds.length ? db.select().from(schema.documents).where(inArray(schema.documents.dealId, dealIds)) : Promise.resolve<DocumentRow[]>([]),
    getUnderwritingSnapshotsForDeals(dealIds),
  ]);
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  const lenderById = new Map(lenders.map((l) => [l.id, l]));
  const incomeDocsByDeal = new Map<string, DocumentRow[]>();
  for (const doc of documents) {
    if (!doc.dealId || (doc.category !== "turbopass" && doc.category !== "bank_statement")) continue;
    const list = incomeDocsByDeal.get(doc.dealId);
    if (list) list.push(doc);
    else incomeDocsByDeal.set(doc.dealId, [doc]);
  }

  const today = new Date();
  const targetMonthDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const targetMonth = monthOf(targetMonthDate);
  const currentMonth = monthOf(today);
  const isCurrentMonth = targetMonth === currentMonth;

  const counts: Record<(typeof TABS)[number], number> = { working: 0, funding: 0, booked: 0, funded: 0, all: 0, archived: 0 };

  const withFacts = deals.map((deal) => {
    const vehicle = deal.vehicleId ? (vehicleById.get(deal.vehicleId) ?? null) : null;
    const facts = dealFacts(deal, vehicle);
    const health = dealHealth(deal, facts);
    const next = nextAction(deal, facts, health);
    const bucket = pipelineTab(deal.done, deal.archived);
    const month = monthOf(deal.dealDate ?? deal.createdAt);
    return { deal, vehicle, facts, health, next, bucket, month, info: dealStageInfo(deal.done) };
  });

  const monthDeals = withFacts.filter((r) => r.bucket !== "archived" && r.month === targetMonth);
  const monthTotal = monthDeals.reduce((sum, r) => sum + (metric === "commission" ? (r.deal.commission ?? 0) : (r.facts.totalGross ?? 0)), 0);

  // Every tab is scoped to the selected month (via the ‹ › nav above), not
  // just "All this month" — a deal's month comes from its dealDate, an
  // archived deal's from when it was archived. Picking October must not
  // show September's deals on any tab.
  const monthOf_ = (row: (typeof withFacts)[number]) =>
    row.bucket === "archived" ? monthOf(row.deal.archivedAt ?? row.deal.createdAt) : row.month;

  withFacts.forEach((r) => {
    if (monthOf_(r) !== targetMonth) return;
    if (r.bucket !== "archived") counts.all++;
    counts[r.bucket]++;
  });

  const rows = withFacts
    .filter((row) => (tab === "all" ? row.bucket !== "archived" : row.bucket === tab) && monthOf_(row) === targetMonth)
    .sort((a, b) => {
      if (sort === "urgent") {
        const diff = HEALTH_ORDER[a.health.status] - HEALTH_ORDER[b.health.status];
        return diff !== 0 ? diff : b.deal.createdAt.getTime() - a.deal.createdAt.getTime();
      }
      const cmp =
        tab === "archived" ? (b.deal.archivedAt?.getTime() ?? 0) - (a.deal.archivedAt?.getTime() ?? 0) : b.deal.createdAt.getTime() - a.deal.createdAt.getTime();
      return sort === "oldest" ? -cmp : cmp;
    });

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">Deals</h1>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/desk/deals?tab=${t}&monthOffset=${monthOffset}&metric=${metric}&sort=${sort}`}
            className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-[12.5px] font-medium ${
              t === tab ? "bg-[var(--color-info-bg)] text-[var(--color-info-text)]" : "bg-[var(--color-fill-subtle)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
            }`}
          >
            {TAB_LABEL[t]}
            {counts[t] > 0 && <span className="ml-1.5 tabular-nums opacity-70">{counts[t]}</span>}
          </Link>
        ))}
      </div>

      {/* Month strip: nav, commission/profit toggle, monthly total */}
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/desk/deals?tab=${tab}&monthOffset=${monthOffset - 1}&metric=${metric}&sort=${sort}`}
            className="rounded-full p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-fill-subtle)]"
            aria-label="Previous month"
          >
            ‹
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[17px] font-semibold tracking-[-.01em] text-[var(--color-text)]">{monthLabel(targetMonthDate)}</span>
              {isCurrentMonth && <Badge tone="info">Current</Badge>}
            </div>
            <div className="text-[12px] text-[var(--color-text-muted)]">
              {monthDeals.length} deal{monthDeals.length === 1 ? "" : "s"} this month
            </div>
          </div>
          <Link
            href={`/desk/deals?tab=${tab}&monthOffset=${monthOffset + 1}&metric=${metric}&sort=${sort}`}
            className="rounded-full p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-fill-subtle)]"
            aria-label="Next month"
          >
            ›
          </Link>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <div className="flex gap-1 rounded-[var(--radius-pill)] bg-[var(--color-fill-subtle)] p-0.5">
            {(["commission", "profit"] as const).map((m) => (
              <Link
                key={m}
                href={`/desk/deals?tab=${tab}&monthOffset=${monthOffset}&metric=${m}&sort=${sort}`}
                className={`rounded-[var(--radius-pill)] px-2.5 py-1 text-[11px] font-semibold capitalize ${
                  metric === m ? "bg-[var(--color-text)] text-[var(--color-surface)]" : "text-[var(--color-text-muted)]"
                }`}
              >
                {m}
              </Link>
            ))}
          </div>
          <div className="text-right">
            <div className="text-[22px] font-semibold tabular-nums tracking-[-.01em] text-[var(--color-positive)]">{formatCents(monthTotal)}</div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">{metric} this month</div>
          </div>
        </div>
      </Card>

      <SortMenu current={sort} count={rows.length} />

      {rows.length === 0 ? (
        <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-8 text-center">
          <div className="text-[15px] font-semibold text-[var(--color-text)]">Nothing here</div>
          <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
            {tab === "working" ? "Create a deal to start tracking it through to funding." : "No deals in this tab right now."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ deal, vehicle, facts, next, info }) => {
            const stageIdx = Math.min(info.stageIdx, 2);
            const stageName = info.stageIdx === 3 ? "Funded" : STAGES[stageIdx].name;
            const openStips = deal.stips.filter((s) => !s.done).length;
            const nextBucket = bucketOf(next.bucket);
            const remainingPreview = info.remaining.slice(0, 4);
            const lenderName = deal.lenderId ? (lenderById.get(deal.lenderId)?.name ?? "Lender") : null;
            const snapshot = snapshotByDeal.get(deal.id) ?? { monthlyIncomeCents: null, incomeSource: null };
            const incomeDocs = incomeDocsByDeal.get(deal.id) ?? [];

            return (
              <Card key={deal.id} className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <Link href={`/desk/deals/${deal.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[14.5px] font-semibold text-[var(--color-text)]">{deal.customerName}</span>
                      <StopPropagation>
                        <CreditGradeBadge dealId={deal.id} customerName={deal.customerName ?? ""} vehicleLabel={facts.vehicleLabel} facts={deal} />
                        <IncomeReportBadge
                          dealId={deal.id}
                          customerName={deal.customerName ?? ""}
                          incomeSource={snapshot.incomeSource}
                          monthlyIncomeCents={snapshot.monthlyIncomeCents}
                          documents={incomeDocs}
                        />
                      </StopPropagation>
                      {vehicle && (
                        <span className="flex-none rounded-full bg-[var(--color-positive-bg)] p-1 text-[var(--color-positive-text)]" title="Vehicle attached">
                          <Home size={10} />
                        </span>
                      )}
                      {lenderName && (
                        <span className="flex-none rounded-full bg-[var(--color-info-bg)] p-1 text-[var(--color-info-text)]" title={lenderName}>
                          <Landmark size={10} />
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-[var(--color-text-muted)]">{facts.vehicleLabel || "Vehicle TBD"}</div>
                    <div className="truncate text-[11.5px] text-[var(--color-text-placeholder)]">
                      {lenderName ? `${lenderName}${deal.lot ? ` · ${deal.lot}` : ""}` : "Pending submission"}
                    </div>
                    <div className="text-[11.5px] text-[var(--color-text-placeholder)]">{deal.idType ?? "US ID"}</div>
                  </Link>
                  <ProgressRing pct={info.pct} />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={STAGE_TONE[stageIdx]}>{stageName.toUpperCase()}</Badge>
                  {openStips > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-caution-bg)] px-2 py-1 text-[10.5px] font-semibold text-[var(--color-caution-text)]">
                      <TriangleAlert size={10} />
                      {openStips} STIP{openStips === 1 ? "" : "S"} OUT
                    </span>
                  )}
                  <span className="ml-auto flex-none text-[11px] text-[var(--color-text-muted)]">{hoursOnDesk(deal.createdAt)}</span>
                </div>

                <div className="rounded-[var(--radius-panel)] bg-[#1d1d1f] p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Next action</span>
                    <span className="ml-auto rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[.04em]" style={{ background: nextBucket.bg, color: nextBucket.fg }}>
                      {nextBucket.label}
                    </span>
                  </div>
                  <div className="mt-1 text-[13px] font-semibold text-white">{next.label}</div>
                  <BoardChecklistPreview dealId={deal.id} remaining={remainingPreview} />
                </div>

                <form action={setDealArchived.bind(null, deal.id, !deal.archived)} className="self-end">
                  <button type="submit" className="text-[11px] font-semibold text-[var(--color-text-muted)] hover:underline">
                    {deal.archived ? "Restore" : "Archive"}
                  </button>
                </form>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
