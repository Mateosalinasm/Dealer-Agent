export interface LeadForSourceStats {
  source: string | null;
  status: string;
}

export interface SourceStat {
  source: string;
  total: number;
  sold: number;
  lost: number;
  conversionPct: number;
}

/** Leads grouped by channel — the data Marketing and Analytics both read. */
export function sourcePerformance(leads: LeadForSourceStats[]): SourceStat[] {
  const map = new Map<string, { source: string; total: number; sold: number; lost: number }>();
  for (const l of leads) {
    const key = l.source || "Unknown";
    const existing = map.get(key) ?? { source: key, total: 0, sold: 0, lost: 0 };
    existing.total += 1;
    if (l.status === "sold") existing.sold += 1;
    if (l.status === "lost") existing.lost += 1;
    map.set(key, existing);
  }
  return Array.from(map.values())
    .map((r) => ({ ...r, conversionPct: r.total ? Math.round((r.sold / r.total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.total - a.total);
}
