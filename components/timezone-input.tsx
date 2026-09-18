"use client";

import { useTransition } from "react";
import { setDealershipTimezone } from "@/app/sourcing/auction-day/actions";

// Common US dealership timezones. A select, not a free-text field — a
// typo'd IANA name here silently breaks every "today" boundary in Sourcing.
const TIMEZONES = [
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
];

export function TimezoneInput({ initialTimezone }: { initialTimezone: string }) {
  const [, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-fill-subtle)] px-3 py-1.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
        Lane timezone
      </span>
      <select
        defaultValue={initialTimezone}
        onChange={(e) => startTransition(() => setDealershipTimezone(e.target.value))}
        className="bg-transparent text-[12.5px] font-medium text-[var(--color-text)] outline-none"
      >
        {TIMEZONES.map((tz) => (
          <option key={tz.value} value={tz.value}>
            {tz.label}
          </option>
        ))}
      </select>
    </label>
  );
}
