"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/utils";
import { logAuctionResult } from "@/app/sourcing/auction-day/actions";
import type { WatchListRow } from "@/lib/watch-list-data";

export function AuctionDayRow({ row }: { row: WatchListRow }) {
  const { item, plan, stats } = row;
  const [logging, setLogging] = useState(false);
  const [price, setPrice] = useState(plan ? (plan.maxBid / 100).toString() : "");
  const [isPending, startTransition] = useTransition();

  function submit(outcome: "bought" | "lost") {
    const dollars = Number(price);
    if (!Number.isFinite(dollars) || dollars < 0) return;
    startTransition(async () => {
      await logAuctionResult(item.id, outcome, dollars);
    });
  }

  return (
    <tr className="border-b border-[var(--color-hairline)] align-top">
      <td className="px-3 py-3 tabular-nums text-[19px] font-semibold text-[var(--color-text)]">
        {item.runNumber || <span className="text-[13px] font-normal text-[var(--color-text-placeholder)]">—</span>}
      </td>
      <td className="px-3 py-3">
        <Link href="/sourcing/watch-list" className="text-[13.5px] font-medium text-[var(--color-text)] hover:underline">
          {item.year} {item.make} {item.model} {item.trim ?? ""}
        </Link>
        <div className="text-[11.5px] text-[var(--color-text-muted)]">
          {item.miles != null ? `${item.miles.toLocaleString()} mi` : "mileage unknown"}
        </div>
      </td>
      <td className="px-3 py-3">
        <Badge tone={item.title === "clean" ? "neutral" : "negative"}>{item.title}</Badge>
      </td>
      <td className="px-3 py-3 tabular-nums text-[22px] font-semibold">
        {plan ? (
          <span className={plan.maxBid > 0 ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}>
            {formatCents(plan.maxBid)}
          </span>
        ) : (
          <span className="text-[13px] font-normal text-[var(--color-text-placeholder)]">no retail entered</span>
        )}
      </td>
      <td className="px-3 py-3 text-[12px]">
        {stats && plan ? (
          <span className={stats.avg <= plan.maxBid ? "text-[var(--color-positive-text)]" : "text-[var(--color-negative-text)]"}>
            {stats.n} seen · avg {formatCents(stats.avg)}
          </span>
        ) : (
          <span className="text-[var(--color-text-placeholder)]">no lane history</span>
        )}
      </td>
      <td className="px-3 py-3">
        {!logging ? (
          <Button
            type="button"
            className="bg-[var(--color-info-bg)] text-[var(--color-info-text)] hover:bg-[var(--color-info-hover)]"
            onClick={() => setLogging(true)}
          >
            Log what it brought
          </Button>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-fill-subtle)] px-2 py-1">
              <span className="text-[12px] text-[var(--color-text-muted)]">$</span>
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-20 border-0 bg-transparent px-0 py-0"
                autoFocus
              />
            </div>
            <Button type="button" disabled={isPending} onClick={() => submit("bought")}>
              Bought it
            </Button>
            <Button type="button" variant="secondary" disabled={isPending} onClick={() => submit("lost")}>
              Lost it
            </Button>
            <Button type="button" variant="ghost" disabled={isPending} onClick={() => setLogging(false)}>
              Cancel
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
