"use client";

import { useState, useTransition } from "react";
import { setLaneBudget } from "@/app/sourcing/auction-day/actions";

export function LaneBudgetInput({ initialCents }: { initialCents: number | null }) {
  const [value, setValue] = useState(initialCents != null ? (initialCents / 100).toString() : "");
  const [, startTransition] = useTransition();

  function commit() {
    const dollars = Number(value);
    const cents = value.trim() === "" ? null : Number.isFinite(dollars) ? Math.round(dollars * 100) : initialCents;
    startTransition(() => setLaneBudget(cents));
  }

  return (
    <label className="flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-fill-subtle)] px-3 py-1.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
        Budget for the sale
      </span>
      <span className="text-[12.5px] text-[var(--color-text-muted)]">$</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        placeholder="No limit set"
        className="w-24 bg-transparent text-[12.5px] font-medium text-[var(--color-text)] outline-none"
      />
    </label>
  );
}
