"use client";

import { useRef, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentRow } from "@/components/document-row";
import { cn, formatCents } from "@/lib/utils";
import {
  analyzeWatchItemDocument,
  deleteWatchItemDocument,
  updateWatchItemRunSale,
  uploadWatchItemAutocheck,
} from "@/app/sourcing/watch-list/actions";
import type { WatchListRow } from "@/lib/watch-list-data";
import type { BidPlan } from "@/schema-sketch/bid-math";

const HOUSE_LABEL: Record<string, string> = {
  manheim: "Manheim",
  americas: "America's Auto Auction",
  iaa: "IAA",
};

const TITLE_TONE: Record<string, "neutral" | "caution" | "negative"> = {
  clean: "neutral",
  rebuilt: "caution",
  salvage: "negative",
  flood: "negative",
  lemon: "negative",
  branded: "negative",
};

function MathRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-hairline)] py-2 last:border-0">
      <span className="text-[12.5px] text-[var(--color-text-muted)]">{label}</span>
      <span
        className={cn(
          "tabular-nums text-[13.5px] font-semibold text-[var(--color-text)]",
          strong && "text-[22px]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function MaxBidRow({ plan }: { plan: BidPlan }) {
  const positive = plan.maxBid > 0;
  return (
    <div className="flex items-center justify-between pt-3">
      <span className="text-[12.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
        Max bid
      </span>
      <span
        className={cn(
          "tabular-nums text-[22px] font-semibold tracking-[-.01em]",
          positive ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]",
        )}
      >
        {formatCents(plan.maxBid)}
      </span>
    </div>
  );
}

function LaneHistory({ stats, maxBid }: { stats: NonNullable<WatchListRow["stats"]>; maxBid: number }) {
  const aboveAverage = maxBid >= stats.avg;
  const diff = Math.abs(maxBid - stats.avg);
  return (
    <div
      className={cn(
        "rounded-[var(--radius-panel)] p-3.5",
        aboveAverage ? "bg-[var(--color-positive-bg)]" : "bg-[var(--color-negative-bg)]",
      )}
    >
      <div
        className={cn(
          "text-[11px] font-semibold uppercase tracking-[.05em]",
          aboveAverage ? "text-[var(--color-positive-text)]" : "text-[var(--color-negative-text)]",
        )}
      >
        Your lane history · {stats.n} seen
      </div>
      <div className="mt-1 text-[13.5px] text-[var(--color-text)]">
        Avg {formatCents(stats.avg)}, ranged {formatCents(stats.lo)} to {formatCents(stats.hi)}, you won {stats.won}.
      </div>
      <div className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
        {aboveAverage
          ? `Your max sits ${formatCents(diff)} above the average — room to win it.`
          : `The lane has been going ${formatCents(diff)} past your max — either the retail is light or this one is not yours.`}
      </div>
    </div>
  );
}

export function WatchItemCard({ row }: { row: WatchListRow }) {
  const { item, plan, stats, cappedRetail, documents } = row;
  const [runNumber, setRunNumber] = useState(item.runNumber ?? "");
  const [saleDate, setSaleDate] = useState(item.saleDate ?? "");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function saveRun(value: string) {
    setRunNumber(value);
    startTransition(() => updateWatchItemRunSale(item.id, { runNumber: value }));
  }
  function saveSale(value: string) {
    setSaleDate(value);
    startTransition(() => updateWatchItemRunSale(item.id, { saleDate: value }));
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    startTransition(() => uploadWatchItemAutocheck(item.id, formData));
    e.target.value = "";
  }

  const titleTone = TITLE_TONE[item.title] ?? "neutral";

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold text-[var(--color-text)]">
            {item.year} {item.make} {item.model}
          </div>
          <div className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">
            {item.trim ? `${item.trim} · ` : ""}
            {item.miles != null ? `${item.miles.toLocaleString()} mi` : "mileage unknown"}
          </div>
        </div>
        <Badge tone={titleTone}>{item.title}</Badge>
      </div>

      <div className="mt-3 flex gap-2">
        <label className="flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-fill-subtle)] px-3 py-1.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
            Run
          </span>
          <input
            value={runNumber}
            onChange={(e) => saveRun(e.target.value)}
            placeholder="—"
            className="w-14 bg-transparent text-[12.5px] font-medium text-[var(--color-text)] outline-none"
          />
        </label>
        <label className="flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-fill-subtle)] px-3 py-1.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
            Sale
          </span>
          <input
            type="date"
            value={saleDate}
            onChange={(e) => saveSale(e.target.value)}
            className="bg-transparent text-[12.5px] font-medium text-[var(--color-text)] outline-none"
          />
        </label>
      </div>

      <Tabs defaultValue="math" className="mt-4">
        <TabsList>
          <TabsTrigger value="banks">Banks</TabsTrigger>
          <TabsTrigger value="math">Math</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="autocheck">AutoCheck{documents.length > 0 ? ` (${documents.length})` : ""}</TabsTrigger>
        </TabsList>

        <TabsContent value="math">
          {plan ? (
            <div>
              <MathRow label="Retail" value={formatCents(plan.retail)} />
              <MathRow label="Recon" value={formatCents(plan.recon)} />
              <MathRow label="Tow (fixed)" value={formatCents(plan.tow)} />
              <MathRow label="Holding" value={formatCents(plan.holdingCost)} />
              <MathRow label="Target gross" value={formatCents(plan.targetGross)} />
              <MathRow label="Buy fee" value={formatCents(plan.fee)} />
              <MaxBidRow plan={plan} />
              {cappedRetail != null && (
                <div className="mt-2 text-[11px] text-[var(--color-caution-text)]">
                  Retail capped by lender advance to {formatCents(cappedRetail)}.
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 text-[12.5px] text-[var(--color-text-muted)]">
              No retail estimate entered yet — max bid can&apos;t be computed.
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {stats && plan ? (
            <LaneHistory stats={stats} maxBid={plan.maxBid} />
          ) : (
            <div className="py-4 text-[12.5px] text-[var(--color-text-muted)]">
              No lane comps for this make/model yet. Log what units bring — won or lost — on Auction
              day to build this out.
            </div>
          )}
        </TabsContent>

        <TabsContent value="banks">
          <div className="py-2 text-[12.5px] text-[var(--color-text-muted)]">
            House: {HOUSE_LABEL[item.house] ?? item.house}
          </div>
        </TabsContent>

        <TabsContent value="autocheck">
          {documents.length === 0 ? (
            <p className="py-3 text-[12.5px] text-[var(--color-text-muted)]">
              No AutoCheck attached yet — upload one to reference while you&apos;re deciding on this unit.
            </p>
          ) : (
            <div className="flex flex-col">
              {documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  onAnalyze={analyzeWatchItemDocument.bind(null, item.id)}
                  onDelete={deleteWatchItemDocument.bind(null, item.id)}
                />
              ))}
            </div>
          )}

          <input ref={fileInputRef} type="file" onChange={handleFileSelected} className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp" />
          <button
            type="button"
            disabled={isPending}
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 w-full rounded-[var(--radius-panel)] border border-dashed border-[var(--color-hairline)] py-2.5 text-[12px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-fill-subtle)] disabled:opacity-60"
          >
            {isPending ? "Uploading…" : "Upload AutoCheck"}
          </button>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
