// Pure helpers for the run-list demand/overstock badges. No API calls —
// just matching against leads and inventory you already have.

export interface LeadWant {
  wantMake: string | null;
  wantModel: string | null;
  wants: string | null;
}

export function countLeadsWanting(make: string, model: string, leads: LeadWant[]): number {
  const m = make.toLowerCase().trim();
  const mo = model.toLowerCase().trim();
  if (!m || !mo) return 0;
  return leads.filter((l) => {
    if (l.wantMake && l.wantModel) {
      if (l.wantMake.toLowerCase().includes(m) && l.wantModel.toLowerCase().includes(mo)) return true;
    }
    const text = (l.wants ?? "").toLowerCase();
    return text.includes(m) && text.includes(mo);
  }).length;
}

export interface StockUnit {
  make: string | null;
  model: string | null;
  sold: boolean;
}

export function countOnLot(make: string, model: string, vehicles: StockUnit[]): number {
  const m = make.toLowerCase().trim();
  const mo = model.toLowerCase().trim();
  if (!m || !mo) return 0;
  return vehicles.filter(
    (v) => !v.sold && (v.make ?? "").toLowerCase().trim() === m && (v.model ?? "").toLowerCase().trim() === mo,
  ).length;
}
