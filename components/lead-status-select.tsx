"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/input";
import { setLeadStatus } from "@/app/leads/actions";
import { leadStatusValues } from "@/lib/validation";

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  contacted: "Contacted",
  appointment: "Appointment set",
  sold: "Sold",
  lost: "Lost",
};

export function LeadStatusSelect({ leadId, status }: { leadId: string; status: string }) {
  // Same pattern as StipChecklist: this is a controlled input against a
  // server-fetched prop, so it needs local optimistic state or React snaps
  // it back to the old value before the server round-trip lands.
  const [localStatus, setLocalStatus] = useState(status);
  const [syncedStatus, setSyncedStatus] = useState(status);
  const [, startTransition] = useTransition();

  if (status !== syncedStatus) {
    setSyncedStatus(status);
    setLocalStatus(status);
  }

  function handleChange(next: string) {
    setLocalStatus(next);
    startTransition(() => setLeadStatus(leadId, next as (typeof leadStatusValues)[number]));
  }

  return (
    <Select value={localStatus} onChange={(e) => handleChange(e.target.value)} className="w-auto">
      {leadStatusValues.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </Select>
  );
}
